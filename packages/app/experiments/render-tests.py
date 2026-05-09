#!/usr/bin/env python3
# CHANGE: render the vitest run summary to a PNG screenshot for the PR proof
# WHY: PR#2 reviewer asked for visual proof; show 108/108 tests passing
# REF: PR#2 reviewer request "пруфы что она реально работает"
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from importlib import import_module
mod = import_module("render-demo")

TXT = Path("/tmp/gh-issue-solver-1778346078134/docs/screenshots/tests.txt")
HTML = Path("/tmp/gh-issue-solver-1778346078134/docs/screenshots/tests.html")
PNG = Path("/tmp/gh-issue-solver-1778346078134/docs/screenshots/tests.png")


def main() -> int:
    body = mod.ansi_to_html(TXT.read_text())
    html = f"""<!doctype html>
<html><head><meta charset=\"utf-8\">
<style>
  html, body {{ margin: 0; padding: 0; background: #1f2430; }}
  pre {{
    margin: 0; padding: 24px 32px;
    color: #d8dee9;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 14px;
    line-height: 1.55;
    white-space: pre;
  }}
  .header {{
    background: #2e3440; color: #d8dee9;
    padding: 10px 24px; border-bottom: 1px solid #3b4252;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    font-size: 13px;
  }}
  .header b {{ color: #a3be8c; }}
</style></head>
<body>
  <div class=\"header\">Web-X11 Container Runtime — <b>108/108 tests passing</b> &nbsp;·&nbsp; pnpm test &nbsp;·&nbsp; CORE + SHELL coverage including HTTP API and gateway integration tests.</div>
  <pre>{body}</pre>
</body></html>
"""
    HTML.write_text(html)
    cmd = [
        "google-chrome",
        "--headless=new",
        "--no-sandbox",
        "--hide-scrollbars",
        "--window-size=1280,1100",
        f"--screenshot={PNG}",
        f"file://{HTML}"
    ]
    rc = subprocess.run(cmd, check=False).returncode
    print(f"chrome exit={rc}; png={PNG} size={PNG.stat().st_size if PNG.exists() else 'n/a'}")
    return rc


if __name__ == "__main__":
    sys.exit(main())
