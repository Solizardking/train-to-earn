"""
TrainToEarn — Hugging Face Space front door.

A thin Gradio client over the public TrainToEarn backend
(earn.onchainai.fund). Submit training data (text, image+caption pairs,
video, bulk datasets, robot episodes) and get it rated by the Jev engine
for $CLAWD rewards; browse and register models in the Clawd Omnichain
Model Registry, anchored natively on Solana.

This Space NEVER asks for, accepts, or handles private keys or seed
phrases. Signing (publisher proofs, Solana anchors, claims) always
happens in your own wallet tooling.

Backend base URL: TRAINTOEARN_API env var (Spaces secret/variable),
default https://traintoearn-backend-y6co.onrender.com
"""

import base64
import hashlib
import json
import mimetypes
import os
import time

import gradio as gr
import requests

API_BASE = os.environ.get(
    "TRAINTOEARN_API", "https://traintoearn-backend-y6co.onrender.com"
).rstrip("/")

WAKE_NOTE = (
    "The TrainToEarn backend runs on a free Render tier — if it has been "
    "idle it can take ~30–60s to wake up. If a call times out, wait a "
    "moment and try again."
)

SESSION = requests.Session()
SESSION.headers.update(
    {"Content-Type": "application/json", "User-Agent": "traintoearn-hf-space/1.0"}
)

GET_TIMEOUT = 60
POST_TIMEOUT = 150  # cold start + a live Jev decision call can be slow
POLL_TIMEOUT = 30
POLL_INTERVAL_S = 3
POLL_MAX = 50  # ~2.5 minutes of polling for async rating jobs

BASE58_ALPHABET = set("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz")

TIER_NAMES = {0: "Unverified", 1: "Hash-verified", 2: "Rated", 3: "Reproduced"}


# --------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------

def short(value, head=6, tail=4):
    if not value:
        return "—"
    value = str(value)
    if len(value) <= head + tail + 1:
        return value
    return f"{value[:head]}…{value[-tail:]}"


def wallet_warning(wallet):
    """Client-side sanity check only — warns, never blocks."""
    wallet = (wallet or "").strip()
    if not wallet:
        return (
            "⚠️ No payout wallet given. Ratings still run, but $CLAWD rewards "
            "can only accrue to a Solana wallet address."
        )
    if not (32 <= len(wallet) <= 44) or any(c not in BASE58_ALPHABET for c in wallet):
        return (
            "⚠️ That doesn't look like a standard Solana address (base58, "
            "32–44 chars). Double-check it — rewards sent to a wrong address "
            "cannot be recovered. Submitting anyway, as requested."
        )
    return ""


def tier_for_score(score):
    try:
        score = float(score)
    except (TypeError, ValueError):
        return "—"
    if score >= 92:
        return "Platinum"
    if score >= 85:
        return "Diamond"
    if score >= 75:
        return "Gold"
    if score >= 65:
        return "Silver"
    return "Bronze"


def _friendly_error(resp_status=None, exc=None, body=None):
    if exc is not None:
        if isinstance(exc, requests.Timeout):
            return f"⏰ The backend timed out. {WAKE_NOTE}"
        if isinstance(exc, requests.ConnectionError):
            return f"🔌 Couldn't reach the TrainToEarn backend. {WAKE_NOTE}"
        return f"Unexpected error: {exc}"
    detail = ""
    if isinstance(body, dict):
        detail = body.get("error") or body.get("details") or ""
    elif body:
        detail = str(body)[:300]
    return f"Backend returned HTTP {resp_status}" + (f" — {detail}" if detail else "")


def api_get(path, timeout=GET_TIMEOUT):
    """Returns (data_dict_or_None, error_str_or_None)."""
    try:
        resp = SESSION.get(f"{API_BASE}{path}", timeout=timeout)
    except requests.RequestException as exc:
        return None, _friendly_error(exc=exc)
    try:
        data = resp.json()
    except ValueError:
        data = None
    if resp.status_code >= 400:
        return None, _friendly_error(resp_status=resp.status_code, body=data)
    return data if isinstance(data, dict) else {"data": data}, None


def api_post(path, payload, timeout=POST_TIMEOUT):
    """Returns (data_dict_or_None, error_str_or_None, status_code)."""
    try:
        resp = SESSION.post(f"{API_BASE}{path}", json=payload, timeout=timeout)
    except requests.RequestException as exc:
        return None, _friendly_error(exc=exc), None
    try:
        data = resp.json()
    except ValueError:
        data = None
    if resp.status_code >= 400:
        return None, _friendly_error(resp_status=resp.status_code, body=data), resp.status_code
    return (data if isinstance(data, dict) else {"data": data}), None, resp.status_code


# --------------------------------------------------------------------------
# Rating rendering — engine label is shown EXACTLY as the backend returns it
# --------------------------------------------------------------------------

