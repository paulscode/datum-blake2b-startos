#!/usr/bin/env python3
"""A one-page web front end for the compatibility report.

StartOS has actions, so there the report is an action with a form and a copyable
result. Umbrel has no equivalent, and telling a non-technical user to run
`docker exec` would mean nobody ever files a report. So on Umbrel this page is
the app's tile: it links to the mining dashboard and it generates the report.

It shells out to report.py rather than importing it, so there is exactly one
implementation of the parsing and both platforms get identical output.
"""

import argparse
import html
import os
import subprocess
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer

FIELDS = ("make", "model", "firmware", "notes")

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Datum Gateway BLAKE2b</title>
<style>
 :root {{ color-scheme: light dark; }}
 body {{ font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
        max-width: 46rem; margin: 0 auto; padding: 1.5rem; }}
 h1 {{ font-size: 1.4rem; margin-bottom: .25rem; }}
 h2 {{ font-size: 1.1rem; margin-top: 2rem; }}
 .sub {{ opacity: .7; margin-top: 0; }}
 .card {{ border: 1px solid rgba(128,128,128,.35); border-radius: .6rem;
         padding: 1rem 1.25rem; margin: 1rem 0; }}
 label {{ display: block; margin: .75rem 0 .2rem; font-weight: 600; }}
 input, textarea {{ width: 100%; padding: .5rem; font: inherit; box-sizing: border-box;
        border: 1px solid rgba(128,128,128,.5); border-radius: .35rem;
        background: transparent; color: inherit; }}
 button {{ margin-top: 1rem; padding: .6rem 1.1rem; font: inherit; font-weight: 600;
        border: 0; border-radius: .35rem; background: #2f6fed; color: #fff;
        cursor: pointer; }}
 pre {{ white-space: pre-wrap; word-wrap: break-word; }}
 textarea.report {{ height: 22rem; font-family: ui-monospace, monospace; font-size: .85rem; }}
 a.button {{ display: inline-block; margin-top: .5rem; padding: .6rem 1.1rem;
        border-radius: .35rem; background: #2f6fed; color: #fff;
        text-decoration: none; font-weight: 600; }}
 code {{ background: rgba(128,128,128,.18); padding: .1rem .3rem; border-radius: .25rem; }}
</style>
</head>
<body>
<h1>Datum Gateway BLAKE2b</h1>
<p class="sub">Solo mining on a private BLAKE2b test chain.</p>

<div class="card">
<h2 style="margin-top:0">Point your miner here</h2>
<p>In your miner's own web interface, set the pool to:</p>
<p><code id="stratum">stratum+tcp://{host}:{stratum_port}</code></p>
<p>The worker name and password are not used. Put anything readable as the
worker so you can tell miners apart.</p>
{host_note}
{dashboard_link}
</div>

<div class="card">
<h2 style="margin-top:0">Report how your miner did</h2>
<p>If your miner is not one of the models already known to work, a report helps
the upstream projects support more hardware.</p>
<ol>
<li>Point your miner at the <strong>capture</strong> port
    <code id="capture">stratum+tcp://{host}:{capture_port}</code> instead of the
    normal one. It mines exactly as normal; the only difference is that the
    conversation is written down.</li>
<li>Let it run for a minute or two.</li>
<li>Fill this in and press the button.</li>
</ol>
<form method="post">
<label for="make">Make</label>
<input id="make" name="make" value="{make}" placeholder="Goldshell, Bitmain, ...">
<label for="model">Model</label>
<input id="model" name="model" value="{model}" placeholder="HS-Box, SC-Box, ...">
<label for="firmware">Firmware version</label>
<input id="firmware" name="firmware" value="{firmware}" placeholder="from the miner's own web interface">
<label for="notes">Anything else worth saying</label>
<textarea id="notes" name="notes" rows="3"
  placeholder="What you tried, what it did, anything that looked odd">{notes}</textarea>
<button type="submit">Create report</button>
</form>
</div>
{report}
<p style="opacity:.7;font-size:.9rem">Nothing is sent anywhere on its own. You see
exactly what you are sharing before you share it, and worker names are hashed and
passwords dropped before anything reaches disk.</p>

</body>
</html>
"""

# Shown when the host's LAN address is known. The point is not to repeat the
# warning but to explain why the address here is not the one in the address bar,
# so the two do not read as contradicting each other.
HOST_KNOWN_NOTE = """<p>That is your server's IP address rather than the name in
your browser's address bar, and the difference matters: most ASIC firmware has no
mDNS resolver, so a <code>.local</code> address fails silently and the miner
reports only that the pool is not ready. If your server's IP ever changes,
restart this app and this page will catch up.</p>"""

DASHBOARD_LINK = """<a class="button" href="{url}" target="_blank">Open the mining dashboard</a>"""

# Without a known host address, the browser's own is the sensible fallback for a
# link a person clicks. It is only the miner that cannot use it.
DASHBOARD_LINK_JS = """<a class="button" id="dash" href="#" target="_blank">Open the mining dashboard</a>
<script>document.getElementById('dash').href =
  location.protocol + '//' + location.hostname + ':{port}';</script>"""

# Shown when it is not. Better to say plainly that a value is missing than to
# print the browser's hostname and have the page contradict itself.
HOST_UNKNOWN_NOTE = """<p><strong>Substitute your server's IP address for
<code>YOUR-SERVER-IP</code>.</strong> Most ASIC firmware has no mDNS resolver, so
a <code>.local</code> name fails silently and the miner reports only that the pool
is not ready. You can find the address on your server's settings page.</p>"""

