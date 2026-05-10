# syntax=docker/dockerfile:1.7
# CHANGE: Kasm-compatible Wine desktop image
# WHY: Windows app testing needs a Kasm tile that can run simple .exe/.msi files through Wine.
# QUOTE(TZ): "Один установить VM, другой попробовать wine?"
# REF: user request 2026-05-09
# SOURCE: https://docs.kasm.com/docs/latest/guide/custom_images/index.html
# PURITY: SHELL (build-time)
# INVARIANT: image keeps the standard KasmVNC entrypoint and exposes Kasm's noVNC port 6901
FROM kasmweb/ubuntu-jammy-desktop:1.18.0

USER root

ENV DEBIAN_FRONTEND=noninteractive \
    WINEARCH=win64 \
    WINEPREFIX=/home/kasm-user/.wine

RUN dpkg --add-architecture i386 \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        cabextract \
        fonts-wine \
        p7zip-full \
        unzip \
        wine \
        wine32 \
        wine64 \
        winetricks \
        xdg-utils \
    && rm -rf /var/lib/apt/lists/*

COPY windows-app-launcher.sh /usr/local/bin/windows-app-launcher
COPY windows-app-launcher.desktop /home/kasm-default-profile/Desktop/windows-app-launcher.desktop

RUN chmod +x /usr/local/bin/windows-app-launcher \
    && chmod +x /home/kasm-default-profile/Desktop/windows-app-launcher.desktop \
    && mkdir -p /home/kasm-default-profile/Downloads /home/kasm-default-profile/WindowsApps \
    && chown -R 1000:0 /home/kasm-default-profile

USER 1000