def unwrap_rating(payload):
    """Pull the rating object out of the various response envelopes."""
    if not isinstance(payload, dict):
        return None
    if isinstance(payload.get("rating"), dict):
        return payload["rating"]
    if isinstance(payload.get("result"), dict):
        inner = payload["result"]
        if isinstance(inner.get("rating"), dict):
            return inner["rating"]
        return inner
    return payload


def job_id_of(payload):
    if not isinstance(payload, dict):
        return None
    return payload.get("jobId") or payload.get("job_id") or payload.get("id")


def format_rating(rating, heading="Jev rating"):
    if not isinstance(rating, dict):
        return f"### {heading}\n\nUnexpected response shape — nothing to display."
    score = rating.get("score", rating.get("qualityScore"))
    tier = rating.get("tier") or tier_for_score(score)
    tier_label = rating.get("tierLabel")
    # Engine label: verbatim from the backend ('jev+heuristic',
    # 'heuristic-fallback', ...). Never dressed up.
    engine = rating.get("source") or rating.get("engine") or rating.get("engineLabel")
    reward = rating.get("clawdReward", rating.get("reward"))
    lines = [f"### {heading}", ""]
    if score is not None:
        lines.append(f"- **Score:** {score} / 100")
    lines.append(f"- **Tier:** {tier}" + (f" — {tier_label}" if tier_label else ""))
    if engine:
        lines.append(f"- **Engine:** `{engine}`")
        if engine == "heuristic-fallback":
            lines.append(
                "  - ℹ️ The Jev gateway did not return a verdict for this one, "
                "so this score is the local heuristic only — shown as-is, "
                "never presented as a Jev verdict."
            )
    if reward is not None:
        lines.append(f"- **Estimated reward:** {reward} $CLAWD")
    if rating.get("multiplier") is not None:
        lines.append(f"- **Tier multiplier:** ×{rating['multiplier']}")
    if rating.get("dataSize") is not None:
        lines.append(f"- **Data size:** {rating['dataSize']} bytes")
    if rating.get("unsafe"):
        lines.append(
            "- ⚠️ **Flagged unsafe to train on** (secrets/harmful content "
            "suspected) — score capped, no reward accrues until fixed."
        )
    verdicts = rating.get("verdicts") or rating.get("checks")
    if isinstance(verdicts, dict) and verdicts:
        lines.append("")
        lines.append("**Checks:**")
        for key, val in verdicts.items():
            if isinstance(val, dict):
                shown = val.get("label") or val.get("value")
            else:
                shown = val
            lines.append(f"- {key}: {shown}")
    recs = rating.get("recommendations")
    if isinstance(recs, list) and recs:
        lines.append("")
        lines.append("**Recommendations:**")
        for rec in recs[:6]:
            lines.append(f"- {rec}")
    if rating.get("jevError"):
        lines.append("")
        lines.append(f"_Jev gateway note: {rating['jevError']}_")
    return "\n".join(lines)


def poll_job(job_id, heading):
    """Generator: yields progress markdown, then the final rating."""
    yield f"⏳ Rating job `{job_id}` queued… ({WAKE_NOTE})"
    last_status = None
    for i in range(POLL_MAX):
        time.sleep(POLL_INTERVAL_S)
        data, err = api_get(f"/api/jev/jobs/{job_id}", timeout=POLL_TIMEOUT)
        if err:
            yield f"⏳ Job `{job_id}` — poll {i + 1}: {err} Retrying…"
            continue
        status = str(data.get("status") or "unknown")
        last_status = status
        if status in ("scored", "done", "completed", "complete", "succeeded"):
            rating = unwrap_rating(data)
            yield format_rating(rating, heading=heading)
            return
        if status in ("failed", "error"):
            detail = data.get("error") or data.get("details") or "no detail returned"
            yield f"❌ Rating job `{job_id}` failed — {detail}"
            return
        yield (
            f"⏳ Job `{job_id}` — status: **{status}** "
            f"(check {i + 1}/{POLL_MAX}). Validating → judging…"
        )
    yield (
        f"⌛ Job `{job_id}` is still running (last status: {last_status}). "
        "Ratings persist on the backend — check the Rewards tab shortly."
    )


# --------------------------------------------------------------------------
# Submit: text  →  POST /api/jev/rate  (existing endpoint, real shape)
# --------------------------------------------------------------------------

