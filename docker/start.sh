#!/bin/sh
set -eu

: "${BROWSER_ACCESS_TOKEN:?BROWSER_ACCESS_TOKEN must be set in Render}"

rm -f /tmp/.X99-lock || true
Xvfb :99 -screen 0 1440x900x24 -ac >/var/log/xvfb.log 2>&1 &
export DISPLAY=:99

x11vnc -display :99 -forever -shared -rfbport 5900 -nopw -localhost >/var/log/x11vnc.log 2>&1 &
websockify --web=/usr/share/novnc 6080 localhost:5900 >/var/log/websockify.log 2>&1 &

envsubst '${BROWSER_ACCESS_TOKEN}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
nginx -g 'daemon off;' >/var/log/nginx.log 2>&1 &
nginx_pid=$!

node dist/index.js &
node_pid=$!

cleanup() {
  kill "$node_pid" "$nginx_pid" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

wait "$node_pid"
