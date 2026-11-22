# Vision Models for On-Chain AI

Vision language models extend the Train2Earn model workflow from text-only
assistants to multimodal assistants that can read screenshots, charts, diagrams,
NFT metadata images, and dashboard views.

For beginner projects, use `HuggingFaceTB/SmolVLM2-2.2B-Instruct` as the
instruction-tuned starting point and keep the task narrow.

## What VLMs Add

Text-only models can explain a transaction if the data is already structured.
Vision language models can answer questions about visual inputs:

- Wallet dashboards.
- Token allocation charts.
- Candlestick screenshots.
- DAO treasury charts.
- Model registry diagrams.
- NFT or marketplace screenshots.

The model should answer only from visible evidence unless you also pass
structured context.

## Architecture Mental Model

```text
Image
  -> vision encoder
  -> projector or fusion layer
  -> language decoder
  -> grounded text answer
```

For Train2Earn, the same registry model still applies:

```text
VLM model artifact
  -> Hugging Face Hub
  -> model card and eval results
  -> Arweave/IPFS registration document
  -> MPL Core model asset
  -> model identity PDA
```

## Beginner Use Cases

| Use case | Example prompt |
|----------|----------------|
| Portfolio dashboard reading | "What asset has the largest visible allocation?" |
| Risk-panel explanation | "Which warning label is shown and what does it mean?" |
| Transaction-table OCR | "List the visible token transfers in this screenshot." |
| NFT metadata review | "Does this image appear to contain an external link or phishing prompt?" |
| Model registry diagram QA | "Which step creates the permanent registration URI?" |

## Pretrained Inference

Use a processor instead of only a tokenizer. The processor prepares both text and
images.

```python
import torch
from transformers import AutoModelForImageTextToText, AutoProcessor
from transformers.image_utils import load_image

model_name = "HuggingFaceTB/SmolVLM2-2.2B-Instruct"
device = "cuda" if torch.cuda.is_available() else "cpu"

model = AutoModelForImageTextToText.from_pretrained(
    model_name,
    dtype=torch.bfloat16,
).to(device)
processor = AutoProcessor.from_pretrained(model_name)

image = load_image("portfolio-risk-panel.png")
messages = [
    {
        "role": "user",
        "content": [
            {"type": "image"},
            {"type": "text", "text": "Summarize the visible Solana portfolio risk."},
        ],
    },
]

prompt = processor.apply_chat_template(messages, add_generation_prompt=True)
inputs = processor(text=prompt, images=[image], return_tensors="pt").to(device)

output_ids = model.generate(**inputs, max_new_tokens=120)
answer = processor.batch_decode(output_ids, skip_special_tokens=True)[0]
print(answer)
```

## Dataset Format

A VLM training example should include images plus chat-style messages.

```json
{
  "images": ["solana-dashboard.png"],
  "messages": [
    {
      "role": "system",
      "content": [{"type": "text", "text": "You analyze Solana dashboard screenshots for educational risk explanations. Do not give financial advice."}]
    },
    {
      "role": "user",
      "content": [
        {"type": "image", "image": "solana-dashboard.png"},
        {"type": "text", "text": "What does the dashboard show about portfolio concentration?"}
      ]
    },
    {
      "role": "assistant",
      "content": [{"type": "text", "text": "The dashboard shows one dominant asset allocation, so the main visible issue is concentration risk."}]
    }
  ]
}
```

## Fine-Tuning Notes

For VLM fine-tuning:

- Use LoRA or another PEFT method for early experiments.
- Use quantization when memory is limited.
- Keep `max_length=None` in VLM SFT config when required so image tokens are not truncated.
- Use small dataset subsets first to validate formatting.
- Evaluate OCR, chart reading, and refusal behavior separately.

Example Jobs shape:

```bash
hf jobs uv run \
  --flavor a100-large \
  --secrets HF_TOKEN \
  --timeout 2h \
  "https://raw.githubusercontent.com/huggingface/trl/main/trl/scripts/sft.py" \
  --model_name_or_path HuggingFaceTB/SmolVLM2-2.2B-Instruct \
  --dataset_name your-username/solana-vlm-sft \
  --output_dir smolvlm2-solana-vision \
  --push_to_hub \
  --hub_model_id your-username/smolvlm2-solana-vision \
  --report_to trackio
```

Confirm current TRL flags before a long training job.

## Evaluation Checklist

- Does the model answer from visible evidence?
- Does it say when a number or label is not visible?
- Does it avoid inventing token prices or balances?
- Does it refuse seed phrase and private-key handling?
- Does it distinguish educational risk explanation from financial advice?
- Does it work across light and dark screenshots?
- Does it handle cropped, low-resolution, and mobile screenshots?

## Registering a VLM

Use the same registration process as a text model, but make the model card clear
about image inputs:

- Supported visual tasks.
- Image resolution limits.
- Known OCR or chart-reading limitations.
- Dataset sources and licenses.
- Evaluation set and results.
- Safety policy for screenshots containing sensitive data.

Related docs:

- [On-Chain AI for Beginners](beginners-guide.md)
- [Chart Vision Guide](chart-vision-guide.md)
- [Solana Finance AI Templates](solana-finance-templates.md)
- [Model Registry Overview](../model-registry/overview.md)
