#!/usr/bin/env python3
# CHANGE: render ANSI-colored demo log to PNG screenshots for the PR proof
# WHY: reviewer asked for visual proof; we have terminal output, headless chrome can rasterize HTML
# REF: PR#2 reviewer request "пруфы что она реально работает"
import re
import subprocess
import sys
from pathlib import Path

TXT = Path("/tmp/gh-issue-solver-1778346078134/docs/screenshots/api-demo.txt")
HTML_A = Path("/tmp/gh-issue-solver-1778346078134/docs/screenshots/api-demo-a.html")
HTML_B = Path("/tmp/gh-issue-solver-1778346078134/docs/screenshots/api-demo-b.html")
PNG_A = Path("/tmp/gh-issue-solver-1778346078134/docs/screenshots/api-demo-a.png")
PNG_B = Path("/tmp/gh-issue-solver-1778346078134/docs/screenshots/api-demo-b.png")

ANSI_RE = re.compile(r"\x1b\[([0-9;]*)m")

COLORS = {
    30: "#000000", 31: "#cc6666", 32: "#a3be8c", 33: "#ebcb8b",
    34: "#81a1c1", 35: "#b48ead", 36: "#88c0d0", 37: "#e5e9f0",
    90: "#4c566a", 91: "#bf616a", 92: "#a3be8c", 93: "#ebcb8b",
    94: "#81a1c1", 95: "#b48ead", 96: "#8fbcbb", 97: "#eceff4",
}


def ansi_to_html(text: str) -> str:
    out = []
    open_spans = 0

    def close_all():
        nonlocal open_spans
        result = "</span>" * open_spans
        open_spans = 0
        return result

    pos = 0
    for m in ANSI_RE.finditer(text):
        out.append(escape(text[pos:m.start()]))
        pos = m.end()
        codes = [int(c) for c in m.group(1).split(";") if c]
        if not codes or codes == [0]:
            out.append(close_all())
            continue
        styles = []
        bold = False
        for code in codes:
            if code == 0:
                out.append(close_all())
            elif code == 1:
                bold = True
            elif code in COLORS:
                styles.append(f"color:{COLORS[code]}")
            elif 100 <= code <= 107:
                styles.append(f"background:{COLORS[code - 60]}")
            elif 40 <= code <= 47:
                styles.append(f"background:{COLORS[code - 10]}")
        if bold:
            styles.append("font-weight:600")
        if styles:
            out.append(f"<span style=\"{';'.join(styles)}\">")
            open_spans += 1
    out.append(escape(text[pos:]))
    out.append(close_all())
    return "".join(out)


def escape(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


HTML_TMPL = """<!doctype html>
<html><head><meta charset=\"utf-8\">
<style>
  html, body {{ margin: 0; padding: 0; background: #1f2430; }}
  pre {{
    margin: 0; padding: 18px 26px;
    color: #d8dee9;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
  }}
  .header {{
    background: #2e3440; color: #d8dee9;
    padding: 10px 26px; border-bottom: 1px solid #3b4252;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    font-size: 13px;
  }}
  .header b {{ color: #88c0d0; }}
</style></head>
<body>
  <div class=\"header\">{title}</div>
  <pre>{body}</pre>
</body></html>
"""


def render(html: Path, png: Path, width: int, height: int) -> int:
    cmd = [
        "google-chrome",
        "--headless=new",
        "--no-sandbox",
        "--hide-scrollbars",
        f"--window-size={width},{height}",
        f"--screenshot={png}",
        f"file://{html}"
    ]
    return subprocess.run(cmd, check=False).returncode


def main() -> int:
    raw = TXT.read_text()
    sections = raw.split("\x1b[1;36m=== ")
    head = sections[0]
    rest = ["\x1b[1;36m=== " + s for s in sections[1:]]

    halfway = len(rest) // 2 + 1
    part_a = head + "".join(rest[:halfway])
    part_b = "".join(rest[halfway:])

    HTML_A.write_text(HTML_TMPL.format(
        title="Web-X11 Container Runtime — REST API + gateway demo (1/2)  ·  http://127.0.0.1:18080  ·  SessionManager wired to a fake Docker layer (no daemon required to verify the HTTP contract).",
        body=ansi_to_html(part_a)
    ))
    HTML_B.write_text(HTML_TMPL.format(
        title="Web-X11 Container Runtime — REST API + gateway demo (2/2)  ·  proxy 502 / 404 paths and FSM rejection of an illegal transition.",
        body=ansi_to_html(part_b)
    ))
    rc_a = render(HTML_A, PNG_A, 1180, 1700)
    rc_b = render(HTML_B, PNG_B, 1180, 1700)
    print(f"chrome exit a={rc_a}; png={PNG_A} size={PNG_A.stat().st_size if PNG_A.exists() else 'n/a'}")
    print(f"chrome exit b={rc_b}; png={PNG_B} size={PNG_B.stat().st_size if PNG_B.exists() else 'n/a'}")
    return rc_a or rc_b


if __name__ == "__main__":
    sys.exit(main())
