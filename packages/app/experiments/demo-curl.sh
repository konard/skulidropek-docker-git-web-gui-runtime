#!/usr/bin/env bash
# CHANGE: end-to-end curl demo of POST/GET/DELETE on the running HTTP server
# WHY: capture proof that REST API + gateway routes work without a Docker daemon
# REF: issue#1 sections 8, 9, 12; PR#2 reviewer request for "пруфы"
set -euo pipefail
HOST="${HOST:-http://127.0.0.1:18080}"

bar() { printf '\n\033[1;36m=== %s ===\033[0m\n' "$1"; }
say() { printf '\033[1;33m$ %s\033[0m\n' "$*"; }
pp()  { python3 -m json.tool; }
field() { python3 -c "import json,sys; print(json.loads(sys.stdin.read())['$1'])"; }
listfields() { python3 -c "import json,sys; rows=json.loads(sys.stdin.read()); [print(json.dumps({k:r[k] for k in $1}, indent=2)) for r in rows]"; }

bar "1) GET /api/sessions  (empty list)"
say "curl $HOST/api/sessions"
curl -sS "$HOST/api/sessions"; echo

bar "2) POST /api/sessions  (create xterm session)"
BODY1='{"name":"demo-xterm","image":"web-x11-runtime:latest","app":"xterm","resolution":{"width":1280,"height":720,"depth":24},"resources":{"cpus":1,"memoryMb":512,"shmMb":64},"ttlSeconds":3600}'
say "curl -X POST $HOST/api/sessions -d '<json>'"
RESP1=$(curl -sS -X POST "$HOST/api/sessions" -H "Content-Type: application/json" -d "$BODY1")
echo "$RESP1" | pp
ID1=$(echo "$RESP1" | field id)

bar "3) POST /api/sessions  (create xeyes session)"
BODY2='{"name":"demo-xeyes","image":"web-x11-runtime:latest","app":"xeyes","resolution":{"width":1024,"height":768,"depth":24},"resources":{"cpus":1,"memoryMb":512,"shmMb":64},"ttlSeconds":3600}'
say "curl -X POST $HOST/api/sessions -d '<json>'"
RESP2=$(curl -sS -X POST "$HOST/api/sessions" -H "Content-Type: application/json" -d "$BODY2")
echo "$RESP2" | pp
ID2=$(echo "$RESP2" | field id)

bar "4) GET /api/sessions  (list contains both)"
say "curl $HOST/api/sessions"
curl -sS "$HOST/api/sessions" | listfields '["id","name","status","novnc_port","viewer_url"]'

bar "5) GET /api/sessions/$ID1  (single session)"
say "curl $HOST/api/sessions/$ID1"
curl -sS "$HOST/api/sessions/$ID1" | pp

bar "6) GET /api/sessions/$ID1/logs  (container logs)"
say "curl $HOST/api/sessions/$ID1/logs"
curl -sS "$HOST/api/sessions/$ID1/logs" | pp

bar "7) GET /b/$ID1/vnc.html  (gateway proxy: 502 because the fake noVNC port has no upstream)"
say "curl -i $HOST/b/$ID1/vnc.html"
curl -sS -i "$HOST/b/$ID1/vnc.html" | head -8

bar "8) GET /b/unknown123456/vnc.html  (unknown session → 404)"
say "curl -i $HOST/b/unknown123456/vnc.html"
curl -sS -i "$HOST/b/unknown123456/vnc.html" | head -8

bar "9) GET /api/sessions/00000000dead  (unknown id → 404)"
say "curl -i $HOST/api/sessions/00000000dead"
curl -sS -i "$HOST/api/sessions/00000000dead" | head -8

bar "10) DELETE /api/sessions/$ID2  (FSM rejects: READY→DELETE invalid; status 409)"
say "curl -i -X DELETE $HOST/api/sessions/$ID2"
curl -sS -i -X DELETE "$HOST/api/sessions/$ID2" | head -8

bar "11) GET /api/sessions  (final list — both still READY)"
say "curl $HOST/api/sessions"
curl -sS "$HOST/api/sessions" | listfields '["id","name","status"]'

bar "DONE — REST API and gateway both reachable on a single port"
