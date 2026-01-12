#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_USER="${SUDO_USER:-$USER}"

[ ! -d "$SCRIPT_DIR/lib" ] && { echo "Error: Missing lib directory" >&2; exit 1; }

source "$SCRIPT_DIR/lib/tools.sh"
source "$SCRIPT_DIR/lib/env.sh"
source "$SCRIPT_DIR/lib/services.sh"

setup_environment() {
    local env_file="$PROJECT_ROOT/.env.production"
    
    [ -f "$env_file" ] && return 0
    
    echo "Environment setup"
    
    JWT_SECRET=$(openssl rand -base64 32)
    PUBLIC_URL=$(get_public_url "$PROJECT_ROOT")
    
    collect_whatsapp_vars
    collect_calidda_vars
    collect_powerbi_vars
    collect_optional_vars
    
    generate_env_file "$env_file"
}

main() {
    install_mise
    setup_tools "$PROJECT_ROOT"
    setup_environment
    build_project "$PROJECT_ROOT"
    install_all_services "$DEPLOY_USER" "$PROJECT_ROOT"
    
    echo "Deployed: http://$(hostname -I | awk '{print $1}')"
}

main
