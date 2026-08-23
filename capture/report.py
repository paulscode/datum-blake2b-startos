#!/usr/bin/env python3
"""Turn a capture into a compatibility report someone can paste into an issue.

  report.py <wire.jsonl> [--make X] [--model Y] [--firmware Z] [--notes N]

Prints markdown. Deliberately short: a paragraph gets read and acted on, a
transcript does not.
"""

import argparse
import base64
import glob
import json
import os
import sys
import urllib.error
import urllib.request
from collections import Counter

KNOWN_METHODS = {
    "mining.subscribe", "mining.authorize", "mining.submit", "mining.notify",
    "mining.set_difficulty", "mining.configure", "mining.set_version_mask",
    "mining.extranonce.subscribe", "mining.suggest_difficulty",
    "mining.set_extranonce", "client.get_version", "client.reconnect",
}


def submitted_blocks(directory):
    """Block hashes the gateway wrote a submitblock record for, this session.

    The gateway names each file after the block hash, and the entrypoint clears
    the directory on start, so this is one session's submissions.
    """
    if not directory:
        return []
    out = []
    for path in glob.glob(os.path.join(directory, "datum_submitblock_*.json")):
        h = os.path.basename(path)[len("datum_submitblock_"):-len(".json")]
        if len(h) == 64 and all(c in "0123456789abcdef" for c in h.lower()):
            out.append(h.lower())
    return sorted(set(out))


def ask_node(rpc_url, cookie_path, hashes):
    """Which of these blocks did the node actually accept into its chain?

    The node is the only authority on this. The gateway knows what it sent; it
    does not know what came back, and an accepted share is not a block. This is
    exactly the distinction the h1 version-bit bug lived in, where every share
    looked healthy and every block was rejected.

    Returns (accepted, rejected, error) where error is set when the node could
    not be asked at all, so a report can say "not checked" rather than "none".
    """
    if not hashes:
        return [], [], None
    if not rpc_url or not cookie_path or not os.path.exists(cookie_path):
        return [], [], "no RPC credentials"
    try:
        with open(cookie_path) as fh:
            cookie = fh.read().strip()
    except OSError as exc:
        return [], [], f"could not read the cookie ({exc})"

    auth = base64.b64encode(cookie.encode()).decode()
    accepted, rejected = [], []
    for h in hashes:
        body = json.dumps({"jsonrpc": "1.0", "id": "report",
                           "method": "getblockheader", "params": [h]}).encode()
        req = urllib.request.Request(
            rpc_url, data=body,
            headers={"Content-Type": "application/json",
                     "Authorization": "Basic " + auth})
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                res = json.load(resp).get("result") or {}
            # Known to the node and on the best chain. A block it rejected is not
            # known at all; one it accepted but reorged away has confirmations -1,
            # which is not the same thing and should not be counted as accepted.
            if res.get("confirmations", -1) >= 1:
                accepted.append(h)
            else:
                rejected.append(h)
        except urllib.error.HTTPError:
            # The node answers 500 with an error body for an unknown block.
            rejected.append(h)
        except (urllib.error.URLError, OSError, ValueError) as exc:
            return accepted, rejected, f"the node could not be reached ({exc})"
    return accepted, rejected, None


def load(path):
    out = []
    try:
        for line in open(path):
            line = line.strip()
            if line:
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    except FileNotFoundError:
        pass
    return out


