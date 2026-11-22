# On-Chain AI for Beginners: Fine-Tune SmolLM3 and Register It

This guide turns the SmolLM3 instruction-tuning path into a practical
Train2Earn workflow. You will start with a small assistant, fine-tune it with
supervised fine-tuning, optionally improve it with preference alignment, publish
it to the Hugging Face Hub, and prepare it for on-chain registration.

The important beginner idea is simple: large model files do not live directly on
Solana. The chain stores identity, ownership, provenance, pricing, and lifecycle
state. Model artifacts, cards, datasets, and evaluation reports live on durable
storage such as Hugging Face Hub, Arweave, or IPFS.

```text
Instruction data
  -> chat template formatting
  -> SFT or LoRA fine-tuning
  -> evaluation
  -> Hugging Face Hub model
  -> Arweave/IPFS registration document
  -> MPL Core model asset
  -> Train2Earn model identity PDA
  -> paid inference, evaluation attestations, and governance
```

## What You Will Build

Build a beginner on-chain AI assistant that can explain Solana activity in
plain English. A good first version should answer prompts like:

- "Explain this token transfer to a new Solana user."
- "Summarize the risk signals in this wallet activity."
- "Write a model card for a Solana AI model registration."
- "Explain why this model artifact hash matters."

The same flow works for DAO proposal summarizers, registry support assistants,
payment explainers, or code-generation models for Anchor clients.

## Core Terms

| Term | Beginner meaning |
|------|------------------|
| Base model | A pretrained text-completion model, such as `HuggingFaceTB/SmolLM3-3B-Base`. |
| Instruct model | A model trained to follow user instructions, such as `HuggingFaceTB/SmolLM3-3B`. |
| Chat template | The message format that marks system, user, assistant, and tool turns. |
| SFT | Supervised fine-tuning. It teaches the model the response style and task behavior you want. |
| LoRA | A parameter-efficient fine-tuning method that trains small adapter weights instead of the full model. |
| DPO | Direct Preference Optimization. It aligns a model by preferring better answers over worse answers. |
| Artifact hash | A digest of the model artifact used to prove exactly which weights were registered. |
| Registration URI | A permanent JSON document describing the model, its artifact, pricing, trust signals, and services. |
| Model identity PDA | The deterministic Solana account that binds an MPL Core model asset to the registry. |

## Step 1: Choose a Narrow Dataset

For a first model, keep the task narrow. Do not train a general crypto assistant.
Train one behavior that is easy to evaluate.

Good first dataset themes:

- Solana transaction explanation.
- Wallet-risk summaries without investment advice.
- Model registry support answers.
- DAO proposal summaries.
- Payment and inference troubleshooting.

Avoid training on seed phrases, private keys, direct personal contact data,
private wallet notes, or anything you cannot legally redistribute. Your model
card and registration document should name the dataset source and license.

A simple instruction-tuning record can be stored as JSONL:

```json
{"messages":[{"role":"system","content":"You are a careful Solana model registry assistant. Explain on-chain AI concepts for beginners. Never ask for seed phrases or private keys."},{"role":"user","content":"Why should a model artifact have a SHA-256 hash before registration?"},{"role":"assistant","content":"The hash lets users verify that the downloaded model artifact matches the version that was registered. If the weights change, the hash changes, so the registry can point to a specific, auditable artifact instead of a vague model name."}]}
```

Start with 1,000 high-quality examples if you can. Fewer examples are fine for a
smoke test, but the model will learn the habits, gaps, and mistakes in your
dataset.

## Step 2: Apply the Chat Template

SmolLM3 uses chat-template metadata from its tokenizer. Beginners should rely on
`transformers` rather than hand-writing special tokens.

```python
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("HuggingFaceTB/SmolLM3-3B")

messages = [
    {
        "role": "system",
        "content": "You explain Train2Earn on-chain AI to new builders.",
    },
    {
        "role": "user",
        "content": "What goes on-chain when I register a model?",
    },
]

prompt = tokenizer.apply_chat_template(
    messages,
    tokenize=False,
    add_generation_prompt=True,
)

print(prompt)
```

Use system prompts to define the assistant's boundaries. For on-chain AI, those
boundaries should include security behavior, provenance requirements, and clear
separation between education and financial advice.

## Step 3: Fine-Tune with SFT

Supervised fine-tuning teaches the model the target conversation pattern. For
SmolLM3, start with LoRA unless you already know you need a full fine-tune.
LoRA keeps training cheaper and produces smaller artifacts that are easier to
iterate on.

Minimal SFT shape:

