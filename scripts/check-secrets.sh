#!/usr/bin/env bash
# check-secrets.sh — secret pattern scanner for git-tracked files.
#
# Runs in the local pre-push hook (.githooks/pre-push) and can also be invoked
# manually:  bash scripts/check-secrets.sh
#
# It scans every file tracked by git (excluding the allowlist below) against
# a registry of secret patterns. A finding blocks the push.
#
# Exit codes:
#   0  no secrets detected
#   1  one or more potential secrets found
#   2  environment error (not a git repo, etc.)

set -o pipefail

# --- Colors (auto-disabled when output isn't a tty, e.g. CI) ----------------
if [ -t 1 ]; then
	C_RED=$'\033[31m'
	C_YELLOW=$'\033[33m'
	C_GREEN=$'\033[32m'
	C_DIM=$'\033[2m'
	C_RESET=$'\033[0m'
else
	C_RED=""
	C_YELLOW=""
	C_GREEN=""
	C_DIM=""
	C_RESET=""
fi

# --- Sanity: must run from a git work tree ----------------------------------
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	printf "%serror:%s not inside a git work tree\n" "$C_RED" "$C_RESET" >&2
	exit 2
fi

# --- Path allowlist ---------------------------------------------------------
# Files/dirs skipped entirely. Add test fixtures or docs that intentionally
# reference key formats. Entries are git pathspecs passed to `:(exclude,...)`.
# Directory entries exclude everything under them.
ALLOW_PATH_SPECS=(
	".env.example"
	"scripts/check-secrets.sh"
	"src/lib/components/ui"
	"tests"
)

# --- Pattern registry -------------------------------------------------------
# To register a new external service's secret format, add ONE line:
#
#   register_pattern "<id>" "<grep-flags>" "<POSIX-ERE-regex>" "<description>"
#
# Constraints (BSD grep on macOS):
#   - Use POSIX ERE only. No \s — use [[:space:]]. No (?i) — pass "-i" as flags.
#   - Quote-aware: the regex is passed unquoted to grep, so escape carefully.
PATTERN_IDS=()
PATTERN_FLAGS=()
PATTERN_REGEX=()
PATTERN_DESC=()

register_pattern() {
	PATTERN_IDS+=("$1")
	PATTERN_FLAGS+=("$2")
	PATTERN_REGEX+=("$3")
	PATTERN_DESC+=("$4")
}

register_pattern "openai-api-key" \
	"" \
	'sk-proj-[A-Za-z0-9_-]{20,}' \
	"OpenAI project-scoped API key"
register_pattern "openai-api-key" \
	"" \
	'sk-[A-Za-z0-9]{40,}' \
	"OpenAI legacy API key"
register_pattern "google-api-key" \
	"" \
	'AIza[0-9A-Za-z_-]{35}' \
	"Google / Gemini API key"
register_pattern "github-pat" \
	"" \
	'gh[pousr]_[A-Za-z0-9]{36,}' \
	"GitHub personal access token"
register_pattern "anthropic-key" \
	"" \
	'sk-ant-[A-Za-z0-9_-]{50,}' \
	"Anthropic API key"
register_pattern "slack-token" \
	"" \
	'xox[baprs]-[A-Za-z0-9-]{10,}' \
	"Slack token"
register_pattern "aws-access-key" \
	"" \
	'AKIA[0-9A-Z]{16}' \
	"AWS access key id"
register_pattern "private-key-block" \
	"" \
	'-----BEGIN [A-Z ]*PRIVATE KEY-----' \
	"PEM private key block"
register_pattern "generic-credential" \
	"-i" \
	"(api[_-]?key|secret|token|password)['\"]?[[:space:]]*[=:][[:space:]]*['\"][^'\"[:space:]]{32,}['\"]" \
	"High-entropy credential assignment (32+ chars, quoted)"

# --- Build git pathspec exclude args ----------------------------------------
EXCLUDE_ARGS=()
for spec in "${ALLOW_PATH_SPECS[@]}"; do
	EXCLUDE_ARGS+=(":(exclude)$spec")
done

# --- Scan -------------------------------------------------------------------
ALLOWLIST_MARKER="pragma: allowlist-secret"
findings=0
total=${#PATTERN_IDS[@]}

printf "%s==>%s Scanning tracked files against %d secret pattern rules...\n" \
	"$C_YELLOW" "$C_RESET" "$total"

any_hit=0
for i in "${!PATTERN_IDS[@]}"; do
	id="${PATTERN_IDS[$i]}"
	flags="${PATTERN_FLAGS[$i]}"
	regex="${PATTERN_REGEX[$i]}"
	desc="${PATTERN_DESC[$i]}"

	# git grep exits 1 when there are no matches — that's success for us.
	# shellcheck disable=SC2086  # intentional word-splitting of $flags
	matches=$(git grep -n -E $flags -e "$regex" -- . "${EXCLUDE_ARGS[@]}" 2>/dev/null || true)

	# Drop lines carrying the inline allowlist marker.
	if [ -n "$matches" ]; then
		matches=$(printf '%s\n' "$matches" | grep -v "$ALLOWLIST_MARKER" || true)
	fi

	if [ -n "$matches" ]; then
		any_hit=1
		findings=$((findings + 1))
		printf "\n%s[%s]%s %s — %s\n" "$C_RED" "$id" "$C_RESET" "$desc" "$regex"
		printf '%s\n' "$matches" | sed "s/^/    $C_DIM/; s/$/$C_RESET/"
	fi
done

# --- Report -----------------------------------------------------------------
if [ "$any_hit" -eq 0 ]; then
	printf "%s✓ No secrets detected.%s\n" "$C_GREEN" "$C_RESET"
	exit 0
fi

printf "\n%s✗ %d pattern group(s) matched potential secrets.%s\n" \
	"$C_RED" "$findings" "$C_RESET"
printf "If a match is a false positive, either:\n"
printf "  1. Add the file/dir to ALLOW_PATH_SPECS in scripts/check-secrets.sh, or\n"
printf "  2. Append this to the offending line:  # pragma: allowlist-secret\n"
printf "\nPush blocked.\n"
exit 1
