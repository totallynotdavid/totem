#!/usr/bin/env bash

install_mise() {
	command -v mise &>/dev/null && return 0

	curl -fsSL https://mise.run | sh || exit 1
	export PATH="$HOME/.local/bin:$PATH"
	eval "$(mise activate bash)"
}

setup_tools() {
	local root="$1"

	[ ! -d "$root" ] && {
		echo "Error: Invalid project root" >&2
		exit 1
	}

	cd "$root" || exit 1
	mise install || exit 1

	local bun_path
	bun_path=$(mise where bun)/bin/bun
	[ ! -f "$bun_path" ] && {
		echo "Error: Bun not installed" >&2
		exit 1
	}

	sudo setcap 'cap_net_bind_service=+ep' "$bun_path" || exit 1
	[ ! -L /usr/local/bin/bun ] && sudo ln -sf "$bun_path" /usr/local/bin/bun
}

build_project() {
	local root="$1"

	cd "$root" || exit 1
	[ ! -d "node_modules" ] && { bun install || exit 1; }

	cd apps/frontend || exit 1
	bun run build || exit 1
}