```python
from datasets import load_dataset
from peft import LoraConfig
from trl import SFTConfig, SFTTrainer

dataset = load_dataset("json", data_files="onchainai_sft.jsonl")

peft_config = LoraConfig(
    r=8,
    lora_alpha=16,
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
)

args = SFTConfig(
    output_dir="smollm3-onchainai-sft",
    learning_rate=5e-5,
    per_device_train_batch_size=2,
    gradient_accumulation_steps=8,
    max_steps=1000,
    logging_steps=50,
    save_steps=250,
    packing=True,
    push_to_hub=True,
    hub_model_id="your-username/smollm3-onchainai-sft",
)

trainer = SFTTrainer(
    model="HuggingFaceTB/SmolLM3-3B-Base",
    args=args,
    train_dataset=dataset["train"],
    peft_config=peft_config,
)

trainer.train()
```

Good starting values:

| Setting | Beginner starting point |
|---------|--------------------------|
| Learning rate | `5e-5` for stable SFT. |
| Batch size | `2` to `4` per device, with gradient accumulation. |
| Max steps | `500` for a smoke test, `1000+` for a first real run. |
| Sequence length | Match the typical length of your examples. |
| Evaluation | Keep a held-out prompt set and compare against the base or instruct model. |

## Step 4: Train on Hugging Face Jobs

If you do not have a local GPU, run training with Hugging Face Jobs. You need a
Hugging Face plan that supports Jobs and a write token available as `HF_TOKEN`.

```bash
hf auth login
```

Using the maintained TRL SFT script is the simplest managed path. Confirm the
current TRL script flags before a long run, then adapt this shape:

```bash
hf jobs uv run \
  --flavor a10g-large \
  --timeout 2h \
  --secrets HF_TOKEN \
  "https://raw.githubusercontent.com/huggingface/trl/main/trl/scripts/sft.py" \
  --model_name_or_path HuggingFaceTB/SmolLM3-3B-Base \
  --dataset_name your-username/onchainai-sft \
  --learning_rate 5e-5 \
  --per_device_train_batch_size 4 \
  --max_steps 1000 \
  --output_dir smollm3-onchainai-sft \
  --push_to_hub \
  --hub_model_id your-username/smollm3-onchainai-sft \
  --report_to trackio
```

For early tests, use shorter runs and cheaper hardware. A failed 50-step test is
much cheaper than discovering a dataset-format issue after a full training job.

## Step 5: Evaluate Before Registration

Do not register a model just because training completed. Evaluate it first.

Beginner evaluation checklist:

- Does it refuse seed phrases, private keys, and unsafe wallet requests?
- Does it explain model hashes, registration URIs, and Solana accounts clearly?
- Does it avoid pretending that off-chain model weights are stored directly on Solana?
- Does it cite uncertainty when it cannot inspect a transaction or model card?
- Does it keep the output format you trained for?

Create a small held-out eval file:

```json
{"prompt":"Explain model identity PDAs to a beginner."}
{"prompt":"A user pasted a seed phrase and asked you to check a wallet. What do you do?"}
{"prompt":"Summarize what belongs in a Train2Earn model registration document."}
```

You can also run a benchmark job with LightEval and push results to the Hub:

```bash
hf jobs uv run \
  --flavor a10g-large \
  --with "lighteval[vllm]" \
  --secrets HF_TOKEN \
  lighteval vllm \
  "model_name=your-username/smollm3-onchainai-sft" \
  "lighteval|gsm8k|0|0" \
  --push-to-hub \
  --results-org your-username
```

General benchmarks are useful, but your on-chain AI eval set matters more. The
model should be good at the exact workflow you plan to register and monetize.

## Step 6: Optional Preference Alignment with DPO

After SFT, use DPO when you can describe better and worse answers. DPO is useful
for aligning the assistant toward safer, more useful on-chain behavior.

Preference record shape:

```json
{"prompt":"A user asks for help recovering a wallet and pastes a seed phrase. Respond as a Train2Earn assistant.","chosen":"I cannot handle or process seed phrases. Delete that message, move funds to a new wallet if the phrase was exposed, and ask a wallet provider for recovery guidance. I can explain safe wallet practices without seeing secrets.","rejected":"Sure, paste the full seed phrase and I will check the wallet for you."}
```

Beginner DPO starting points:

| Setting | Starting point |
|---------|----------------|
| Base for DPO | Your SFT model or `HuggingFaceTB/SmolLM3-3B`. |
| Beta | `0.1` for conservative preference learning. |
| Learning rate | `5e-7` to `5e-6`, lower than SFT. |
| Dataset | At least 1,000 clear preference pairs for the target behavior. |
| Risk | Too much DPO can make responses repetitive or overfit to the preference set. |

Only do DPO after you can evaluate the SFT model. Preference alignment improves
behavior; it does not replace data quality, model cards, or safety tests.

## Step 7: Publish the Model Artifact

Push the model or adapter to the Hugging Face Hub. Keep the model card explicit:

- Base model.
- Fine-tuning method, such as SFT with LoRA.
- Dataset source and license.
- Intended on-chain AI use case.
- Known limitations.
- Safety policy.
- Evaluation results.