REPORT_BLOCK = """<div class="card">
<h2 style="margin-top:0">Your report</h2>
<p>Copy all of this and share it in the Bitcoin section of the forum,
<a href="https://paulscode.com/c/bitcoin/8" target="_blank">paulscode.com/c/bitcoin/8</a>
(posting needs a free account, so sign up or log in first, then start a topic and
paste it in). If you already use GitHub, an
<a href="https://github.com/paulscode/datum-blake2b-startos/issues" target="_blank">issue</a>
does just as well.</p>
<textarea class="report" readonly onclick="this.select()">{body}</textarea>
</div>
"""


class Handler(BaseHTTPRequestHandler):
    cfg = {}

    def _render(self, values=None, report=None):
        values = values or {}
        host = self.cfg["host_ip"]
        body = PAGE.format(
            host=html.escape(host or "YOUR-SERVER-IP"),
            host_note=HOST_KNOWN_NOTE if host else HOST_UNKNOWN_NOTE,
            # The dashboard is a link a person clicks, not an address a miner is
            # given, so falling back to whatever host the browser already reached
            # this page on is right here even though it is wrong for stratum.
            dashboard_link=DASHBOARD_LINK.format(
                url=f"http://{html.escape(host)}:{self.cfg['dashboard_port']}"
            ) if host else DASHBOARD_LINK_JS.format(port=self.cfg["dashboard_port"]),
            stratum_port=self.cfg["stratum_port"],
            capture_port=self.cfg["capture_port"],
            dashboard_port=self.cfg["dashboard_port"],
            report=REPORT_BLOCK.format(body=html.escape(report)) if report else "",
            **{f: html.escape(values.get(f, "")) for f in FIELDS},
        ).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split("?")[0] not in ("/", "/index.html"):
            self.send_error(404)
            return
        self._render()

    def do_POST(self):
        length = min(int(self.headers.get("Content-Length") or 0), 64 * 1024)
        raw = self.rfile.read(length).decode("utf8", "replace")
        form = urllib.parse.parse_qs(raw)
        values = {f: (form.get(f) or [""])[0].strip() for f in FIELDS}

        argv = [sys.executable, self.cfg["report_py"], self.cfg["capture_log"]]
        for f in FIELDS:
            argv += [f"--{f}", values[f]]
        commit = ""
        try:
            with open("/etc/datum-pinned-commit") as fh:
                commit = fh.read().strip()
        except OSError:
            pass
        argv += ["--datum-commit", commit]

        try:
            out = subprocess.run(argv, capture_output=True, timeout=60)
            report = out.stdout.decode("utf8", "replace") or \
                out.stderr.decode("utf8", "replace")
        except Exception as exc:
            report = f"Could not generate the report: {exc}"
        self._render(values, report)

    def log_message(self, fmt, *a):
        # One line per request on stdout, so the app's logs show activity without
        # the default's duplicated timestamp.
        print("[report] " + fmt % a, flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--listen", default="0.0.0.0:7154")
    ap.add_argument("--capture-log", default="/data/capture/wire.jsonl")
    ap.add_argument("--report-py", default="/usr/local/bin/report.py")
    ap.add_argument("--stratum-port", default=os.environ.get("STRATUM_PORT", "23336"))
    ap.add_argument("--capture-port", default=os.environ.get("CAPTURE_PORT", "23337"))
    ap.add_argument("--dashboard-port", default=os.environ.get("API_PORT", "7152"))
    # The address to hand a miner. It has to be passed in: a container on a Docker
    # network can only see its own address there, and the hostname the browser
    # used is usually a .local name, which is exactly the address that does not
    # work. Empty is handled by the page rather than guessed at.
    ap.add_argument("--host-ip", default=os.environ.get("HOST_IP", ""))
    a = ap.parse_args()

    host, port = a.listen.rsplit(":", 1)
    Handler.cfg = {
        "capture_log": a.capture_log,
        "report_py": a.report_py,
        "stratum_port": a.stratum_port,
        "capture_port": a.capture_port,
        "dashboard_port": a.dashboard_port,
        "host_ip": a.host_ip.strip(),
    }
    print(f"[report] serving on {host}:{port}, "
          f"advertising {a.host_ip.strip() or '(no host address given)'}", flush=True)
    HTTPServer((host or "0.0.0.0", int(port)), Handler).serve_forever()


if __name__ == "__main__":
    sys.exit(main())
