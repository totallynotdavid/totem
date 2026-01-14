setup_nginx() {
	local nginx_config="/etc/nginx/sites-available/totem"

	if [ ! -f "$nginx_config" ]; then
		cat >"$nginx_config" <<'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 10M;

    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
		ln -sf "$nginx_config" /etc/nginx/sites-enabled/
		systemctl reload nginx
		substep "nginx configured"
	else
		substep "nginx already configured"
	fi
}