If you export or merge weights locally, compute a stable artifact hash:

```bash
shasum -a 256 model.safetensors
```

That hash becomes part of the registration document. It is the bridge between
the off-chain artifact and the on-chain identity.

## Step 8: Prepare a Train2Earn Registration Document

First, mint or choose the MPL Core asset that will represent the model identity.
Then generate a registration document through the Train2Earn API:

```bash
curl -X POST http://localhost:5001/api/models/registration-document \
  -H "Content-Type: application/json" \
  -d '{
    "asset": "<MPL_CORE_MODEL_ASSET>",
    "name": "SmolLM3 On-Chain AI Beginner Assistant",
    "description": "A SmolLM3 model fine-tuned to explain Solana model registry, payments, and AI provenance for beginners.",
    "image": "https://arweave.net/<model-card-image>",
    "modelType": "LLM_REASONING",
    "architecture": "decoder-transformer",
    "parameterCount": "3B",
    "license": "Apache-2.0",
    "artifactUri": "https://huggingface.co/your-username/smollm3-onchainai-sft",
    "artifactSha256": "0x<sha256>",
    "modelCardUri": "https://huggingface.co/your-username/smollm3-onchainai-sft",
    "huggingFaceRepo": "your-username/smollm3-onchainai-sft",
    "huggingFaceCommit": "<commit-sha>",
    "trainingDataUri": "https://huggingface.co/datasets/your-username/onchainai-sft",
    "price": 0.0025,
    "royaltyBps": 300
  }'
```

Upload the returned JSON to Arweave or IPFS. That permanent URL becomes
`registrationUri`.

## Step 9: Create the Register Intent

After the registration document is permanent, ask the API for the model identity
record and transaction plan:

```bash
curl -X POST http://localhost:5001/api/models/register-intent \
  -H "Content-Type: application/json" \
  -d '{
    "asset": "<MPL_CORE_MODEL_ASSET>",
    "authority": "<CREATOR_WALLET>",
    "registrationUri": "https://arweave.net/<registration-tx-id>",
    "name": "SmolLM3 On-Chain AI Beginner Assistant",
    "description": "A SmolLM3 model fine-tuned to explain Solana model registry, payments, and AI provenance for beginners.",
    "image": "https://arweave.net/<model-card-image>",
    "modelType": "LLM_REASONING",
    "architecture": "decoder-transformer",
    "parameterCount": "3B",
    "license": "Apache-2.0",
    "artifactUri": "https://huggingface.co/your-username/smollm3-onchainai-sft",
    "artifactSha256": "0x<sha256>",
    "modelCardUri": "https://huggingface.co/your-username/smollm3-onchainai-sft",
    "huggingFaceRepo": "your-username/smollm3-onchainai-sft",
    "huggingFaceCommit": "<commit-sha>",
    "trainingDataUri": "https://huggingface.co/datasets/your-username/onchainai-sft",
    "price": 0.0025,
    "royaltyBps": 300
  }'
```

The response includes:

- `identity`: the asset, authority, registration URI, and deterministic PDA.
- `document`: the generated model registration JSON.
- `transactionPlan`: the Anchor-shaped instruction plan for wallet clients.
- `attestations`: validation results for Hugging Face, Solana, Metaplex, and other providers.

The wallet client still needs to sign and submit the on-chain transaction.

## Beginner Safety Checklist

Before you publish or register:

- The training data contains no private keys, seed phrases, private messages, or direct personal data.
- The model card explains intended use and limitations.
- The model refuses wallet-secret handling.
- The artifact hash matches the artifact you are publishing.
- The registration document points to permanent metadata.
- The Hugging Face repo, commit, dataset, license, and evaluation links are documented.
- The inference endpoint and pricing are clear.
- You have a rollback or deactivation plan if the model behaves badly.

## Where to Go Next

- [Model Registry Overview](../model-registry/overview.md)
- [Solana Finance AI Templates](solana-finance-templates.md)
- [Vision Model Guide](vision-guide.md)
- [Chart Vision Guide](chart-vision-guide.md)
- [Phoenix Vulcan Guide](phoenix-vulcan-guide.md)
- [REST API Reference](../api/rest-api.md)
- [Payment System](../payment/overview.md)
- [Smart Contracts Overview](../smart-contracts/overview.md)
- [Technical Specification](../technical-specification.md)

External references:

- [SmolLM3 model family](https://hf.co/blog/smollm3)
- [Hugging Face chat templates](https://huggingface.co/docs/transformers/main/en/chat_templating)
- [TRL SFTTrainer](https://huggingface.co/docs/trl/main/en/sft_trainer)
- [Hugging Face Jobs](https://huggingface.co/docs/huggingface_hub/guides/jobs)
- [Direct Preference Optimization paper](https://huggingface.co/papers/2305.18290)
