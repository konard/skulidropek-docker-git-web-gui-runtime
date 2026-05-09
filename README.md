# Web-X11 Container Runtime

Run desktop GUI applications inside isolated Docker containers and access them
from a browser via noVNC. Each session is a separate container with its own
X11 display, window manager and noVNC endpoint, fronted by a single REST API
and path-based gateway.

> Implements the spec in [issue #1](https://github.com/skulidropek/docker-git-web-gui-runtime/issues/1).

## Architecture

```text
Browser
  ↓  HTTP / WebSocket
Orchestrator (Effect-TS)
  ├─ /api/sessions*        REST control plane
  └─ /b/<session_id>/*     gateway to per-session noVNC
                              ↓
                            Docker container
                              Xvfb → openbox → x11vnc → websockify → noVNC
                              ↓
                            GUI application (xterm by default)
```

- **CORE** (`packages/app/src/core/`) — pure domain: session FSM, schema, port
  allocator, gateway path parser, docker-run argv builder. No I/O.
- **SHELL** (`packages/app/src/shell/`) — Effect Layers: SessionStore (Ref),
  Docker (CLI exec), HTTP API + gateway (`@effect/platform`), Clock, IdGen.
- **App** (`packages/app/src/app/main.ts`) — wires layers, runs the HTTP server.

## Quick start

### Run a single session container directly

```sh
docker compose up --build
open http://localhost:6080/vnc.html?autoconnect=true
```

This builds `docker/Dockerfile` and exposes the noVNC viewer on port 6080. The
default app is `xterm`; change it via `START_APP` in `docker-compose.yml`.

### Run the orchestrator

```sh
cd packages/app
pnpm install
pnpm run build
PORT=8080 pnpm run start
```

Then create a session and open the viewer URL the API returns:

```sh
curl -sX POST http://localhost:8080/api/sessions \
  -H 'content-type: application/json' \
  -d '{
    "name": "demo",
    "image": "webx11-runtime:latest",
    "app": "/usr/bin/xterm",
    "resolution": { "width": 1280, "height": 720, "depth": 24 },
    "resources":  { "cpus": 1, "memoryMb": 1024, "shmMb": 256 },
    "ttlSeconds": 3600
  }'
# → { "id": "...", "viewer_url": "/b/<id>/vnc.html?autoconnect=true&...", ... }
```

## REST API

| Method | Path                          | Body / Result                       |
|--------|-------------------------------|-------------------------------------|
| POST   | `/api/sessions`               | create session → `201 Session DTO`  |
| GET    | `/api/sessions`               | list sessions                       |
| GET    | `/api/sessions/:id`           | get one (404 if unknown)            |
| GET    | `/api/sessions/:id/logs`      | container logs `{ lines: [...] }`   |
| POST   | `/api/sessions/:id/stop`      | drive STOPPING → STOPPED            |
| DELETE | `/api/sessions/:id`           | requires STOPPED first; else 409    |
| GET    | `/b/<session_id>/<sub>`       | gateway to in-container noVNC       |
| WS     | `/b/<session_id>/websockify`  | proxied VNC stream                  |

## Security hardening (per ТЗ §11)

Every session container is launched with:

- `--cap-drop ALL`
- `--security-opt no-new-privileges:true`
- `--pids-limit 512`
- `--memory`, `--cpus`, `--shm-size` from the create payload
- `x11vnc -localhost` — the raw VNC port is **never** published; only noVNC is

The orchestrator never passes `--privileged` and never mounts the host X11
socket. See `packages/app/src/core/session/docker-args.ts` and the hardening
test in `packages/app/tests/core/session/docker-args.test.ts`.

## Development

```sh
cd packages/app
pnpm run lint        # vibecode-linter (eslint + biome + tsc + jscpd) on src/
pnpm run lint:tests  # same on tests/
pnpm run test        # 108 vitest cases, CORE pure + SHELL with fake Docker
pnpm run typecheck   # tsc --noEmit
```

## Layout

```text
docker-compose.yml          ← MVP compose for the runtime container (ТЗ §17)
docker/                     ← Dockerfile + entrypoint.sh for the runtime image
docs/screenshots/           ← screenshots referenced from PRs / docs
packages/app/
  src/
    core/                   ← pure domain (gateway path, FSM, docker argv, …)
    shell/services/         ← Docker, SessionStore, SessionManager, Clock, IdGen
    shell/http/             ← /api/* + /b/<id>/* routers, server wiring
    app/main.ts             ← Layer composition + NodeRuntime entry point
  tests/
    core/                   ← pure tests (108-test suite)
    shell/                  ← integration tests with fake Docker
```
