#!/usr/bin/env bash
set -euo pipefail

IMAGE="${NEMOTRON_IMAGE:-ghcr.io/nvidia-ai-iot/llama_cpp:latest-jetson-orin}"
HF_REPO="${NEMOTRON_HF_REPO:-nvidia/NVIDIA-Nemotron-3-Nano-4B-GGUF}"
HF_FILE="${NEMOTRON_HF_FILE:-NVIDIA-Nemotron3-Nano-4B-Q4_K_M.gguf}"
CTX_SIZE="${NEMOTRON_CTX_SIZE:-8192}"
MODEL_ALIAS="${NEMOTRON_ALIAS:-my_model}"
GPU_LAYERS="${NEMOTRON_GPU_LAYERS:-999}"
HOST="${NEMOTRON_HOST:-0.0.0.0}"
PORT="${NEMOTRON_PORT:-8080}"
CACHE_DIR="${NEMOTRON_HF_CACHE:-${HF_HOME:-$HOME/.cache/huggingface}}"
DOCKER_BIN="${DOCKER_BIN:-docker}"
USE_SUDO="${NEMOTRON_USE_SUDO:-auto}"

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

warn() {
  printf 'warning: %s\n' "$*" >&2
}

command -v "$DOCKER_BIN" >/dev/null 2>&1 || die "docker is not installed or not on PATH"

if [[ "$(uname -s)" != "Linux" ]]; then
  warn "this NVIDIA Jetson container is intended for Linux/Jetson Orin; current OS is $(uname -s)"
fi

mkdir -p "$CACHE_DIR"

DOCKER_CMD=("$DOCKER_BIN")
if ! "$DOCKER_BIN" info >/dev/null 2>&1; then
  if [[ "$USE_SUDO" == "true" || "$USE_SUDO" == "auto" ]]; then
    command -v sudo >/dev/null 2>&1 || die "docker daemon is not reachable and sudo is unavailable"
    DOCKER_CMD=(sudo "$DOCKER_BIN")
  else
    die "docker daemon is not reachable"
  fi
fi

"${DOCKER_CMD[@]}" info >/dev/null 2>&1 || die "docker daemon is not reachable"

RUNTIMES="$("${DOCKER_CMD[@]}" info --format '{{json .Runtimes}}' 2>/dev/null || true)"
if [[ "$RUNTIMES" != *'"nvidia"'* ]]; then
  die "docker runtime 'nvidia' is not available; install NVIDIA Container Toolkit on the Jetson host"
fi

exec "${DOCKER_CMD[@]}" run -it --rm --pull always \
  --runtime=nvidia \
  --network host \
  -v "$CACHE_DIR:/root/.cache/huggingface" \
  "$IMAGE" \
  llama-server \
  --hf-repo "$HF_REPO" \
  --hf-file "$HF_FILE" \
  --ctx-size "$CTX_SIZE" \
  --alias "$MODEL_ALIAS" \
  --n-gpu-layers "$GPU_LAYERS" \
  --host "$HOST" \
  --port "$PORT"
