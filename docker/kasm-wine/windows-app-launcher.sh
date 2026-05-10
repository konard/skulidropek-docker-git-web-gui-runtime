#!/usr/bin/env bash
set -euo pipefail

export WINEARCH="${WINEARCH:-win64}"
export WINEPREFIX="${WINEPREFIX:-${HOME}/.wine}"

mkdir -p "${WINEPREFIX}" "${HOME}/Downloads" "${HOME}/WindowsApps"

if [ "$#" -gt 0 ]; then
  exec wine "$@"
fi

selected="$(
  zenity \
    --file-selection \
    --title="Select a Windows installer or app" \
    --filename="${HOME}/Downloads/" \
    --file-filter="Windows installers and apps | *.exe *.EXE *.msi *.MSI" \
    --file-filter="All files | *" \
    || true
)"

if [ -z "${selected}" ]; then
  exec xfce4-terminal \
    --title="Wine Desktop" \
    --working-directory="${HOME}/Downloads" \
    --command='bash -lc "echo Wine Desktop is ready.; echo Put .exe or .msi files in Downloads, then run: wine ./app.exe; exec bash"'
fi

case "${selected}" in
  *.msi | *.MSI)
    exec wine msiexec /i "${selected}"
    ;;
  *)
    exec wine "${selected}"
    ;;
esac
