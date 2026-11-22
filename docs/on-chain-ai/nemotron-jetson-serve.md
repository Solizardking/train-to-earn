# Nemotron 3 Nano Jetson Serve

This repo includes a repeatable serve script for the NVIDIA Jetson Orin llama.cpp
container path:

```bash
scripts/serve-nemotron-jetson.sh
```

The script serves:

- Container: `ghcr.io/nvidia-ai-iot/llama_cpp:latest-jetson-orin`
- Model repo: `nvidia/NVIDIA-Nemotron-3-Nano-4B-GGUF`
- Model file: `NVIDIA-Nemotron3-Nano-4B-Q4_K_M.gguf`
- Alias: `my_model`
- Context: `8192`
- GPU layers: `999`
- Port: `8080`

It also fixes the cache mount from the pasted command:

```bash
-v "$HOME/.cache/huggingface:/root/.cache/huggingface"
```

## Requirements

Run this on the Jetson Orin host, not macOS:

- Jetson Linux / Ubuntu
- Docker daemon running
- NVIDIA Container Toolkit installed
- Docker has the `nvidia` runtime
- Enough disk space for the GGUF in the Hugging Face cache

Quick preflight:

```bash
docker info --format '{{json .Runtimes}}'
```

The output must include `nvidia`.

## Equivalent Raw Command

```bash
sudo docker run -it --rm --pull always \
  --runtime=nvidia \
  --network host \
  -v "$HOME/.cache/huggingface:/root/.cache/huggingface" \
  ghcr.io/nvidia-ai-iot/llama_cpp:latest-jetson-orin \
  llama-server \
  --hf-repo nvidia/NVIDIA-Nemotron-3-Nano-4B-GGUF \
  --hf-file NVIDIA-Nemotron3-Nano-4B-Q4_K_M.gguf \
  --ctx-size 8192 \
  --alias my_model \
  --n-gpu-layers 999 \
  --host 0.0.0.0 \
  --port 8080
```

## Overrides

The script is controlled with environment variables:

```bash
NEMOTRON_CTX_SIZE=8196 scripts/serve-nemotron-jetson.sh
NEMOTRON_ALIAS=nemotron3-nano NEMOTRON_PORT=8081 scripts/serve-nemotron-jetson.sh
NEMOTRON_HF_CACHE=/mnt/ssd/huggingface scripts/serve-nemotron-jetson.sh
```

## API Smoke Test

Once running:

```bash
curl http://127.0.0.1:8080/v1/models
```

OpenAI-compatible chat completion:

```bash
curl http://127.0.0.1:8080/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "my_model",
    "messages": [
      { "role": "user", "content": "Give one sentence about Solana compute markets." }
    ],
    "max_tokens": 80,
    "temperature": 0.2
  }'
```

## Solana CLAWD LoRA

The archived Solana CLAWD LoRA output under
`/Users/8bit/Downloads/solana-clawd/ai-training/outputs/imported-root-outputs-20260704/solana-clawd-1.5b-lora`
is a Qwen 2.5 1.5B PEFT adapter, not a Nemotron adapter. Do not add it to this
Nemotron serve command. See [Solana CLAWD LoRA Output](solana-clawd-lora.md) for
the separate compatibility path.

## Note On The Attachment

The attached Nemotron 3 Nano Omni note describes the larger multimodal Omni line
for document, image, video, and audio reasoning. The serve command above is for
the text GGUF runtime model `nvidia/NVIDIA-Nemotron-3-Nano-4B-GGUF`, which is the
variant supported by the Jetson llama.cpp container path.
