# syntax=docker/dockerfile:1.7
# CHANGE: optional VS Code proof image layered on top of the base Web-X11 runtime
# WHY: keep the required minimal runtime image small while proving a real desktop IDE
#      can run through the same Xvfb/x11vnc/noVNC pipeline.
# REF: PR#2 reviewer request for a VS Code screenshot
# SOURCE: https://code.visualstudio.com/docs/setup/linux
# PURITY: SHELL (build-time)
# INVARIANT: the image still exposes only the inherited noVNC endpoint on 6080.
ARG BASE_IMAGE=webx11-runtime:latest
FROM ${BASE_IMAGE}

ENV VSCODE_USER_DATA_DIR=/tmp/vscode-user-data \
    VSCODE_WORKSPACE=/workspace \
    START_APP="code --no-sandbox --disable-gpu --no-first-run --disable-workspace-trust --user-data-dir=/tmp/vscode-user-data --new-window /workspace --wait"

RUN apt-get update && apt-get install -y --no-install-recommends \
        gpg \
        wget \
    && wget -qO- https://packages.microsoft.com/keys/microsoft.asc \
        | gpg --dearmor -o /usr/share/keyrings/microsoft.gpg \
    && printf '%s\n' \
        'Types: deb' \
        'URIs: https://packages.microsoft.com/repos/code' \
        'Suites: stable' \
        'Components: main' \
        'Architectures: amd64,arm64,armhf' \
        'Signed-By: /usr/share/keyrings/microsoft.gpg' \
        > /etc/apt/sources.list.d/vscode.sources \
    && printf '%s\n' \
        'Package: code' \
        'Pin: origin "packages.microsoft.com"' \
        'Pin-Priority: 9999' \
        > /etc/apt/preferences.d/code \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        code \
        git \
        fonts-dejavu \
        fonts-liberation \
    && mkdir -p "${VSCODE_WORKSPACE}" "${VSCODE_USER_DATA_DIR}" \
    && printf '# Web-X11 VS Code proof\n\nThis folder is opened by VS Code inside the noVNC session.\n' \
        > "${VSCODE_WORKSPACE}/README.md" \
    && rm -rf /var/lib/apt/lists/*
