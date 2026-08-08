#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# add-shop.sh — Add a new tenant shop port to nginx automatically
#
# Usage:
#   chmod +x add-shop.sh        (first time only)
#   sudo ./add-shop.sh 9100     → adds shop on port 9100
#   sudo ./add-shop.sh 9101     → adds shop on port 9101
#
# After running this script:
#   1. Go to Super Admin panel
#   2. Onboard Shop → Domain field: 72.60.222.141:<PORT>
# ─────────────────────────────────────────────────────────────────────────────

PORT=$1
NGINX_CONF="/etc/nginx/sites-available/allinone"

# ── Validate input ────────────────────────────────────────────────────────────
if [ -z "$PORT" ]; then
  echo "❌ Usage: sudo ./add-shop.sh <PORT>"
  echo "   Example: sudo ./add-shop.sh 9100"
  exit 1
fi

if ! [[ "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -lt 1024 ] || [ "$PORT" -gt 65535 ]; then
  echo "❌ Invalid port: $PORT (must be 1024-65535)"
  exit 1
fi

# ── Check if port already exists in nginx config ──────────────────────────────
if grep -q "listen $PORT;" "$NGINX_CONF"; then
  echo "⚠️  Port $PORT already exists in nginx config. Skipping."
  exit 0
fi

echo "🔧 Adding shop on port $PORT..."

# ── Append server block to nginx config ───────────────────────────────────────
cat >> "$NGINX_CONF" << EOF

# Shop on port $PORT (added $(date '+%Y-%m-%d %H:%M'))
server {
    listen $PORT;
    listen [::]:$PORT;
    server_name _;
    location / {
        proxy_pass         http://127.0.0.1:9095;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host:\$server_port;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
    }
}
EOF

echo "✅ nginx block added for port $PORT"

# ── Open firewall ─────────────────────────────────────────────────────────────
ufw allow "$PORT" > /dev/null 2>&1
echo "✅ Firewall opened for port $PORT"

# ── Test and reload nginx ─────────────────────────────────────────────────────
if nginx -t 2>/dev/null; then
  systemctl reload nginx
  echo "✅ nginx reloaded"
  echo ""
  echo "🎉 Shop port $PORT is ready!"
  echo "   Super Admin → Onboard Shop → Domain: 72.60.222.141:$PORT"
  echo "   Storefront : http://72.60.222.141:$PORT"
  echo "   Admin panel: http://72.60.222.141:$PORT/admin/login"
else
  echo "❌ nginx config test failed — rolling back..."
  head -n -15 "$NGINX_CONF" > /tmp/nginx_rollback && mv /tmp/nginx_rollback "$NGINX_CONF"
  echo "Rolled back. Fix manually and run: sudo nginx -t"
  exit 1
fi