def submit_text(wallet, text, upload):
    wallet = (wallet or "").strip()
    warn = wallet_warning(wallet)
    content = (text or "").strip()
    filename = "pasted-submission.txt"
    mime = "text/plain"
    if upload:
        try:
            with open(upload, "r", encoding="utf-8", errors="replace") as fh:
                content = fh.read()
        except OSError as exc:
            return f"❌ Couldn't read the uploaded file: {exc}"
        filename = os.path.basename(upload)
        mime = mimetypes.guess_type(filename)[0] or "text/plain"
    if not content.strip():
        return "❌ Nothing to rate — paste some text or upload a .jsonl/.txt file first."
    truncated_note = ""
    if len(content) > 256 * 1024:
        content = content[: 256 * 1024]
        truncated_note = (
            "\n\n_Note: inline text is capped at 256 KB by the platform — "
            "the submission was truncated. Longer data should go in as a "
            "dataset manifest (Dataset form below)._"
        )
    data, err, _ = api_post(
        "/api/jev/rate",
        {
            "content": content,
            "filename": filename,
            "mimeType": mime,
            "metadata": {"source": "hf-space", "modality": "text"},
            "walletAddress": wallet or None,
        },
    )
    if err:
        return f"❌ {err}"
    out = format_rating(unwrap_rating(data), heading="Jev rating — text")
    return (f"{warn}\n\n" if warn else "") + out + truncated_note


# --------------------------------------------------------------------------
# Submit: image+caption pairs  →  POST /api/jev/rate-media (kind: image)
# --------------------------------------------------------------------------

def submit_images(wallet, files, captions_text):
    wallet = (wallet or "").strip()
    warn = wallet_warning(wallet)
    files = files or []
    if not files:
        yield "❌ Upload at least one image (with a caption — an uncaptioned image is not training data)."
        return
    if len(files) > 50:
        yield "❌ Platform limit is 50 image+caption pairs per submission."
        return
    captions = [c.strip() for c in (captions_text or "").splitlines()]
    pairs = []
    total_bytes = 0
    for idx, path in enumerate(files):
        try:
            with open(path, "rb") as fh:
                raw = fh.read()
        except OSError as exc:
            yield f"❌ Couldn't read image {idx + 1}: {exc}"
            return
        total_bytes += len(raw)
        if len(raw) > 10 * 1024 * 1024:
            yield f"❌ Image {idx + 1} is over the 10 MB per-image platform limit."
            return
        caption = captions[idx] if idx < len(captions) else ""
        mime = mimetypes.guess_type(path)[0] or "image/png"
        pairs.append(
            {
                "mediaRef": "data:{};base64,{}".format(
                    mime, base64.b64encode(raw).decode("ascii")
                ),
                "mediaHash": "sha256:" + hashlib.sha256(raw).hexdigest(),
                "caption": caption,
                "context": None,
                "mimeType": mime,
                "sizeBytes": len(raw),
            }
        )
    missing = [i + 1 for i, p in enumerate(pairs) if not p["caption"]]
    notes = []
    if missing:
        notes.append(
            f"⚠️ Pairs {missing} have no caption (one caption per line, in "
            "upload order). Captions are mandatory for image training data — "
            "uncaptioned pairs score poorly."
        )
    if total_bytes > 10 * 1024 * 1024:
        yield (
            "❌ These images total over ~10 MB inlined. For bigger sets, host "
            "them (a Hugging Face dataset or Arweave) and submit a dataset "
            "manifest instead — binary data is rated by reference."
        )
        return
    yield f"⏳ Submitting {len(pairs)} image+caption pair(s) for rating… ({WAKE_NOTE})"
    payload = {
        "wallet": wallet or None,
        "walletAddress": wallet or None,
        "kind": "image",
        "pairs": pairs,
        "items": pairs,
        "metadata": {"source": "hf-space", "pairCount": len(pairs)},
    }
    data, err, _ = api_post("/api/jev/rate-media", payload)
    if err:
        yield f"❌ {err}"
        return
    prefix = (f"{warn}\n\n" if warn else "") + ("\n".join(notes) + "\n\n" if notes else "")
    jid = job_id_of(data)
    rating = unwrap_rating(data)
    if jid and (not rating or rating.get("score") is None):
        yield prefix + f"⏳ Rating job `{jid}` created — polling…"
        yield from poll_job(jid, "Jev rating — image pairs")
        return
    yield prefix + format_rating(rating, heading="Jev rating — image pairs")


# --------------------------------------------------------------------------
# Submit: video by reference  →  POST /api/jev/rate-media (kind: video)
# --------------------------------------------------------------------------

def submit_video(wallet, url, caption):
    wallet = (wallet or "").strip()
    url = (url or "").strip()
    if not url:
        yield "❌ Paste a video URL (hosted on Hugging Face, Arweave, or any public link)."
        return
    yield f"⏳ Submitting video reference for rating… ({WAKE_NOTE})"
    payload = {
        "wallet": wallet or None,
        "walletAddress": wallet or None,
        "kind": "video",
        "url": url,
        "metadata": {"source": "hf-space", "caption": (caption or "").strip() or None},
    }
    data, err, _ = api_post("/api/jev/rate-media", payload)
    if err:
        yield f"❌ {err}"
        return
    warn = wallet_warning(wallet)
    jid = job_id_of(data)
    rating = unwrap_rating(data)
    if jid and (not rating or rating.get("score") is None):
        yield from poll_job(jid, "Jev rating — video")
        return
    yield (f"{warn}\n\n" if warn else "") + format_rating(rating, heading="Jev rating — video")


