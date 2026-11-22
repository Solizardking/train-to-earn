# Solana CLAWD LoRA Output

The archived Solana CLAWD LoRA output is at:

```bash
/Users/8bit/Downloads/solana-clawd/ai-training/outputs/imported-root-outputs-20260704/solana-clawd-1.5b-lora/checkpoint-3
```

Inspect it from this repo with:

```bash
npm run check:solana-lora
```

Strict mode exits non-zero if the adapter is not runnable:

```bash
node scripts/inspect-solana-clawd-lora.mjs --strict
```

## Current Compatibility

The checkpoint metadata says:

- Base model: `Qwen/Qwen2.5-1.5B-Instruct`
- Adapter type: PEFT `LORA`
- Task: `CAUSAL_LM`
- Rank / alpha: `16 / 32`

Do not attach this adapter to the Nemotron Jetson server. The Jetson serve path
uses `nvidia/NVIDIA-Nemotron-3-Nano-4B-GGUF`, while this adapter was trained
against Qwen 2.5 1.5B. LoRA adapters must match the base model family and tensor
layout they were trained for.

## Current Local Issue

The discovered checkpoint currently contains config and tokenizer metadata, but
not runnable adapter weights:

- Missing `adapter_model.safetensors`, `adapter_model.bin`, or `adapter_model.gguf`
- `tokenizer.json` exists but is zero bytes

Until those files are restored, this checkpoint can be cataloged and inspected
but cannot be loaded for inference.

## Valid Use Paths

Use the adapter with Transformers/PEFT after restoring the adapter weights:

```python
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

lora_dir = "/Users/8bit/Downloads/solana-clawd/ai-training/outputs/imported-root-outputs-20260704/solana-clawd-1.5b-lora/checkpoint-3"
base_id = "Qwen/Qwen2.5-1.5B-Instruct"

tokenizer = AutoTokenizer.from_pretrained(base_id)
base = AutoModelForCausalLM.from_pretrained(base_id, device_map="auto")
model = PeftModel.from_pretrained(base, lora_dir)
```

For llama.cpp or Jetson deployment, first merge the adapter into the Qwen base
model, then convert the merged Qwen model to GGUF. Serve that converted Qwen
GGUF separately from the Nemotron model.
