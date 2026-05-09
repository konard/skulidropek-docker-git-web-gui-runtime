#!/usr/bin/env bash
# CHANGE: real Docker/noVNC proof runner for a VS Code GUI session
# WHY: demonstrate that the runtime can host a full desktop IDE, not only x11-apps
# REF: PR#2 reviewer request for a VS Code screenshot
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BASE_IMAGE="${BASE_IMAGE:-webx11-runtime:latest}"
IMAGE="${IMAGE:-webx11-vscode:latest}"
APP="${START_APP:-code --no-sandbox --disable-gpu --no-first-run --disable-workspace-trust --user-data-dir=/tmp/vscode-user-data --new-window /workspace --wait}"

cd "$ROOT_DIR"
docker build -t "$BASE_IMAGE" docker
docker build \
  --build-arg "BASE_IMAGE=${BASE_IMAGE}" \
  -t "$IMAGE" \
  -f docker/vscode.Dockerfile \
  docker

SKIP_BUILD=1 IMAGE="$IMAGE" START_APP="$APP" SESSION_NAME=real-vscode "$ROOT_DIR/packages/app/experiments/real-e2e.sh"
