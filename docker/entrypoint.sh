#!/usr/bin/env bash
# QUOTE(TZ): "Xvfb / openbox / x11vnc / websockify / noVNC / GUI app"
# REF: issue#1 section 6.2 "entrypoint.sh"
# PURITY: SHELL (container init)
# INVARIANT: every started PID is killed when any one of them exits, so the container
#            never lingers with a half-broken X11 stack.
set -euo pipefail

export DISPLAY="${DISPLAY:-:99}"
export VNC_PORT="${VNC_PORT:-5900}"
export NOVNC_PORT="${NOVNC_PORT:-6080}"
export SCREEN_WIDTH="${SCREEN_WIDTH:-1280}"
export SCREEN_HEIGHT="${SCREEN_HEIGHT:-720}"
export SCREEN_DEPTH="${SCREEN_DEPTH:-24}"
export START_APP="${START_APP:-xterm}"

log() { printf '[runtime] %s\n' "$*"; }

log "Starting Xvfb on ${DISPLAY} (${SCREEN_WIDTH}x${SCREEN_HEIGHT}x${SCREEN_DEPTH})"
Xvfb "${DISPLAY}" \
  -screen 0 "${SCREEN_WIDTH}x${SCREEN_HEIGHT}x${SCREEN_DEPTH}" \
  -nolisten tcp \
  -noreset \
  +extension GLX \
  +render &
XVFB_PID=$!

# Wait for the X server socket to appear instead of a blind sleep.
display_num="${DISPLAY#:}"
for _ in $(seq 1 50); do
  if [ -S "/tmp/.X11-unix/X${display_num}" ]; then break; fi
  sleep 0.1
done

log "Starting window manager (openbox)"
openbox &
OPENBOX_PID=$!

log "Starting app: ${START_APP}"
bash -lc "${START_APP}" &
APP_PID=$!

log "Starting x11vnc on 127.0.0.1:${VNC_PORT}"
x11vnc \
  -display "${DISPLAY}" \
  -forever \
  -shared \
  -nopw \
  -localhost \
  -rfbport "${VNC_PORT}" \
  -quiet &
X11VNC_PID=$!

log "Starting websockify/noVNC on 0.0.0.0:${NOVNC_PORT}"
websockify \
  --web=/usr/share/novnc/ \
  "0.0.0.0:${NOVNC_PORT}" \
  "127.0.0.1:${VNC_PORT}" &
WEBSOCKIFY_PID=$!

log "Ready"

# QUOTE(TZ): "wait -n ... One of the critical processes exited. Shutting down."
# REF: issue#1 section 6.2
trap 'kill "$XVFB_PID" "$OPENBOX_PID" "$APP_PID" "$X11VNC_PID" "$WEBSOCKIFY_PID" 2>/dev/null || true' EXIT
wait -n "$XVFB_PID" "$OPENBOX_PID" "$APP_PID" "$X11VNC_PID" "$WEBSOCKIFY_PID"
log "One of the critical processes exited. Shutting down."
exit 1