def summarise(rows):
    s = {
        "ua": None, "en1": None, "en2_size": None, "connections": 0,
        "notifies": 0, "submits": 0, "accepted": 0, "rejected": Counter(),
        "diffs": [], "submit_widths": Counter(), "subscribe_widths": None,
        "methods": Counter(), "nonstandard": Counter(), "span": 0.0, "idle_period": None,
        "nsubscribe_params": None, "subscribes": 0, "resumes": 0,
        "first_submit": None, "reconnect_burst": 0, "capped": False,
    }
    pending, conn_times = {}, []
    for r in rows:
        s["span"] = max(s["span"], r.get("t", 0))
        if r.get("note") == "connection":
            s["connections"] += 1
            conn_times.append(r.get("t", 0))
            continue
        if r.get("note") == "capture cap reached":
            s["capped"] = True
            continue
        try:
            m = json.loads(r["raw"])
        except Exception:
            continue
        meth = m.get("method")
        if meth:
            s["methods"][meth] += 1
            if meth not in KNOWN_METHODS:
                s["nonstandard"][meth] += 1
            if meth == "mining.subscribe":
                p = m.get("params") or []
                if p and isinstance(p[0], str):
                    s["ua"] = p[0]
                s["subscribe_widths"] = r.get("widths")
                s["nsubscribe_params"] = r.get("nparams")
                s["subscribes"] += 1
                # A second param is a session id being offered for resumption.
                if (r.get("nparams") or 0) >= 2:
                    s["resumes"] += 1
                pending[m.get("id")] = "subscribe"
            elif meth == "mining.notify":
                s["notifies"] += 1
                p = m.get("params") or []
                if p and p[-1] is True:
                    s["clean"] = s.get("clean", 0) + 1
            elif meth == "mining.set_difficulty":
                d = (m.get("params") or [None])[0]
                if d is not None and d not in s["diffs"]:
                    s["diffs"].append(d)
            elif meth == "mining.submit":
                s["submits"] += 1
                if s["first_submit"] is None:
                    s["first_submit"] = r.get("t")
                w = r.get("widths")
                if w:
                    s["submit_widths"][
                        f"{r.get('nparams')} params: " + ",".join(str(x) for x in w)
                    ] += 1
                pending[m.get("id")] = "submit"
        elif "result" in m:
            what = pending.pop(m.get("id"), None)
            if what == "subscribe" and isinstance(m.get("result"), list):
                res = m["result"]
                if len(res) >= 3:
                    s["en1"] = len(res[1]) // 2 if isinstance(res[1], str) else res[1]
                    s["en2_size"] = res[2]
            elif what == "submit":
                if m.get("result") is True:
                    s["accepted"] += 1
                else:
                    s["rejected"][r.get("error") or "unknown"] += 1

    # A burst is reconnects inside the first 30s; that is the pattern that trips
    # rate limiting, and it reads very differently from steady reconnecting.
    s["reconnect_burst"] = sum(1 for t in conn_times if t <= (conn_times[0] + 30)) if conn_times else 0
    # Median gap, so one outlier does not define the pattern.
    gaps = sorted(round(b - a, 1) for a, b in zip(conn_times, conn_times[1:]))
    s["idle_period"] = gaps[len(gaps) // 2] if len(gaps) >= 4 else None
    return s


def verdict(s, blocks=None):
    # A block the node accepted is the strongest statement this report can make,
    # and it is a different claim from accepted shares. Shares are the gateway's
    # opinion; a block in the chain is the node's.
    if blocks and blocks["accepted"]:
        line = (f"**Works, and it mined real blocks.** The node accepted "
                f"{blocks['accepted']} of {blocks['submitted']} blocks this miner "
                f"found.")
        # Only mention shares when they agree with that. A miner can land blocks
        # while its shares are refused, because the gateway checks a submission
        # against the block target before the share target, and on a test chain
        # the block target is the easier of the two. True of the CPU reference
        # miner, and it would read as a contradiction rather than as detail.
        if s["accepted"]:
            line += f" {s['accepted']} of {s['submits']} shares were accepted."
        return line
    if blocks and blocks["submitted"] and blocks["error"] is None:
        return (f"**Hashing, but no block stuck.** {blocks['submitted']} blocks were "
                "submitted and the node accepted none of them. The miner and the "
                "gateway agree; the gateway and the node do not.")
    return _verdict_shares(s)


def _verdict_shares(s):
    # Ordered by strength of evidence, not by position in the handshake. A
    # capture can be missing connection records (an older format, or a proxy in
    # front) while plainly showing accepted shares, and reporting "no connection"
    # in that case would be both wrong and the most alarming thing in the report.
    if s["accepted"]:
        return f"**Works.** {s['accepted']} of {s['submits']} shares accepted."
    if s["submits"]:
        return "**Submitted, nothing accepted.** It is hashing but computing a different digest, or the difficulty conventions differ."
    if s["notifies"]:
        return "**Jobs received, nothing submitted.** The miner is not hashing this work. Likely a work-format or algorithm mismatch."
    if s["connections"] or s["methods"]:
        return "**Connected, no jobs.** The subscribe/authorize handshake did not complete."
    return "**No connection.** The miner never reached the gateway. Usually the address: use the server's IP, not its `.local` name."


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("wire")
    for f in ("make", "model", "firmware", "notes"):
        ap.add_argument(f"--{f}", default="")
    ap.add_argument("--datum-version", default="")
    ap.add_argument("--datum-commit", default="")
    # Blocks, which the wire capture cannot see. The gateway writes one file per
    # submitted block; only the node can say which of them it accepted.
    ap.add_argument("--submitted-dir", default="")
    ap.add_argument("--rpc-url", default="")
    ap.add_argument("--rpc-cookie", default="")
    a = ap.parse_args()

    rows = load(a.wire)
    if not rows:
        print("No capture found yet.\n")
        print("Point your miner at the **Stratum (compatibility test)** address on the")
        print("Interfaces tab, let it run for a minute, then run this action again.")
        return 0

    s = summarise(rows)
    hashes = submitted_blocks(a.submitted_dir)
    acc, rej, err = ask_node(a.rpc_url, a.rpc_cookie, hashes)
    blocks = {"submitted": len(hashes), "accepted": len(acc),
              "rejected": len(rej), "error": err}
    dev = " ".join(x for x in (a.make, a.model) if x) or "(not given)"

    print("## ASIC compatibility report\n")
    print(f"**Device:** {dev}")
    if a.firmware:
        print(f"**Firmware:** {a.firmware}")
    print(f"**Stratum user agent:** `{s['ua'] or 'not sent'}`\n")
    print(verdict(s, blocks) + "\n")

    print("### Outcome\n")
    # Connections and stratum sessions are different things, and conflating them
    # makes a well-behaved miner look like it is thrashing. This device opens a
    # bare TCP connection every few seconds that never speaks stratum, while one
    # long-lived session does all the mining.
    bare = s["connections"] - s["subscribes"]
    print(f"- TCP connections: {s['connections']}"
          + (f", of which {bare} never sent mining.subscribe" if bare > 0 else ""))
    if s["idle_period"]:
        print(f"- bare connections arrive about every {s['idle_period']:.1f}s")
    print(f"- stratum sessions: {s['subscribes']}"
          + (f" ({s['resumes']} offering a session id to resume)" if s["resumes"] else ""))
    print(f"- jobs received: {s['notifies']}"
          + (f" ({s['clean']} with clean_jobs)" if s.get("clean") else ""))
    print(f"- shares: {s['submits']} submitted, {s['accepted']} accepted")
    for k, v in s["rejected"].most_common():
        print(f"- rejected: {v} x `{k}`")
    print(f"- session: {s['span']:.0f}s")
    if blocks is None or not blocks["submitted"]:
        print("- blocks: none submitted this session")
    elif blocks["error"]:
        print(f"- blocks: {blocks['submitted']} submitted, acceptance not checked "
              f"({blocks['error']})")
    else:
        print(f"- blocks: {blocks['submitted']} submitted, "
              f"{blocks['accepted']} accepted by the node")
        if blocks["rejected"]:
            print(f"- blocks the node did not accept: {blocks['rejected']}")
            if blocks["accepted"]:
                # Two blocks found at the same height is normal when blocks come
                # this fast, and only one can win. Worth saying, because a bare
                # count here looks like a fault and is not one.
                print("  (normal when blocks come quickly: two found at the same"
                      " height, and only one can be the chain)")
    print()

    print("### Dialect\n")
    print("```")
    print(f"subscribe        : {s['nsubscribe_params']} param(s), widths {s['subscribe_widths']}")
    print(f"extranonce1      : {s['en1']} bytes")
    print(f"extranonce2_size : {s['en2_size']}")
    for k, v in s["submit_widths"].most_common(3):
        print(f"submit           : {k}   ({v}x)")
    print(f"difficulty       : {s['diffs']}")
    print(f"methods used     : {', '.join(sorted(s['methods']))}")
    print(f"non-standard     : {', '.join(sorted(s['nonstandard'])) or 'none'}")
    print("```\n")

    if s["submit_widths"]:
        widest = s["submit_widths"].most_common(1)[0][0]
        if ",16,16" in widest:
            print("Submit uses **16-hex ntime and nonce**, the Sia 8-byte convention.\n")
        elif ",8,8" in widest:
            print("Submit uses **8-hex ntime and nonce**, the Bitcoin 4-byte convention.\n")

    print("### Environment\n")
    # The pinned commit identifies the gateway build exactly, which is what an
    # upstream reader needs. Naming a host platform here would be wrong half the
    # time: the same image runs the StartOS package and the Umbrel app.
    print(f"- datum-blake2b image (`{a.datum_commit or '?'}`)\n")

    if a.notes:
        print("### Notes\n")
        print(a.notes + "\n")

    if s["capped"]:
        print("_Capture hit its size cap; figures cover the recorded portion._\n")
    print("_Worker names are hashed and passwords dropped at capture time._\n")
    print("Share this in the Bitcoin section of the forum:")
    print("  https://paulscode.com/c/bitcoin/8   (a free account is needed to post)")
    print("or, if you already use GitHub:")
    print("  https://github.com/paulscode/datum-blake2b-startos/issues")
    return 0


if __name__ == "__main__":
    sys.exit(main())
