# Jev-2 — TrainToEarn Multimodal Rating Engine

**Spec v0.1 — design document. Nothing in this file is live unless §1 says so.**

TrainToEarn (https://earn.onchainai.fund) pays $CLAWD for quality training
data, rated in realtime by the Jev engine. Today it accepts **plain text
only**. Jev-2 opens submission to every data form an AI or robot trainer
actually produces — images, video, bulk training datasets, and robot
episode/trajectory data — and rates each modality with the same discipline
the text engine already runs on: a model judge, a programmatic heuristic
leg, honest source labelling, and rewards only for verified quality.

Brand note: the project is **Clawd**, never "Claud".

---

## 1. What exists today (verified baseline)

| Piece | State |
| --- | --- |
| App | https://earn.onchainai.fund — wallet sign-in (Phantom / Solflare / Backpack); the wallet *is* the account |
| Backend | `https://traintoearn-backend-y6co.onrender.com` |
| Source | `Solizardking/traintoearn` (private) — `server/jevRating.js`, `server/trainingData.js`, `server/submissions.js`, `server/rewards.js` |
| Submission | `POST /api/jev/rate` `{walletAddress, filename, content}` — plain text (Markdown, JSON/JSONL, CSV, prose), **≤ 256 KB** |
| Judge | Jev model `typesafeai-jev-1-14-0` (TypeSafe AI) served via the **Neon AI Gateway** |
| Blend | `source: "jev+heuristic"` = **55% Jev + 45% heuristic**; `source: "heuristic-fallback"` when the gateway is unreachable — a fallback score is never presented as a Jev verdict |
| Five checks | Solana-specific · teaches something · original · well-formed · safe-to-train. An **unsafe** verdict caps the score at **20** |
| Tiers | Bronze ≥ 0 (×1) · Silver ≥ 65 (×2.5) · Gold ≥ 75 (×4) · Diamond ≥ 85 (×6) · Platinum ≥ 92 (×8) |
| Reward | `max(25, round((sizeKB + 100) × multiplier))` CLAWD, credited to the earning wallet's ledger; claims are human actions, minimum claim 100 CLAWD, payouts go only to the wallet that earned them |
| Token | $CLAWD, mint `8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump` (Solana) |
| Read API | `GET /api/submissions/stats`, `/api/submissions/recent`, `/api/submissions/top`, `/api/rewards/balance/<WALLET>`, `/api/rewards/treasury`, `/api/jev/status`, `/api/models/list` |
| Data Hub | Publishing flows already exist: datasets to **Hugging Face** (user's own write token, browser-side only) and to **Arweave** (user's own wallet, permanent), with optional registry registration |
| Model Kit precedent | The Solana Model Kit ingest already handles images as **metadata rows + sidecar captions** (`chart.png` + `chart.png.caption.txt`); raw image bytes are never embedded in JSONL rows, cards, manifests, or Hub uploads. Jev-2 adopts the same rule for every binary modality |

**Everything from §2 onward is new build.** Where a design reuses a live
component, it says so explicitly.

---

## 2. Submission types and intake

Five submission types. Two intake shapes:

- **Inline** — content travels in the request (small payloads), as today.
- **By reference** — the data already lives on Hugging Face or Arweave;
  the submission is a **manifest** (§2.6) pointing at it. This is the
  only route for bulk data, and it reuses the existing Data Hub publish
  flows: publish first (HF/Arweave, user's own credentials), then submit
  the reference for rating.

### 2.1 Text (existing, unchanged)

- Route: `POST /api/jev/rate` — unchanged, backwards compatible (§7.3).
- Limit: 256 KB inline. Longer text goes by reference as a dataset (§2.4).

### 2.2 Image + caption pairs

- Route: `POST /api/jev/rate-media` (new), multipart or JSON with an
  Arweave/HF media reference per item — **image bytes are not stored by
  the backend** beyond transient rating fetches; the durable record is
  the reference + caption + rating, mirroring the Model Kit sidecar rule.
- Shape: `{walletAddress, items: [{mediaRef, mediaHash, caption, context?}]}`
  — caption is mandatory; an uncaptioned image is not training data, it
  is a file.
- Limits: ≤ 50 pairs per submission; image ≤ 10 MB each, PNG/JPEG/WebP.
- Storage: submitter's HF dataset or Arweave upload (Data Hub flow);
  rating fetches by reference.

### 2.3 Video

- Route: `POST /api/jev/rate-media` with `kind: "video"` (new), by
  reference only — no raw video upload to the backend.
- Limits: ≤ 10 minutes, ≤ 500 MB at the host; backend fetches only
  sampled frames + metadata, never the full file into memory.
- Intake processing: metadata probe (duration, resolution, codec, fps),
  then **frame sampling** — 1 frame / 2 s, capped at 24 frames,
  scene-change frames preferred — reduced to a contact sheet + per-frame
  captions supplied by the submitter *or* generated for the vision leg
  (§3.3). A transcript/caption track, when present, is rated as text.

### 2.4 Bulk AI training datasets

- Route: `POST /api/jev/rate-dataset` (new), **by reference + manifest
  only. No raw bulk upload, ever** — a multi-GB JSONL does not belong in
  an HTTP rating call.
- Formats: JSONL (chat `messages` or instruction/response), Parquet,
  CSV. Hosted on HF (dataset repo) or Arweave (file/transaction ref).
- The manifest (§2.6) declares format, row count, size, split layout,
  license, and a content hash. Validators (§3.4) verify the declaration
  against a sampled read (first/middle/last shards + random rows),
  not against the submitter's word.
- Size: no backend-side cap (data never transits the backend); manifest
  must declare rows and bytes, and sampling depth scales with both.

### 2.5 Robot training data

- Route: `POST /api/jev/rate-dataset` with `kind: "robot"` (new), by
  reference + manifest only.
- Shape: **LeRobot-style episode datasets** — a set of episodes, each a
  time-indexed sequence of `observation` (joint states, end-effector
  pose, camera frame refs), `action` (commanded deltas/targets),
  `timestamp`, plus episode metadata (task description, success flag,
  environment: sim name/version or real-robot platform). Simulation
  logs in the same episode schema are first-class submissions.
- Formats: LeRobot dataset layout (Parquet + video/image refs),
  HDF5 episode bundles, or JSONL episode traces — declared in the
  manifest with an explicit schema block (§2.6).
- Limits: manifest-declared episode count and total steps; validators
  fully parse small sets (≤ 100 episodes) and sample larger ones.

### 2.6 Manifest format (new, all by-reference types)

```json
{
  "manifestVersion": 1,
  "kind": "dataset | robot | video",
  "walletAddress": "<SOLANA_WALLET>",
  "title": "string",
  "host": { "type": "huggingface | arweave", "ref": "<repo id or ar:// tx>", "revision": "<commit/tx id>" },
  "format": "jsonl | parquet | csv | lerobot | hdf5 | video",
  "declaredRows": 0,
  "declaredEpisodes": 0,
  "declaredBytes": 0,
  "contentHash": "sha256:<hex of canonical manifest-listed file hashes>",
  "license": "string",
  "taskDescription": "string (required for robot)",
  "schema": { "robot episode fields, when kind=robot": "..." },
  "captionSample": ["up to 20 representative captions/rows, inline"]
}
```

Rules: the manifest is what gets hashed, rated, and recorded on the
public ledger; `contentHash` binds the rating to exact bytes, so
re-rating after silently changing the data is detectable. A manifest
whose declarations fail validation (§3.4) is rejected before judging —
no judge tokens are spent on malformed submissions.

### 2.7 Storage summary

| Data | Where it lives | What the backend stores |
| --- | --- | --- |
| Text ≤ 256 KB | submitted inline | content + rating (as today) |
| Images / video | submitter's HF / Arweave | refs, hashes, captions, sampled-frame hashes, rating |
| Bulk datasets | submitter's HF / Arweave | manifest, validation report, sample hashes, rating |
| Robot data | submitter's HF / Arweave | manifest, episode stats, validation report, rating |
| All ratings | TrainToEarn ledger | score, tier, checks, `source`, reward — public feed stays privacy-safe (truncated wallet, filename/title, size, score, tier; **submitted content is never exposed**, extending today's rule to manifests' samples: samples are rated, not published) |

---

## 3. Rating pipeline per modality

### 3.1 The invariant core

Every modality runs the same two-leg shape as today's text engine:

```
score = 0.55 × judge + 0.45 × heuristic      (when the judge is reachable)
score = heuristic only, labelled as such     (when it is not)
```

- **Judge leg** — the Jev model via the Neon AI Gateway, as today. Jev
  judges anything expressible as text: prose, captions, dataset cards,
  manifests, sampled rows rendered to text, episode task descriptions
  and summaries.
- **Heuristic leg** — deterministic programmatic validators (§3.4).
  For binary and bulk modalities the heuristic leg carries *more of the
  factual load* (counts, continuity, hashes) while the 55/45 weights stay
  fixed — what changes is what each leg is fed, not the blend.
- **Source labelling is per submission and mandatory:** every rating
  records `source: "jev+heuristic"` or `"heuristic-fallback"`, exactly
  as today, plus a `modality` field. A vision-model score is labelled
  with its own source (§3.3) and is never silently folded into the Jev
  number.

### 3.2 Text

Unchanged from the live engine: Jev judges the content directly;
heuristics check form (structure, length, format validity). This is the
reference implementation every other modality mirrors.

### 3.3 Images and video frames (vision leg — new)

- A vision model rates the sampled frames/contact sheet against the
  captions: does the caption describe what is actually in the frame,
  is the image legible/informative, is it duplicated stock or a real
  capture.
- The vision output (per-frame verdicts + a summary paragraph) is
  rendered to text and handed to **Jev as the judge input**, so the
  55% leg remains Jev + Neon gateway; the vision model is a *sensor*,
  not a second judge. Its identity is recorded
  (`visionSource: "<model>"`) alongside `source`.
- If the vision sensor is unavailable, the submission is rated
  heuristic-only (format, hash dedup, caption text via Jev) and
  labelled `heuristic-fallback` with `visionSource: null` — never
  upgraded silently.

### 3.4 Programmatic validators (the heuristic leg, per modality)

All validators are deterministic, cheap, and run **before** judging:

| Validator | Applies to | What it checks |
| --- | --- | --- |
| Format validity | all | JSONL parses line-by-line; Parquet/CSV schema reads; chat rows carry valid `messages` roles; media refs resolve and content-type matches declaration |
| Declared-vs-actual | bulk, robot, video | manifest row/episode/byte counts vs sampled reads; mismatch > 5% fails the submission |
| Dedup | all | exact-hash dedup within the submission and against the submitter's prior submissions; near-dup detection on text rows and perceptual hashes on images/frames. Duplicate fraction directly reduces the heuristic score |
| Secret / PII scan | all | the existing safe-to-train screening extended to captions, sampled rows, and metadata: key/seed patterns, emails, wallet private material. Any hit fails safe-to-train (cap 20, §4) |
| Media safety screen | image, video | sampled frames screened for disallowed content before judging; a fail is a safe-to-train fail |
| Episode integrity | robot | every episode parses; timestamps strictly monotonic; observation/action lengths equal per step |
| Trajectory continuity | robot | no teleporting state: per-step observation deltas within declared physical bounds; gaps and frozen repeats flagged |
| Action smoothness | robot | action sequences scored for jitter/discontinuities inconsistent with the declared control rate; smooth, purposeful motion raises the heuristic score, noise lowers it |
| Success labelling | robot | episodes carry success/failure labels; unlabelled sets score lower on well-formed, mixed-outcome sets with honest labels score higher than implausible 100%-success sets |

### 3.5 Bulk datasets

Judge leg: Jev rates the dataset card/manifest **plus a rendered
sample** — up to 20 representative rows (the manifest's `captionSample`
verified against actual sampled rows, so the sample cannot be
cherry-picked fiction). Heuristic leg: §3.4 validators over the full
declared structure with sampled reads. A dataset is therefore rated on
what it verifiably is, not on its description.

### 3.6 Robot data

Judge leg: Jev rates the task description, episode summaries
(count, duration, success rate, environment), and validator-produced
trajectory statistics rendered to text. Heuristic leg: episode
integrity, continuity, smoothness, labelling (§3.4). Jev never sees raw
trajectory arrays — it judges the *described and measured* dataset,
which keeps the judge honest about what it can actually assess.

---

## 4. The five checks, translated per modality

The five checks do not change. Their meaning is modality-specific:

| Check | Text (live) | Image + caption | Video | Bulk dataset | Robot data |
| --- | --- | --- | --- | --- | --- |
| **Solana-specific** | About Solana mechanics, not generic chain text | Caption/context ties the image to Solana content (chart, UI, terminal, on-chain artifact) | Content documents Solana activity (wallet flow, trading terminal, deployment) | Corpus is Solana-domain data, not scraped general web text | Task is a Solana-ecosystem task (e.g. trained interaction with Solana tooling/terminals) **or** the set is published for the Solana AI/robotics community with a stated on-ecosystem use |
| **Teaches something** | A reader learns a concrete, correct skill or fact | The pair would teach a model something true: accurate caption, informative content | A model or viewer learns a procedure/state sequence from the footage | Rows impart correct knowledge/skill at scale; sample rows are substantively instructive | **The trajectories demonstrate a learnable skill:** a policy trained on them could improve — coherent goal-directed episodes, task variety, both successes and labelled failures to learn from |
| **Original** | Not copied docs or filler | Submitter's own captures/creations, not stock or re-uploads | Original recording, not reposted content | Not a re-upload of a public corpus; transformations must add real value (cleaning, labelling, structuring) and say so | Recorded/simulated by the submitter's own setup; not a mirrored public dataset under a new name |
| **Well-formed** | Clean structure; instruction/response or Q/A shape | Valid media, caption present and grammatical, refs resolve | Playable, watchable, sampled frames legible, metadata complete | Schema valid, splits sane, manifest accurate, license stated | Episode schema valid, timestamps monotonic, obs/action aligned, success labels present |
| **Safe-to-train** | No secrets, exploits, abuse | No private screens (seed phrases, keys, personal data), no disallowed imagery | Same, across sampled frames and any transcript | Secret/PII scan clean on samples; license permits training use | No credentials in logs/metadata; sim or real actions contain nothing that would teach unsafe physical behaviour beyond the declared task |

Safe-to-train is a **gate in every modality**: a fail caps the total
score at 20, exactly as the live text engine does today.

---

## 5. Rewards — verified data weight

### 5.1 What changes and what does not

Unchanged: tiers and multipliers (Bronze ×1 → Platinum ×8), the
`max(25, …)` floor for small quality submissions, ledger crediting to
the earning wallet only, human-only claims, 100 CLAWD minimum claim.

Changed: the size term. Today's `(sizeKB + 100)` rewards raw text
weight, which is meaningless for a video reference or a 2 GB Parquet
that never transits the backend. Jev-2 replaces sizeKB with **verified
data weight** `W` — weight the validators actually confirmed:

```
reward = max(25, round((W + 100) × multiplier))     CLAWD
```

| Type | Verified weight `W` | Rationale |
| --- | --- | --- |
| Text | file size in KB (as today) | unchanged behaviour |
| Image + caption | sum over pairs of (image KB, capped at 250 KB/pair) × caption factor (1.0 if caption ≥ 20 chars and vision-verified, else 0.25) | rewards captioned, verified pairs; punishes bare image dumps |
| Video | duration minutes × 10, capped at 600 (≈ a 10-min video ≈ 600 weight) | rewards documented footage, not container bytes (codecs make bytes meaningless) |
| Bulk dataset | verified row count ÷ 100 (1 weight / 100 rows), sampled-verified only | rewards real, parseable rows — not declared rows |
| Robot data | verified total steps ÷ 1,000 (1 weight / 1k steps), episodes passing integrity checks only | rewards usable trajectory volume |

### 5.2 Per-type caps (new)

Bulk and robot submissions can be arbitrarily large; rewards cannot.

| Type | Cap on `W` per submission | Cap effect at Platinum (×8) |
| --- | --- | --- |
| Text | n/a (256 KB inline limit is the cap) | as today |
| Image + caption | 5,000 | ≤ ~40,800 CLAWD |
| Video | 600 | ≤ ~5,600 CLAWD |
| Bulk dataset | 20,000 (≈ 2M verified rows) | ≤ ~160,800 CLAWD |
| Robot data | 20,000 (≈ 20M verified steps) | ≤ ~160,800 CLAWD |

Caps are per submission; splitting one dataset into many manifests to
farm caps is treated as one submission by the dedup validator (§5.3).

### 5.3 Anti-gaming rules (new, enforced by validators)

1. **No quality gate, no bulk reward.** A by-reference submission only
   earns on the weight its validators verified *and* only if its final
   score reaches **Silver (≥ 65)**. Below Silver, bulk/robot/video
   submissions earn the 25 CLAWD floor at most — bulk never multiplies
   junk.
2. **Duplicates earn nothing twice.** Exact or near-duplicate content
   (within a submission, across a submitter's history, or a re-upload
   of a known public corpus) has its weight zeroed for the duplicated
   fraction.
3. **Declared ≠ verified.** Declared rows/episodes/steps that sampling
   cannot confirm do not exist for reward purposes.
4. **Hash binding.** The rated `contentHash` is recorded; if the hosted
   data later changes under the same reference, prior ratings stand for
   the old hash only and the reference is flagged for re-rating before
   any further rewards.
5. **One wallet, one ledger truth.** Rewards accrue only to
   `walletAddress` on the submission; payouts only to that wallet —
   today's rule, unchanged. Rate limits per wallet per day apply to
   by-reference submissions (manifests are cheap to spam; ratings are
   not).
6. **Unsafe is final for that content.** A safe-to-train fail caps the
   score at 20 and the capped rating is what the public record shows.

---

## 6. API changes

### 6.1 New endpoints (all new build)

| Endpoint | Purpose |
| --- | --- |
| `POST /api/jev/rate-media` | Image+caption pairs and video references (§2.2, §2.3). Small sets rate synchronously; video always async (§6.2) |
| `POST /api/jev/rate-dataset` | Bulk datasets and robot data by manifest (§2.4–§2.6). Always async |
| `GET /api/jev/jobs/<JOB_ID>` | Poll an async rating job: `queued → validating → judging → scored / failed`, then the full rating object (score, tier, checks, `source`, `modality`, reward, validation report summary) |
| `GET /api/jev/status` (extended) | Adds per-modality engine status: which judges/sensors are reachable, so a client can see *before* submitting whether a rating will be `jev+heuristic` or `heuristic-fallback` |

Submission responses gain: `id`, `modality`, `jobId` (when async),
`verifiedWeight` (the `W` actually used), and the validation report
summary. The public feed endpoints (`recent`, `top`, `stats`) gain a
`modality` field per entry; no existing field is removed or renamed.

### 6.2 Async rating jobs

Bulk, robot, and video ratings involve fetches, sampling, and multiple
validator passes — they do not fit a synchronous request. Flow:

1. `POST` validates the manifest synchronously (shape, refs resolve,
   hash format) and returns `202 {jobId}`.
2. Worker runs validators, then judging; status is pollable at
   `GET /api/jev/jobs/<JOB_ID>` (submitter's wallet only for in-flight
   detail; the finished rating joins the public ledger as today).
3. Job timeouts and partial failures are explicit states, never silent
   zeros: a job that could not fetch its reference ends `failed` with
   the reason, earns nothing, and may be resubmitted.

### 6.3 Backwards compatibility

- `POST /api/jev/rate` is **unchanged**: same request, same response
  fields, same blend, same tiers, same reward for text.
- Existing clients (the earn.onchainai.fund Jev panel, the CLAWD Agent
  tab, agent integrations following `onchainai/SKILL.md`) require no
  changes.
- New fields are additive only. `source` keeps its exact current
  vocabulary.

---

## 7. Rollout phases

| Phase | Scope | Status |
| --- | --- | --- |
| **0 — live today** | Text rating via `/api/jev/rate`; Jev (`typesafeai-jev-1-14-0`) on the Neon AI Gateway + heuristic leg; five checks, tiers, rewards; Data Hub publish to HF/Arweave; public ledger/feed | **Live** |
| **1 — media** | `/api/jev/rate-media` for image+caption pairs (sync) with vision sensor + Jev judging; media safety screen; per-type weight + caps for images | New build |
| **2 — bulk datasets** | Manifest format v1; `/api/jev/rate-dataset` + async jobs for JSONL/Parquet/CSV by reference; declared-vs-actual sampling validators; Silver gate for bulk rewards | New build |
| **3 — video** | Video references: metadata probe, frame sampling, contact-sheet vision rating, transcript-as-text judging; async by default | New build |
| **4 — robot data** | LeRobot/HDF5/JSONL episode intake; integrity, continuity, and smoothness validators; step-based verified weight | New build |
| **5 — hardening** | Cross-submission near-dup at scale, per-wallet rate limits tuned on real traffic, `/api/jev/status` modality reporting, registry cross-linking (rated datasets/models surface in `/api/models/list` with their Jev-2 tier) | New build |

Phase order is deliberate: each phase reuses the previous one's
validators, and no phase pays bulk rewards before its quality gates
exist (§5.3 rule 1).

---

## 8. Honesty contract (unchanged from the live engine, extended)

- A rating is only ever as strong as its `source` label says it is.
- Fallback and vision-sensor-absent ratings are labelled, never dressed
  up.
- The public record shows scores, tiers, and verdicts — never submitted
  content, never manifest samples, never private media.
- Rewards are ledger facts, quoted from `/api/rewards/balance/<WALLET>`
  and `/api/rewards/treasury` — never promised in advance by any UI or
  agent skill.
- Brain/Hands separation holds for every new flow: the backend never
  holds keys; HF and Arweave publishing stays in the user's browser
  with the user's own credentials, as the Data Hub already works today.
