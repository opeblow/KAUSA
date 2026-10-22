#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Kausa Codespace bootstrap — Zetaris AI Data Harness (+ Meterless engines)
#
# What it does, idempotently, every time the Codespace starts:
#   1. Waits for Docker (dockerd from the docker-in-docker feature).
#   2. Authenticates to the hackathon registry  zetarishackathon.azurecr.io.
#   3. Locates zetaris-platform.zip, extracts it into $ZETARIS_DIR.
#   4. Runs the bundle's `bash ./preflight.sh`.
#   5. `docker compose pull` + `docker compose up -d`.
#   6. Prints the public Codespaces URLs for ports 3000 (Zetaris Gateway) and
#      8088 (Meterless).
#
# Registry auth uses these values (already provided by devcontainer.json):
#   ZETARIS_ACR_REGISTRY = zetarishackathon.azurecr.io
#   ZETARIS_ACR_USERNAME = zethackuser2b56a0515cc24dae98b5d8ba1c3be779
# The password is NOT hard-coded. Provide it as one of:
#   - Codespaces secret / env var : ZETARIS_ACR_PASSWORD
#   - a file                     : ZETARIS_ACR_PASSWORD_FILE   (e.g. .devcontainer/.acr-password)
# Get the password from the Zetaris dashboard -> Hackathon -> "Run locally"
# (the same panel that shows `docker login zetarishackathon.azurecr.io`).
#
# The zip itself is downloaded from the same dashboard ("Download
# zetaris-platform.zip"). Drop it at the repo root, or point to it with
# ZETARIS_BUNDLE, or fetch it with ZETARIS_BUNDLE_URL.
#
# Usage:
#   bash .devcontainer/start-zetaris.sh            # up (idempotent)
#   bash .devcontainer/start-zetaris.sh --status   # show container status
#   bash .devcontainer/start-zetaris.sh --logs     # follow compose logs
#   bash .devcontainer/start-zetaris.sh --down     # stop the stack
# ---------------------------------------------------------------------------
set -euo pipefail

# --- config (override via env) ---------------------------------------------
ACR_REGISTRY="${ZETARIS_ACR_REGISTRY:-zetarishackathon.azurecr.io}"
ACR_USERNAME="${ZETARIS_ACR_USERNAME:-zethackuser2b56a0515cc24dae98b5d8ba1c3be779}"
ACR_PASSWORD="${ZETARIS_ACR_PASSWORD:-}"
ACR_PASSWORD_FILE="${ZETARIS_ACR_PASSWORD_FILE:-}"
BUNDLE_NAME="zetaris-platform.zip"
BUNDLE_URL="${ZETARIS_BUNDLE_URL:-}"
WORKSPACE="${GITHUB_WORKSPACE:-/workspaces/$(basename "$PWD")}"
WORK_DIR="${ZETARIS_DIR:-$PWD/zetaris}"
COMPOSE_WAIT_SECS=180

C_OK=$'\033[32m'; C_WARN=$'\033[33m'; C_ERR=$'\033[31m'; C_DIM=$'\033[2m'; C_RST=$'\033[0m'
log()  { printf '%s[start-zetaris]%s %s\n' "$C_DIM" "$C_RST" "$*"; }
ok()   { printf '%s[start-zetaris]%s %s\n' "$C_OK" "$C_RST" "$*"; }
warn() { printf '%s[start-zetaris]%s %s\n' "$C_WARN" "$C_RST" "$*" >&2; }
die()  { printf '%s[start-zetaris]%s %s\n' "$C_ERR" "$C_RST" "$*" >&2; exit 1; }

MODE="${1:-up}"
MODE="${MODE#--}"   # accept both "status" and "--status"

# --- docker helper ----------------------------------------------------------
wait_for_docker() {
  log "Waiting for Docker daemon…"
  local i=0
  until docker info >/dev/null 2>&1; do
    i=$((i + 1))
    if [ "$i" -ge "$COMPOSE_WAIT_SECS" ]; then
      die "Docker daemon did not become ready after ${COMPOSE_WAIT_SECS}s."
    fi
    sleep 1
  done
  ok "Docker is ready ($(docker --version | sed 's/,.*//'))."
}