# --------------------------------------------------------------------------
# Submit: dataset / robot manifests  →  POST /api/jev/rate-dataset (async)
# --------------------------------------------------------------------------

def _manifest_from_inputs(kind, wallet, manifest_text, url):
    """Returns (manifest_dict, error_str)."""
    manifest_text = (manifest_text or "").strip()
    url = (url or "").strip()
    if manifest_text:
        try:
            manifest = json.loads(manifest_text)
        except ValueError as exc:
            return None, f"Manifest is not valid JSON: {exc}"
        if not isinstance(manifest, dict):
            return None, "Manifest must be a JSON object."
    elif url:
        host_type = "url"
        if "huggingface.co" in url:
            host_type = "huggingface"
        elif url.startswith("ar://") or "arweave" in url:
            host_type = "arweave"
        manifest = {
            "manifestVersion": 1,
            "kind": kind,
            "title": f"{kind} submission from HF Space",
            "host": {"type": host_type, "ref": url},
        }
    else:
        return None, "Provide a manifest JSON or a URL to the hosted data."
    manifest.setdefault("manifestVersion", 1)
    manifest["kind"] = kind
    if wallet:
        manifest.setdefault("walletAddress", wallet)
    return manifest, None


def submit_manifest_job(wallet, kind, manifest_text, url):
    wallet = (wallet or "").strip()
    manifest, err_str = _manifest_from_inputs(kind, wallet, manifest_text, url)
    if err_str:
        yield f"❌ {err_str}"
        return
    yield f"⏳ Submitting {kind} manifest for async rating… ({WAKE_NOTE})"
    payload = {
        "wallet": wallet or None,
        "walletAddress": wallet or None,
        "kind": kind,
        "manifest": manifest,
    }
    data, err, _ = api_post("/api/jev/rate-dataset", payload)
    if err:
        yield f"❌ {err}"
        return
    warn = wallet_warning(wallet)
    if warn:
        yield warn
    jid = job_id_of(data)
    rating = unwrap_rating(data)
    if jid:
        yield from poll_job(jid, f"Jev rating — {kind}")
        return
    yield format_rating(rating, heading=f"Jev rating — {kind}")


def submit_dataset(wallet, manifest_text, url):
    yield from submit_manifest_job(wallet, "dataset", manifest_text, url)


def submit_robot(wallet, manifest_text):
    yield from submit_manifest_job(wallet, "robot", manifest_text, "")


# --------------------------------------------------------------------------
# Registry: canonical JSON hashing (mirrors scripts/register-model.mjs)
# --------------------------------------------------------------------------

def canonicalize(value):
    """Recursive sorted-key canonical form.

    For the flat manifests register-model.mjs produces, this is
    byte-identical to its JSON.stringify(manifest, sortedKeys):
    keys sorted, no whitespace, UTF-8 output.
    """
    if isinstance(value, dict):
        return {k: canonicalize(value[k]) for k in sorted(value.keys())}
    if isinstance(value, list):
        return [canonicalize(v) for v in value]
    return value


