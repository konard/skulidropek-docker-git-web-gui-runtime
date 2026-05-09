#!/usr/bin/env bash
# CHANGE: real Docker/noVNC proof runner for PR screenshots
# WHY: verify the orchestrator against a real container, not the fake Docker test layer
# REF: PR#2 reviewer request for real screenshots / proof
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
APP_DIR="$ROOT_DIR/packages/app"
PORT="${PORT:-18080}"
IMAGE="${IMAGE:-webx11-runtime:latest}"
APP="${START_APP:-xeyes}"
APP_COMMAND_NAME="${APP%% *}"
APP_COMMAND_NAME="${APP_COMMAND_NAME##*/}"
SESSION_NAME="${SESSION_NAME:-real-${APP_COMMAND_NAME}}"
TMP_DIR="${TMP_DIR:-$(mktemp -d)}"
SERVER_LOG="$TMP_DIR/server.log"
SESSION_ID=""
SERVER_PID=""

mkdir -p "$TMP_DIR"

cleanup() {
  if [ "${KEEP_ALIVE:-0}" = "1" ]; then
    printf '[real-e2e] KEEP_ALIVE=1; leaving server/session running\n'
    return
  fi
  if [ -n "$SESSION_ID" ]; then
    curl -fsS -X POST "http://127.0.0.1:${PORT}/api/sessions/${SESSION_ID}/stop" >/dev/null 2>&1 || true
    curl -fsS -X DELETE "http://127.0.0.1:${PORT}/api/sessions/${SESSION_ID}" >/dev/null 2>&1 || true
    docker rm -f "webx11-${SESSION_ID}" >/dev/null 2>&1 || true
  fi
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}

wait_http() {
  local url="$1"
  for _ in $(seq 1 60); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done
  printf '[real-e2e] timeout waiting for %s\n' "$url" >&2
  return 1
}

json_field() {
  python3 -c "import json,sys; print(json.loads(sys.stdin.read())['$1'])"
}

trap cleanup EXIT

cd "$ROOT_DIR"
if [ "${SKIP_BUILD:-0}" = "1" ]; then
  printf '[real-e2e] SKIP_BUILD=1; using existing image: %s\n' "$IMAGE"
else
  docker build -t "$IMAGE" docker
fi
corepack pnpm --filter @effect-template/app build

cd "$APP_DIR"
PORT="$PORT" node dist/main.js >"$SERVER_LOG" 2>&1 &
SERVER_PID="$!"
wait_http "http://127.0.0.1:${PORT}/api/sessions"

BODY=$(cat <<JSON
{"name":"${SESSION_NAME}","image":"${IMAGE}","app":"${APP}","resolution":{"width":1280,"height":720,"depth":24},"resources":{"cpus":1,"memoryMb":1024,"shmMb":256},"ttlSeconds":3600}
JSON
)

RESP="$(
  curl -fsS -X POST "http://127.0.0.1:${PORT}/api/sessions" \
    -H "content-type: application/json" \
    -d "$BODY"
)"

SESSION_ID="$(printf '%s' "$RESP" | json_field id)"
VIEWER_URL="$(printf '%s' "$RESP" | json_field viewer_url)"
CONTAINER_ID="$(printf '%s' "$RESP" | json_field container_id)"
CONTAINER_IP="$(docker inspect "webx11-${SESSION_ID}" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')"

wait_http "http://127.0.0.1:${PORT}${VIEWER_URL}"
curl -fsS "http://127.0.0.1:${PORT}/api/sessions/${SESSION_ID}/logs" >"$TMP_DIR/session-logs.json"

printf '\n[real-e2e] session id: %s\n' "$SESSION_ID"
printf '[real-e2e] container id: %s\n' "$CONTAINER_ID"
printf '[real-e2e] container ip: %s:6080\n' "$CONTAINER_IP"
printf '[real-e2e] local gateway: http://127.0.0.1:%s%s\n' "$PORT" "$VIEWER_URL"
printf '[real-e2e] browser gateway: http://%s:%s%s\n' "$(hostname -I | awk '{print $1}')" "$PORT" "$VIEWER_URL"
printf '[real-e2e] docker status:\n'
docker ps --filter "name=webx11-${SESSION_ID}" --format '  {{.Names}}  {{.Status}}  {{.Ports}}'
printf '[real-e2e] logs saved: %s\n' "$TMP_DIR/session-logs.json"
printf '[real-e2e] server log: %s\n\n' "$SERVER_LOG"

if [ "${KEEP_ALIVE:-0}" = "1" ]; then
  wait "$SERVER_PID"
fi
