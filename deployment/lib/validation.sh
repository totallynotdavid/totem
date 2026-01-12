#!/usr/bin/env bash

trim() {
	local var="$1"
	var="${var#"${var%%[![:space:]]*}"}"
	var="${var%"${var##*[![:space:]]}"}"
	echo "$var"
}

is_valid() {
	local value="$1"
	[ -n "$value" ] && [ "$value" != "null" ]
}

prompt_required() {
	local name="$1"
	local value

	read -p "$name: " value
	value=$(trim "$value")

	if ! is_valid "$value"; then
		echo "Error: $name is required" >&2
		exit 1
	fi

	echo "$value"
}

prompt_secret() {
	local name="$1"
	local value

	read -s -p "$name: " value
	echo >&2
	value=$(trim "$value")

	if ! is_valid "$value"; then
		echo "Error: $name is required" >&2
		exit 1
	fi

	echo "$value"
}

prompt_optional() {
	local name="$1"
	local value

	read -p "$name (optional): " value
	value=$(trim "$value")

	if is_valid "$value"; then
		echo "$value"
	fi
}
