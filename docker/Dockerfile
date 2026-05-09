# syntax=docker/dockerfile:1.7
# QUOTE(TZ): "FROM ubuntu:24.04 ... apt-get install -y xvfb x11vnc openbox novnc websockify xterm x11-apps dbus-x11 ca-certificates curl"
# REF: issue#1 section 6.1 "Базовый Dockerfile"
# PURITY: SHELL (build-time)
# INVARIANT: image exposes a single noVNC endpoint on ${NOVNC_PORT}, never the raw VNC port
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    DISPLAY=:99 \
    VNC_PORT=5900 \
    NOVNC_PORT=6080 \
    SCREEN_WIDTH=1280 \
    SCREEN_HEIGHT=720 \
    SCREEN_DEPTH=24 \
    START_APP=xterm

RUN apt-get update && apt-get install -y --no-install-recommends \
        xvfb \
        x11vnc \
        openbox \
        novnc \
        websockify \
        xterm \
        x11-apps \
        dbus-x11 \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

# QUOTE(TZ): "x11vnc слушает только 127.0.0.1 внутри контейнера / наружу открыт только noVNC"
# REF: issue#1 section 11.2
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 6080

# QUOTE(TZ): "контейнер running / порт 6080 доступен / websockify отвечает"
# REF: issue#1 section 12.5
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${NOVNC_PORT}/" >/dev/null || exit 1

CMD ["/entrypoint.sh"]
