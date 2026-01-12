#!/usr/bin/env bash

install_service() {
	local name="$1"
	local user="$2"
	local root="$3"
	local template="$root/deployment/systemd/$name.service"
	local target="/etc/systemd/system/$name.service"

	[ ! -f "$template" ] && {
		echo "Error: Template not found: $name" >&2
		exit 1
	}

	local content
	content=$(sed "s|DEPLOY_USER|$user|g; s|PROJECT_ROOT|$root|g" "$template") || exit 1

	local needs_restart=false

	if [ ! -f "$target" ] || [ "$(sudo cat "$target")" != "$content" ]; then
		echo "$content" | sudo tee "$target" >/dev/null || exit 1
		sudo systemctl daemon-reload || exit 1
		needs_restart=true
	fi

	sudo systemctl is-enabled --quiet "$name" 2>/dev/null || {
		sudo systemctl enable "$name" || exit 1
		needs_restart=true
	}

	if [ "$needs_restart" = true ]; then
		sudo systemctl restart "$name" || exit 1
		echo "$name: restarted"
	else
		echo "$name: running"
	fi

	sudo systemctl is-active --quiet "$name" || {
		echo "Error: $name failed to start" >&2
		sudo systemctl status "$name" --no-pager >&2
		exit 1
	}
}

install_all_services() {
	local user="$1"
	local root="$2"

	install_service "totem-backend" "$user" "$root"
	install_service "totem-frontend" "$user" "$root"
	install_service "totem-notifier" "$user" "$root"
}