def manifest_hash(manifest):
    canonical = json.dumps(
        canonicalize(manifest), separators=(",", ":"), ensure_ascii=False
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def registry_rows():
    data, err = api_get("/api/registry/models")
    if err:
        return [], f"❌ {err}"
    entries = []
    if isinstance(data, dict):
        entries = data.get("models") or data.get("entries") or data.get("data") or []
    elif isinstance(data, list):
        entries = data
    rows = []
    for e in entries if isinstance(entries, list) else []:
        if not isinstance(e, dict):
            continue
        m = e.get("manifest") if isinstance(e.get("manifest"), dict) else {}
        home = m.get("home_chain") if isinstance(m.get("home_chain"), dict) else {}
        model = m.get("model") if isinstance(m.get("model"), dict) else {}
        tier = e.get("tier", m.get("tier", 0))
        try:
            tier = int(tier)
        except (TypeError, ValueError):
            tier = 0
        rows.append(
            [
                m.get("name") or e.get("name") or "—",
                short(home.get("publisher_address") or m.get("publisher") or e.get("publisher")),
                home.get("chain_id") or m.get("chain_id") or e.get("chain_id") or "—",
                f"T{tier} {TIER_NAMES.get(tier, '')}".strip(),
                model.get("modality") or m.get("modality") or "—",
                short(e.get("manifest_sha256") or e.get("id"), 10, 6),
            ]
        )
    if not rows:
        return [], "Registry is reachable but has no entries yet — be the first to register a model below."
    return rows, f"✅ {len(rows)} registry entr{'y' if len(rows) == 1 else 'ies'} loaded."


def compute_manifest_messages(manifest_text):
    try:
        manifest = json.loads(manifest_text or "")
    except ValueError as exc:
        return "", "", "", f"❌ Manifest is not valid JSON: {exc}"
    if not isinstance(manifest, dict):
        return "", "", "", "❌ Manifest must be a JSON object."
    digest = manifest_hash(manifest)
    proof = f"clawd-registry:v1:{digest}"
    home = manifest.get("home_chain") if isinstance(manifest.get("home_chain"), dict) else {}
    chain_id = home.get("chain_id") or manifest.get("chain_id") or "<chain_id>"
    publisher = (
        home.get("publisher_address")
        or manifest.get("publisher")
        or "<publisher_address>"
    )
    memo = f"clawd-registry:v1:register:{digest}:{chain_id}:{publisher}"
    note = (
        "✅ Hash computed over the canonical JSON of exactly this manifest. "
        "If you edit any field, recompute — the hash, proof message, and memo "
        "all change. Sign the proof message with your home-chain wallet in "
        "your own tooling, then (optionally) send the memo payload in a "
        "Solana memo transaction from your Solana address to anchor it."
    )
    return digest, proof, memo, note


def register_model(manifest_text, signature):
    try:
        manifest = json.loads(manifest_text or "")
    except ValueError as exc:
        return f"❌ Manifest is not valid JSON: {exc}"
    if not isinstance(manifest, dict):
        return "❌ Manifest must be a JSON object."
    signature = (signature or "").strip()
    if not signature:
        return (
            "❌ Paste the signature of the proof message first (compute it "
            "above, sign `clawd-registry:v1:<sha256>` in your own wallet, "
            "paste the signature here). This Space never handles keys."
        )
    digest = manifest_hash(manifest)
    data, err, status = api_post(
        "/api/registry/register",
        {"manifest": manifest, "manifest_sha256": digest, "signature": signature},
    )
    if err and status in (404, 405):
        # Fallback to the API-sketch route with the proof embedded.
        home = manifest.get("home_chain") if isinstance(manifest.get("home_chain"), dict) else {}
        chain_id = str(home.get("chain_id") or manifest.get("chain_id") or "")
        method = (
            "ed25519" if chain_id.startswith("solana")
            else "eip191" if chain_id.startswith("eip155")
            else "bip322" if chain_id.startswith("bip122")
            else "unknown"
        )
        embedded = dict(manifest)
        embedded["publisher_proof"] = {
            "method": method,
            "message": f"clawd-registry:v1:{digest}",
            "signature": signature,
        }
        data, err, status = api_post(
            "/api/registry/models",
            {"manifest": embedded, "manifest_sha256": digest},
        )
    if err:
        return f"❌ {err}"
    return (
        "✅ Registration submitted.\n\n"
        f"- **Manifest SHA-256:** `{digest}`\n"
        f"- **Backend response:** `{json.dumps(data)[:600]}`\n\n"
        "The entry starts at Tier 0 (Unverified). It moves to Tier 1 once "
        "the publisher proof verifies and a Solana anchor (memo tx or PDA) "
        "with this hash exists."
    )


# --------------------------------------------------------------------------
# Rewards tab
# --------------------------------------------------------------------------

def rewards_lookup(wallet):
    wallet = (wallet or "").strip()
    if not wallet:
        return "Paste a Solana wallet address above to see its reward balance.", []
    data, err = api_get(f"/api/rewards/balance/{wallet}")
    if err:
        return f"❌ {err}", []
    lines = [f"### Rewards — `{short(wallet, 8, 6)}`", ""]
    lines.append(f"- **Earned:** {data.get('earned', 0)} $CLAWD")
    lines.append(f"- **Paid out:** {data.get('paid', 0)} $CLAWD")
    lines.append(f"- **Pending payout:** {data.get('pending', 0)} $CLAWD")
    lines.append(f"- **Claimable:** {data.get('claimable', 0)} $CLAWD")
    lines.append(f"- **Rated submissions:** {data.get('ratingsCount', 0)}")
    if data.get("minClaim") is not None:
        lines.append(f"- **Minimum claim:** {data['minClaim']} $CLAWD (claims are requested on earn.onchainai.fund)")
    payouts = data.get("payouts") or []
    rows = [
        [
            p.get("id", "—"),
            p.get("amount_clawd", p.get("amountClawd", "—")),
            p.get("status", "—"),
            short(p.get("tx_signature") or p.get("txSignature"), 10, 6),
            str(p.get("requested_at") or p.get("requestedAt") or "")[:19],
        ]
        for p in payouts
        if isinstance(p, dict)
    ]
    return "\n".join(lines), rows


def platform_overview():
    out = []
    treasury, terr = api_get("/api/rewards/treasury")
    if terr:
        out.append(f"**Treasury:** {terr}")
    elif treasury:
        out.append("### Rewards treasury")
        out.append(f"- **Address:** `{short(treasury.get('treasury'), 8, 6)}`")
        out.append(f"- **$CLAWD balance:** {treasury.get('clawdBalance')}")
        out.append(f"- **SOL balance:** {treasury.get('solBalance')}")
        if treasury.get("error"):
            out.append(f"- ⚠️ {treasury['error']}")
        out.append("")
    stats_data, serr = api_get("/api/submissions/stats")
    if serr:
        out.append(f"**Platform stats:** {serr}")
    elif stats_data:
        stats = stats_data.get("stats")
        if stats:
            out.append("### Platform")
            out.append(f"- **Total submissions:** {stats.get('totalSubmissions')}")
            out.append(f"- **Contributors:** {stats.get('contributors')}")
            out.append(f"- **Total $CLAWD earned:** {stats.get('totalClawdEarned')}")
            out.append(f"- **Average score:** {stats.get('averageScore')}")
            out.append(f"- **Best score:** {stats.get('bestScore')}")
            out.append(f"- **Submissions (24h):** {stats.get('submissionsLast24h')}")
        else:
            out.append("_Platform stats are offline right now (ratings ledger disconnected)._")
    return "\n".join(out)


def recent_rows():
    data, err = api_get("/api/submissions/recent?limit=20")
    if err or not data:
        return []
    subs = data.get("submissions") or []
    rows = []
    for s in subs:
        if not isinstance(s, dict):
            continue
        rows.append(
            [
                str(s.get("ratedAt") or "")[:19].replace("T", " "),
                s.get("wallet") or "—",
                s.get("filename") or "—",
                s.get("dataType") or "—",
                s.get("score", "—"),
                s.get("tier") or tier_for_score(s.get("score")),
                s.get("clawdReward", "—"),
                s.get("source") or "—",
            ]
        )
    return rows


# --------------------------------------------------------------------------
# UI copy
# --------------------------------------------------------------------------

MANIFEST_TEMPLATE = """{
  "name": "my-model-7b",
  "version": "1.0.0",
  "chain_id": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  "repo": "https://huggingface.co/you/my-model",
  "weights_sha256": "<64-hex sha256 of the canonical weights file>",
  "license": "apache-2.0",
  "modality": "text",
  "publisher": "<your address on the model's home chain>",
  "solana_address": "<your Solana address — anchor + rewards>",
  "registered_at": "2026-11-21T00:00:00Z"
}"""

DATASET_TEMPLATE = """{
  "manifestVersion": 1,
  "kind": "dataset",
  "title": "My Solana training dataset",
  "host": { "type": "huggingface", "ref": "you/my-dataset", "revision": "main" },
  "format": "jsonl",
  "declaredRows": 0,
  "declaredBytes": 0,
  "contentHash": "sha256:<hex of canonical manifest-listed file hashes>",
  "license": "apache-2.0",
  "captionSample": ["up to 20 representative rows/captions, inline"]
}"""

ROBOT_TEMPLATE = """{
  "manifestVersion": 1,
  "kind": "robot",
  "title": "My robot episode dataset",
  "host": { "type": "huggingface", "ref": "you/my-robot-data", "revision": "main" },
  "format": "lerobot",
  "declaredEpisodes": 0,
  "declaredBytes": 0,
  "contentHash": "sha256:<hex of canonical manifest-listed file hashes>",
  "license": "apache-2.0",
  "taskDescription": "What task does the robot perform in these episodes?",
  "schema": { "observation": "joint states / end-effector pose / camera refs", "action": "commanded deltas or targets", "timestamp": "monotonic seconds" },
  "captionSample": []
}"""

CSS = """
.gradio-container { background: #0a0a16 !important; }
footer { visibility: hidden; }
h1, h2, h3 { letter-spacing: .2px; }
"""

HEADER_MD = """
# 🦞 TrainToEarn — Submit Data, Earn $CLAWD
**Train AI models, get rated by Jev, earn $CLAWD.** This Space is a front door to
[earn.onchainai.fund](https://earn.onchainai.fund) and the **Clawd Omnichain Model Registry** —
models from any chain, anchored natively on Solana.

Rewards are paid for *quality-rated training data* — every submission is scored 0–100 by the
Jev decision engine across five checks (Solana-specific, teaches something, original,
well-formed, safe to train). This is not financial advice and nothing here promises profit.

> ⏰ The backend runs on a free Render tier and can take ~30–60s to wake on the first call.
> **This Space never asks for private keys or seed phrases — ever.** Signing happens in your own wallet.
"""

ABOUT_MD = """
## What is TrainToEarn?

TrainToEarn is a Solana train-to-earn platform: contribute training data — text,
image+caption pairs, video, bulk datasets, robot trajectories — and the **Jev**
decision engine (TypeSafe `typesafeai-jev-1-14-0` via the Neon AI Gateway, blended
with a local heuristic) rates its quality in realtime. Ratings map to tiers —
**Bronze** (≥0) · **Silver** (≥65) · **Gold** (≥75) · **Diamond** (≥85) · **Platinum** (≥92) —
and a $CLAWD reward that accrues to your Solana wallet in the public rewards ledger.

Honesty rule: when the Jev gateway doesn't return a verdict, the rating is labelled
`heuristic-fallback` and shown as exactly that — a heuristic score is never dressed
up as a Jev verdict. Content flagged unsafe to train on is capped and earns nothing
until fixed.

## The Clawd Omnichain Model Registry

One manifest per model version, hashed (SHA-256 over canonical JSON) and anchored
on Solana — by memo transaction today, by PDA as the program ships. Publishers on
any chain (EVM, Bitcoin, NEAR, Solana…) sign the proof message
`clawd-registry:v1:<manifest_sha256>` with their home-chain key; verification is
signature checking only, no custody. Tiers say exactly how much has been checked:
**T0 Unverified → T1 Hash-verified → T2 Rated → T3 Reproduced.**

## Links

- 🌐 App: [earn.onchainai.fund](https://earn.onchainai.fund)
- 💻 Code: [github.com/Solizardking/train-to-earn](https://github.com/Solizardking/train-to-earn)
- 🛠️ CLI: the `cli/` folder in the repo — log in with your wallet, submit data and
  register models from your terminal (`github.com/Solizardking/train-to-earn/tree/main/cli`)
- 🤖 Agent skill: [`skills/traintoearn-omnichain/SKILL.md`](https://github.com/Solizardking/train-to-earn/blob/main/skills/traintoearn-omnichain/SKILL.md) —
  any agent on any chain can participate by following it
- 📜 Registry spec: `docs/omnichain-registry.md` · Jev-2 engine spec: `docs/jev2-engine.md` (in the repo)

## Rules of the road

- **Never** paste a private key or seed phrase anywhere in this Space — there is
  no legitimate reason to. Report anyone who asks.
- Rewards are for quality-rated training data only. Scores are computed by the
  engine, not promised by anyone.
- Submitted content is rated, not published — the public feed shows only
  truncated wallets, filenames, scores, tiers and rewards.
"""


# --------------------------------------------------------------------------
# App
# --------------------------------------------------------------------------

def build_app():
    theme = gr.themes.Soft(
        primary_hue=gr.themes.colors.purple,
        secondary_hue=gr.themes.colors.green,
        neutral_hue=gr.themes.colors.slate,
    )
    with gr.Blocks(title="TrainToEarn — Submit Data, Earn $CLAWD", theme=theme, css=CSS) as demo:
        gr.Markdown(HEADER_MD)

        with gr.Tabs():
            # ---------------- Submit data ----------------
            with gr.Tab("Submit data"):
                wallet_in = gr.Textbox(
                    label="Solana payout wallet",
                    placeholder="Your Solana address — ratings accrue rewards here",
                    info="Rewards and ratings are recorded against this address. It is an address, never a key.",
                )
                wallet_warn = gr.Markdown()
                wallet_in.change(wallet_warning, inputs=wallet_in, outputs=wallet_warn)

                with gr.Accordion("📝 Text — paste or upload (.jsonl / .txt)", open=True):
                    text_in = gr.Textbox(label="Training text", lines=8, placeholder="Instruction/response pairs, worked examples, Solana code with explanation…")
                    text_file = gr.File(label="…or upload a text file", type="filepath", file_types=[".txt", ".jsonl", ".md", ".csv", ".json"])
                    text_btn = gr.Button("Rate my text", variant="primary")
                    text_out = gr.Markdown()
                    text_btn.click(submit_text, inputs=[wallet_in, text_in, text_file], outputs=text_out)

                with gr.Accordion("🖼️ Image + caption pairs", open=False):
                    gr.Markdown(
                        "Upload a few images and give each one a caption (one per line, in upload order). "
                        "Captions are mandatory — an uncaptioned image is not training data. Platform limits: "
                        "≤ 50 pairs, ≤ 10 MB per image; for larger sets host them and use the Dataset form."
                    )
                    img_files = gr.File(label="Images", type="filepath", file_count="multiple", file_types=[".png", ".jpg", ".jpeg", ".webp", ".gif"])
                    img_captions = gr.Textbox(label="Captions (one per line)", lines=5)
                    img_btn = gr.Button("Rate my image pairs", variant="primary")
                    img_out = gr.Markdown()
                    img_btn.click(submit_images, inputs=[wallet_in, img_files, img_captions], outputs=img_out)

                with gr.Accordion("🎬 Video — by reference", open=False):
                    gr.Markdown("Video is rated by reference only (≤ 10 minutes): the backend samples frames + metadata, it never ingests the full file.")
                    vid_url = gr.Textbox(label="Video URL", placeholder="https://huggingface.co/datasets/you/clips/resolve/main/clip.mp4")
                    vid_caption = gr.Textbox(label="Caption / transcript (optional)", lines=3)
                    vid_btn = gr.Button("Rate my video", variant="primary")
                    vid_out = gr.Markdown()
                    vid_btn.click(submit_video, inputs=[wallet_in, vid_url, vid_caption], outputs=vid_out)

                with gr.Accordion("🗂️ Dataset — manifest by reference", open=False):
                    gr.Markdown(
                        "Bulk datasets are rated by manifest — the data stays hosted with you (Hugging Face / Arweave) "
                        "and the backend validates declarations against sampled reads. Paste a manifest JSON, or just a URL."
                    )
                    ds_manifest = gr.Textbox(label="Dataset manifest JSON", lines=10, value=DATASET_TEMPLATE)
                    ds_url = gr.Textbox(label="…or dataset URL", placeholder="https://huggingface.co/datasets/you/my-dataset")
                    ds_btn = gr.Button("Submit dataset for rating", variant="primary")
                    ds_out = gr.Markdown()
                    ds_btn.click(
                        submit_dataset,
                        inputs=[wallet_in, ds_manifest, ds_url],
                        outputs=ds_out,
                    )

                with gr.Accordion("🤖 Robot data — episode manifest", open=False):
                    gr.Markdown(
                        "LeRobot-style episode datasets (or HDF5 / JSONL traces) by reference. "
                        "A task description is required for robot data."
                    )
                    rb_manifest = gr.Textbox(label="Robot episode manifest JSON", lines=10, value=ROBOT_TEMPLATE)
                    rb_btn = gr.Button("Submit robot data for rating", variant="primary")
                    rb_out = gr.Markdown()
                    rb_btn.click(
                        submit_robot,
                        inputs=[wallet_in, rb_manifest],
                        outputs=rb_out,
                    )

            # ---------------- Models & registry ----------------
            with gr.Tab("Models & registry"):
                gr.Markdown(
                    "## Clawd Omnichain Model Registry\n"
                    "Models from any chain, anchored natively on Solana. Tiers: "
                    "**T0** Unverified · **T1** Hash-verified · **T2** Rated · **T3** Reproduced."
                )
                reg_status = gr.Markdown()
                reg_table = gr.Dataframe(
                    headers=["Model", "Publisher", "Chain", "Tier", "Modality", "Manifest SHA-256"],
                    type="array",
                    interactive=False,
                    label="Registry models",
                )
                reg_refresh = gr.Button("🔄 Refresh registry")
                reg_refresh.click(registry_rows, outputs=[reg_table, reg_status])

                gr.Markdown(
                    "### Register a model\n"
                    "1. Finalize your manifest below. 2. Compute the hash + messages. "
                    "3. Sign the proof message with your home-chain wallet **in your own tooling**. "
                    "4. Paste the signature and submit.\n\n"
                    "**This Space NEVER asks for private keys or seed phrases. If anything ever does, it is a scam.**"
                )
                man_in = gr.Textbox(label="Model manifest JSON", lines=12, value=MANIFEST_TEMPLATE)
                hash_btn = gr.Button("Compute SHA-256 + proof message + memo payload")
                man_hash = gr.Textbox(label="Manifest SHA-256", interactive=False)
                man_proof = gr.Textbox(label="Proof message — sign this", interactive=False)
                man_memo = gr.Textbox(label="Solana memo payload — anchor this", interactive=False)
                man_note = gr.Markdown()
                hash_btn.click(
                    compute_manifest_messages,
                    inputs=man_in,
                    outputs=[man_hash, man_proof, man_memo, man_note],
                )
                sig_in = gr.Textbox(label="Signature of the proof message (from your own wallet)", lines=2)
                reg_btn = gr.Button("Submit registration", variant="primary")
                reg_out = gr.Markdown()
                reg_btn.click(register_model, inputs=[man_in, sig_in], outputs=reg_out)

            # ---------------- Rewards ----------------
            with gr.Tab("Rewards"):
                rw_wallet = gr.Textbox(label="Solana wallet", placeholder="Wallet to look up")
                rw_btn = gr.Button("Look up rewards", variant="primary")
                rw_out = gr.Markdown()
                payout_table = gr.Dataframe(
                    headers=["Payout ID", "Amount ($CLAWD)", "Status", "Tx", "Requested"],
                    type="array",
                    interactive=False,
                    label="Payout history",
                )
                rw_btn.click(rewards_lookup, inputs=rw_wallet, outputs=[rw_out, payout_table])
                gr.Markdown("---")
                overview_out = gr.Markdown()
                recent_table = gr.Dataframe(
                    headers=["Rated at (UTC)", "Wallet", "File", "Type", "Score", "Tier", "Reward ($CLAWD)", "Engine"],
                    type="array",
                    interactive=False,
                    label="Recent submissions (public feed — content is never exposed)",
                )
                ov_btn = gr.Button("🔄 Refresh platform overview")
                ov_btn.click(platform_overview, outputs=overview_out)
                ov_btn.click(recent_rows, outputs=recent_table)

            # ---------------- About ----------------
            with gr.Tab("About"):
                gr.Markdown(ABOUT_MD)

        demo.load(registry_rows, outputs=[reg_table, reg_status])
        demo.load(platform_overview, outputs=overview_out)
        demo.load(recent_rows, outputs=recent_table)

    return demo


if __name__ == "__main__":
    build_app().launch()
