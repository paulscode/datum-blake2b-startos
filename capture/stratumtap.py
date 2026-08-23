#!/usr/bin/env python3
"""Recording proxy for the compatibility-test Stratum port.

Forwards bytes untouched between a miner and the gateway, and writes both
directions to a JSONL file. Runs unattended, so it is capped: once the cap is hit
it keeps forwarding and stops writing, rather than filling the volume.

Three things are deliberate:

  The log is truncated on start, so restarting the service begins a fresh
  capture. Two miners tested in sequence must not blend into one report.

  Credentials never reach disk. The password is dropped and the worker name is
  hashed at capture time, not scrubbed afterwards, so there is no window in which
  the file contains something a user would not want to paste into a public issue.

  Param widths are recorded before redaction. The width of the worker name is
  part of the dialect fingerprint, and hashing it would otherwise destroy that.
"""

import argparse
import hashlib
import json
import os
import socket
import sys
import threading
import time

REDACT_PASSWORD_AT = {"mining.authorize": 1}
HASH_USERNAME_AT = {"mining.authorize": 0, "mining.submit": 0}


def short_hash(value):
    return hashlib.sha256(str(value).encode()).hexdigest()[:8]


class Tap:
    def __init__(self, listen, upstream, logpath, max_bytes):
        self.lhost, self.lport = listen
        self.uhost, self.uport = upstream
        self.logpath = logpath
        self.max_bytes = max_bytes
        self.written = 0
        self.capped = False
        self.t0 = time.time()
        self.lock = threading.Lock()
        os.makedirs(os.path.dirname(logpath), exist_ok=True)
        # Truncate rather than append. Restarting the service therefore starts a
        # clean capture, which is the only reset mechanism a user needs and is
        # easy to explain. Appending would silently blend two different miners
        # into one report, which is worse than losing an old capture.
        self.log = open(logpath, "w", buffering=1)
        # An absolute start time, so a reader can tell which blocks belong to this
        # capture. Everything else here is relative to t0, which is fine for
        # describing a session and useless for correlating with anything outside
        # it. The gateway records submitted blocks in a different container with a
        # different lifecycle, so "cleared on start" does not mean the two were
        # cleared at the same time.
        self.log.write(json.dumps(
            {"t": 0.0, "dir": "tap", "note": "capture started", "epoch": self.t0}) + "\n")

    def record(self, direction, line):
        entry = {"t": round(time.time() - self.t0, 3), "dir": direction}
        try:
            msg = json.loads(line)
        except Exception:
            msg = None

        if isinstance(msg, dict):
            method = msg.get("method")
            params = msg.get("params")
            if method:
                entry["method"] = method
                # Widths first: redaction changes them, and they are the single
                # most useful field in the whole capture.
                if isinstance(params, list):
                    entry["widths"] = [
                        len(p) if isinstance(p, str) else type(p).__name__
                        for p in params
                    ]
                    entry["nparams"] = len(params)
                idx = REDACT_PASSWORD_AT.get(method)
                if idx is not None and isinstance(params, list) and len(params) > idx:
                    params[idx] = "<redacted>"
                idx = HASH_USERNAME_AT.get(method)
                if idx is not None and isinstance(params, list) and len(params) > idx:
                    params[idx] = f"<worker:{short_hash(params[idx])}>"
            elif "result" in msg:
                entry["result"] = msg.get("result")
                if msg.get("error"):
                    e = msg["error"]
                    entry["error"] = e[1] if isinstance(e, list) and len(e) > 1 else str(e)
            entry["raw"] = json.dumps(msg)
        else:
            entry["raw"] = line.decode("utf8", "replace") if isinstance(line, bytes) else line

        with self.lock:
            if self.capped:
                return
            blob = json.dumps(entry) + "\n"
            if self.written + len(blob) > self.max_bytes:
                self.log.write(
                    json.dumps({"t": entry["t"], "dir": "tap", "note": "capture cap reached"})
                    + "\n"
                )
                self.capped = True
                return
            self.log.write(blob)
            self.written += len(blob)

    def pump(self, src, dst, direction):
        buf = b""
        try:
            while True:
                chunk = src.recv(65536)
                if not chunk:
                    break
                dst.sendall(chunk)
                buf += chunk
                while b"\n" in buf:
                    line, buf = buf.split(b"\n", 1)
                    if line.strip():
                        self.record(direction, line.strip())
        except OSError:
            pass
        finally:
            for s in (src, dst):
                try:
                    s.shutdown(socket.SHUT_RDWR)
                except OSError:
                    pass

    def note(self, text):
        with self.lock:
            if not self.capped:
                self.log.write(
                    json.dumps({"t": round(time.time() - self.t0, 3),
                                "dir": "tap", "note": text}) + "\n"
                )

    def handle(self, client):
        # Top-level `note`, not wrapped in `raw`: the report reads it from the
        # entry, and burying it cost the reconnect-burst metric silently.
        self.note("connection")
        try:
            up = socket.create_connection((self.uhost, self.uport), timeout=30)
        except OSError:
            client.close()
            return
        a = threading.Thread(target=self.pump, args=(client, up, "miner->pool"), daemon=True)
        b = threading.Thread(target=self.pump, args=(up, client, "pool->miner"), daemon=True)
        a.start(); b.start(); a.join(); b.join()

    def serve(self):
        srv = socket.socket()
        srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        srv.bind((self.lhost, self.lport))
        srv.listen(8)
        print(f"[capture] {self.lhost}:{self.lport} -> {self.uhost}:{self.uport}", flush=True)
        print(f"[capture] writing {self.logpath}, cap {self.max_bytes} bytes", flush=True)
        while True:
            c, _ = srv.accept()
            threading.Thread(target=self.handle, args=(c,), daemon=True).start()


def hostport(s, default_host="0.0.0.0"):
    h, p = s.rsplit(":", 1)
    return (h or default_host, int(p))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--listen", default="0.0.0.0:23337")
    ap.add_argument("--upstream", default="127.0.0.1:23335")
    ap.add_argument("--log", default="/data/capture/wire.jsonl")
    ap.add_argument("--max-bytes", type=int, default=8 * 1024 * 1024)
    a = ap.parse_args()
    Tap(hostport(a.listen), hostport(a.upstream, "127.0.0.1"), a.log, a.max_bytes).serve()


if __name__ == "__main__":
    sys.exit(main())