detect_compose() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE="docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE="docker-compose"
  else
    die "Neither 'docker compose' nor 'docker-compose' is available."
  fi
  log "Using compose: $COMPOSE"
}

# --- registry auth ----------------------------------------------------------
read_password() {
  if [ -n "$ACR_PASSWORD" ]; then return 0; fi
  if [ -n "$ACR_PASSWORD_FILE" ] && [ -f "$ACR_PASSWORD_FILE" ]; then
    ACR_PASSWORD="$(tr -d '\r\n' < "$ACR_PASSWORD_FILE")"
    if [ -n "$ACR_PASSWORD" ]; then return 0; fi
  fi
  # Fallback conventions.
  for f in "$WORKSPACE/.devcontainer/.acr-password" "$PWD/.devcontainer/.acr-password" "${HOME}/.acr-password"; do
    if [ -f "$f" ]; then
      ACR_PASSWORD="$(tr -d '\r\n' < "$f")"
      [ -n "$ACR_PASSWORD" ] && return 0
    fi
  done
  return 1
}

registry_login() {
  if ! read_password; then
    warn "ZETARIS_ACR_PASSWORD is not set — skipping registry login."
    warn "Set it as a Codespaces secret, or write it to .devcontainer/.acr-password."
    warn "Get it from the Zetaris dashboard -> Hackathon -> Run locally."
    return 0
  fi
  log "Authenticating to ${ACR_REGISTRY} as ${ACR_USERNAME}…"
  if printf '%s' "$ACR_PASSWORD" | docker login "$ACR_REGISTRY" \
      --username "$ACR_USERNAME" --password-stdin >/dev/null 2>&1; then
    ok "Logged in to ${ACR_REGISTRY}."
  else
    die "docker login to ${ACR_REGISTRY} failed — check the username/password."
  fi
}

# --- locate + extract the bundle -------------------------------------------
find_bundle() {
  [ -n "${ZETARIS_BUNDLE:-}" ] && [ -f "${ZETARIS_BUNDLE:-}" ] && { echo "$ZETARIS_BUNDLE"; return 0; }
  local candidates=(
    "$PWD/$BUNDLE_NAME"
    "$WORK_DIR/$BUNDLE_NAME"
    "$WORKSPACE/$BUNDLE_NAME"
    "$HOME/$BUNDLE_NAME"
    "$HOME/downloads/$BUNDLE_NAME"
    "$HOME/Downloads/$BUNDLE_NAME"
    "/tmp/$BUNDLE_NAME"
  )
  local pat
  for pat in /workspaces/*/"$BUNDLE_NAME" "$HOME"/*/"$BUNDLE_NAME"; do
    candidates+=("$pat")
  done
  local c
  for c in "${candidates[@]}"; do
    if [ -f "$c" ]; then echo "$c"; return 0; fi
  done
  return 1
}

ensure_unzip() {
  command -v unzip >/dev/null 2>&1 && return 0
  log "Installing unzip…"
  if command -v sudo >/dev/null 2>&1; then
    sudo apt-get update -qq && sudo apt-get install -y -qq unzip
  else
    apt-get update -qq && apt-get install -y -qq unzip
  fi
}

extract_bundle() {
  # Already extracted (preflight.sh present)? Nothing to do.
  if [ -f "$WORK_DIR/preflight.sh" ]; then
    ok "Bundle already extracted at $WORK_DIR."
    return 0
  fi

  local zip
  if ! zip="$(find_bundle)"; then
    if [ -n "$BUNDLE_URL" ]; then
      zip="$WORK_DIR/$BUNDLE_NAME"
      mkdir -p "$WORK_DIR"
      log "Downloading bundle from ZETARIS_BUNDLE_URL…"
      curl -fL "$BUNDLE_URL" -o "$zip" || die "Failed to download the bundle."
    else
      die "Could not find ${BUNDLE_NAME}. Place it at the repo root (or set ZETARIS_BUNDLE / ZETARIS_BUNDLE_URL)."
    fi
  fi

  log "Extracting $(basename "$zip") -> $WORK_DIR …"
  ensure_unzip
  mkdir -p "$WORK_DIR"
  local tmp; tmp="$(mktemp -d)"
  unzip -q -o "$zip" -d "$tmp"

  # The zip may nest everything under a single top-level folder.
  if [ ! -f "$tmp/preflight.sh" ] && [ ! -f "$tmp/docker-compose.yml" ]; then
    local only
    only="$(find "$tmp" -mindepth 1 -maxdepth 1 -type d | head -n1 || true)"
    if [ -n "$only" ] && { [ -f "$only/preflight.sh" ] || [ -f "$only/docker-compose.yml" ]; }; then
      tmp="$only"
    fi
  fi

  # Move contents into WORK_DIR.
  shopt -s dotglob
  cp -a "$tmp"/. "$WORK_DIR"/
  shopt -u dotglob
  rm -rf "$tmp"
  ok "Extracted to $WORK_DIR."
}

