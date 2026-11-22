# HauhauCS Qwen3.6 35B A3B Runtime

This repo has a direct runner for:

`HauhauCS/Qwen3.6-35B-A3B-Uncensored-HauhauCS-Aggressive`

The Hugging Face page publishes GGUF quants and shows `llama-cpp-python` as the
library path. The default local runner uses:

- Repo: `HauhauCS/Qwen3.6-35B-A3B-Uncensored-HauhauCS-Aggressive`
- File: `Qwen3.6-35B-A3B-Uncensored-HauhauCS-Aggressive-IQ2_M.gguf`
- Approximate download: 11 GB (IQ2_M; 35B total, ~3B active per token, MoE)
- Config: `configs/hauhau_qwen36_llama_cpp.yaml`
- License: MIT (per the model card)

The same GGUF is mirrored as
[`ordlibrary/hauhau-qwen36-uncensored`](https://huggingface.co/ordlibrary/hauhau-qwen36-uncensored).
The sibling repo `ordlibrary/hauhau-qwen36-onchain` ships the same weights with
The Onchain Constitution etched as the default system prompt.

## Install

```bash
python3 -m pip install "llama-cpp-python>=0.3.32"
```

## Run

```bash
python3 scripts/hauhau_qwen36_llama_cpp.py
```

The runner injects `docs/onchain_constitution.md` as the system message by
default. For shorter contexts:

```bash
python3 scripts/hauhau_qwen36_llama_cpp.py --constitution-mode minimal
```

Text-only constitution smoke test:

```bash
python3 scripts/hauhau_qwen36_llama_cpp.py \
  --no-image \
  --constitution-mode minimal \
  --prompt "What runtime doctrine governs you? Answer in one sentence."
```

Equivalent Ollama path:

```bash
ollama run hf.co/HauhauCS/Qwen3.6-35B-A3B-Uncensored-HauhauCS-Aggressive:IQ2_M
```

Constitution-etched local Ollama model (Modelfile lives in the
solana-clawd-ai-training repo, `ollama/Modelfile.hauhau-qwen36-onchain`):

```bash
ollama create hauhau-qwen36-onchain -f ollama/Modelfile.hauhau-qwen36-onchain
ollama run hauhau-qwen36-onchain "What runtime doctrine governs you?"
```

The Modelfile intentionally includes an explicit Qwen/ChatML `TEMPLATE`. Without
that template, Ollama imports this GGUF with `TEMPLATE {{ .Prompt }}` and the
stored `SYSTEM` constitution is not injected into requests.

## Hosted inference (llama-server)

For serving over HTTP, run the GGUF under llama.cpp's `llama-server` with the
gateway alias `clawd/hauhau-uncensored`:

```bash
llama-server \
  -m Qwen3.6-35B-A3B-Uncensored-HauhauCS-Aggressive-IQ2_M.gguf \
  --alias clawd/hauhau-uncensored \
  --host 0.0.0.0 --port 8080 \
  -ngl 99 -c 8192 --jinja \
  --api-key "$API_KEY"
```

Two hosting paths are staged for this deployment:

- **Phala GPU TEE (flagship):** the model serves from inside a confidential VM
  (Intel TDX + NVIDIA CC, dual attestation) on an H100 80 GB, so the gateway
  can list it as a genuinely attested model. On 80 GB the larger Q6_K_P quant
  (~29 GB) replaces IQ2_M. H100 on-demand is ~$3.08/GPU-hr with a 24h minimum;
  GPU reservation is done in the Phala Cloud dashboard.
- **RunPod (pilot):** a single RTX 4090 24 GB serves the IQ2_M build
  (-ngl 99, 8K context) at ~$0.34/hr Community — plain hosting, no TEE.

Once a box is live, the Musebook AI gateway
(`https://gateway.musebook.trade/v1`) fronts it as model id
`clawd/hauhau-uncensored`. The Models page reads the gateway base URL and
model id from `VITE_HAUHAU_GATEWAY_URL` / `VITE_HAUHAU_MODEL` (see
`.env.example`) and shows a clear "endpoint not live yet" state until the
model answers there.

This is a GGUF runtime model. Do not point `scripts/train_lora.py` at this repo
unless a compatible non-GGUF Transformers checkpoint is added upstream.