# --- compose -----------------------------------------------------------------
compose_file() {
  for f in docker-compose.yml docker-compose.yaml compose.yml compose.yaml; do
    [ -f "$WORK_DIR/$f" ] && { echo "$f"; return 0; }
  done
  return 1
}

preflight() {
  if [ -f "$WORK_DIR/preflight.sh" ]; then
    log "Running preflight.sh…"
    ( cd "$WORK_DIR" && bash ./preflight.sh ) || warn "preflight.sh returned non-zero; continuing."
    ok "preflight.sh complete."
  else
    warn "No preflight.sh found in $WORK_DIR — skipping."
  fi
}

bring_up() {
  local cf; cf="$(compose_file)" || die "No compose file found in $WORK_DIR."
  ( cd "$WORK_DIR" \
    && $COMPOSE -f "$cf" pull --ignore-pull-failures \
    && $COMPOSE -f "$cf" up -d )
  ok "Zetaris stack is up."
  ( cd "$WORK_DIR" && $COMPOSE -f "$cf" ps ) || true
}

print_urls() {
  local base=""
  if [ -n "${CODESPACE_NAME:-}" ]; then
    base="https://${CODESPACE_NAME}-"
    echo
    ok "Public (forwarded) endpoints:"
    echo "  Zetaris Gateway : ${base}3000.app.github.dev"
    echo "  Meterless       : ${base}8088.app.github.dev"
  else
    echo
    ok "Endpoints (local):"
    echo "  Zetaris Gateway : http://localhost:3000"
    echo "  Meterless       : http://localhost:8088"
  fi
  cat <<'EOF'

  Default Zetaris login (from the bundle docs): admin@zetaris.com / P@55w0rd! / Zetaris
  Port 8088 (Meterless): the Nightshift runtime is hardware-locked (Apple M5+ / DGX
  Spark) and will not run here — the port is forwarded so a remote/paired Meterless
  endpoint can be reached. The H-MEM engine Kausa uses is integrated in the app.

  After the stack is up, point Kausa at it:
    ZETARIS_BASE_URL   = https://<codespace>-3000.app.github.dev
    ZETARIS_SOURCE     = <schema.table from the bundle>
  then redeploy the Convex backend.
EOF
}

# --- main --------------------------------------------------------------------
case "$MODE" in
  down)
    wait_for_docker; detect_compose
    cf="$(compose_file)" || die "No compose file found in $WORK_DIR."
    ( cd "$WORK_DIR" && $COMPOSE -f "$cf" down )
    ok "Zetaris stack stopped."
    ;;
  logs)
    wait_for_docker; detect_compose
    cf="$(compose_file)" || die "No compose file found in $WORK_DIR."
    ( cd "$WORK_DIR" && $COMPOSE -f "$cf" logs -f --tail=200 )
    ;;
  status)
    wait_for_docker; detect_compose
    cf="$(compose_file)" || die "No compose file found in $WORK_DIR."
    ( cd "$WORK_DIR" && $COMPOSE -f "$cf" ps )
    ;;
  up|"")
    wait_for_docker
    detect_compose
    registry_login
    extract_bundle
    preflight
    bring_up
    print_urls
    ;;
  *)
    die "Unknown mode '$MODE'. Use: up | down | logs | status."
    ;;
esac
