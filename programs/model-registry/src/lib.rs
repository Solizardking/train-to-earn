use anchor_lang::prelude::*;

declare_id!("A6b32KvvsqexTY7VXF3hA6N7ciayqDFKQsEa8Mm2mb92");

// ── constants ────────────────────────────────────────────────────────────────
const MAX_URI_LEN: usize = 256;
const MAX_HASH_LEN: usize = 96;
const MAX_MODEL_TYPE_LEN: usize = 64;
const MAX_EVALUATION_NAME_LEN: usize = 32; // PDA seed length limit
const MAX_NAME_LEN: usize = 64;
const MAX_DESC_LEN: usize = 512;
const MAX_HF_REPO_LEN: usize = 128;   // e.g. "meta-llama/Llama-3"
const MAX_CID_LEN: usize = 32;        // PDA seed id; store full CIDs in metadata_uri
const MAX_CAP_LEN: usize = 32;        // single capability string
const MAX_CAPS: usize = 16;           // max capability tags per model
const MAX_CLAWD_TAG_LEN: usize = 16;  // feedback tag

// CLAWD token mint on mainnet (update after deploy)
pub const CLAWD_MINT: &str = "8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump";

// ── program ──────────────────────────────────────────────────────────────────
#[program]
pub mod model_registry {
    use super::*;

    // ── v1 instructions (original 8004-identity layer) ────────────────────

    pub fn register_model_identity_v1(
        ctx: Context<RegisterModelIdentityV1>,
        args: RegisterModelIdentityArgs,
    ) -> Result<()> {
        require!(!args.model_registration_uri.is_empty(), ModelRegistryError::MissingRegistrationUri);
        require!(args.model_registration_uri.len() <= MAX_URI_LEN, ModelRegistryError::RegistrationUriTooLong);
        require!(args.artifact_hash.len() <= MAX_HASH_LEN, ModelRegistryError::ArtifactHashTooLong);
        require!(args.model_type.len() <= MAX_MODEL_TYPE_LEN, ModelRegistryError::ModelTypeTooLong);
        require!(args.royalty_bps <= 10_000, ModelRegistryError::RoyaltyOutOfRange);

        let identity = &mut ctx.accounts.model_identity;
        let clock = Clock::get()?;

        identity.version = 1;
        identity.bump = ctx.bumps.model_identity;
        identity.asset = ctx.accounts.asset.key();
        identity.collection = ctx.accounts.collection.as_ref().map(|a| a.key());
        identity.authority = ctx.accounts.authority.key();
        identity.model_registration_uri = args.model_registration_uri;
        identity.artifact_hash = args.artifact_hash;
        identity.model_type = args.model_type;
        identity.royalty_bps = args.royalty_bps;
        identity.lifecycle_checks = LifecycleChecks { transfer: true, update: true, execute: true };
        identity.active = true;
        identity.created_at = clock.unix_timestamp;
        identity.updated_at = clock.unix_timestamp;

        emit!(ModelIdentityRegisteredV1 {
            model_identity: identity.key(),
            asset: identity.asset,
            authority: identity.authority,
            model_registration_uri: identity.model_registration_uri.clone(),
            timestamp: identity.created_at,
        });

        Ok(())
    }

    pub fn update_model_identity_v1(
        ctx: Context<UpdateModelIdentityV1>,
        args: UpdateModelIdentityArgs,
    ) -> Result<()> {
        require!(args.model_registration_uri.len() <= MAX_URI_LEN, ModelRegistryError::RegistrationUriTooLong);
        require!(args.artifact_hash.len() <= MAX_HASH_LEN, ModelRegistryError::ArtifactHashTooLong);

        let identity = &mut ctx.accounts.model_identity;
        identity.model_registration_uri = args.model_registration_uri;
        identity.artifact_hash = args.artifact_hash;
        identity.updated_at = Clock::get()?.unix_timestamp;

        emit!(ModelIdentityUpdatedV1 {
            model_identity: identity.key(),
            asset: identity.asset,
            authority: identity.authority,
            model_registration_uri: identity.model_registration_uri.clone(),
            timestamp: identity.updated_at,
        });

        Ok(())
    }

    pub fn deactivate_model_identity_v1(ctx: Context<DeactivateModelIdentityV1>) -> Result<()> {
        let identity = &mut ctx.accounts.model_identity;
        identity.active = false;
        identity.updated_at = Clock::get()?.unix_timestamp;

        emit!(ModelIdentityDeactivatedV1 {
            model_identity: identity.key(),
            asset: identity.asset,
            authority: identity.authority,
            timestamp: identity.updated_at,
        });

        Ok(())
    }

    pub fn record_model_evaluation_v1(
        ctx: Context<RecordModelEvaluationV1>,
        args: RecordModelEvaluationArgs,
    ) -> Result<()> {
        require!(args.score_bps <= 10_000, ModelRegistryError::EvaluationScoreOutOfRange);
        require!(args.evaluation_name.len() <= MAX_EVALUATION_NAME_LEN, ModelRegistryError::EvaluationNameTooLong);
        require!(args.attestation_uri.len() <= MAX_URI_LEN, ModelRegistryError::RegistrationUriTooLong);

        let evaluation = &mut ctx.accounts.evaluation;
        let identity = &ctx.accounts.model_identity;
        let clock = Clock::get()?;

        evaluation.version = 1;
        evaluation.bump = ctx.bumps.evaluation;
        evaluation.model_identity = identity.key();
        evaluation.asset = identity.asset;
        evaluation.attestor = ctx.accounts.attestor.key();
        evaluation.evaluation_name = args.evaluation_name;
        evaluation.score_bps = args.score_bps;
        evaluation.attestation_uri = args.attestation_uri;
        evaluation.created_at = clock.unix_timestamp;

        emit!(ModelEvaluationRecordedV1 {
            evaluation: evaluation.key(),
            model_identity: identity.key(),
            asset: identity.asset,
            attestor: evaluation.attestor,
            score_bps: evaluation.score_bps,
            timestamp: evaluation.created_at,
        });

        Ok(())
    }

    // ── v2 instructions (CLAWD + Pinata + Hugging Face + 8004-style) ──────

    /// Register an AI model with full CLAWD ecosystem metadata.
    /// Pins metadata to Pinata off-chain first; pass the resulting CID here.
    pub fn register_model_v2(
        ctx: Context<RegisterModelV2>,
        args: RegisterModelV2Args,
    ) -> Result<()> {
        require!(!args.name.is_empty(), ModelRegistryError::MissingRegistrationUri);
        require!(args.name.len() <= MAX_NAME_LEN, ModelRegistryError::NameTooLong);
        require!(args.description.len() <= MAX_DESC_LEN, ModelRegistryError::DescriptionTooLong);
        require!(args.hf_repo.len() <= MAX_HF_REPO_LEN, ModelRegistryError::HfRepoTooLong);
        require!(args.model_cid.len() <= MAX_CID_LEN, ModelRegistryError::CidTooLong);
        require!(args.metadata_uri.len() <= MAX_URI_LEN, ModelRegistryError::RegistrationUriTooLong);
        require!(args.capabilities.len() <= MAX_CAPS, ModelRegistryError::TooManyCapabilities);
        for capability in &args.capabilities {
            require!(capability.len() <= MAX_CAP_LEN, ModelRegistryError::CapabilityTooLong);
        }

        let model = &mut ctx.accounts.model;
        let clock = Clock::get()?;

        model.version = 2;
        model.bump = ctx.bumps.model;
        model.creator = ctx.accounts.authority.key();
        model.name = args.name;
        model.description = args.description;
        model.hf_repo = args.hf_repo;
        model.model_cid = args.model_cid;
        model.capabilities = args.capabilities;
        model.clawd_price = args.clawd_price;
        model.metadata_uri = args.metadata_uri;
        model.reputation_score = 0;
        model.total_reviews = 0;
        model.total_downloads = 0;
        model.clawd_revenue = 0;
        model.is_active = true;
        model.created_at = clock.unix_timestamp;
        model.updated_at = clock.unix_timestamp;

        emit!(ModelRegisteredV2 {
            model: model.key(),
            creator: model.creator,
            name: model.name.clone(),
            hf_repo: model.hf_repo.clone(),
            model_cid: model.model_cid.clone(),
            clawd_price: model.clawd_price,
            timestamp: model.created_at,
        });

        Ok(())
    }

    /// Update mutable fields on a v2 model (creator-only).
    pub fn update_model_v2(
        ctx: Context<UpdateModelV2>,
        new_description: Option<String>,
        new_clawd_price: Option<u64>,
        new_cid: Option<String>,
        new_metadata_uri: Option<String>,
    ) -> Result<()> {
        let model = &mut ctx.accounts.model;
        require!(model.creator == ctx.accounts.authority.key(), ModelRegistryError::Unauthorized);

        if let Some(d) = new_description {
            require!(d.len() <= MAX_DESC_LEN, ModelRegistryError::DescriptionTooLong);
            model.description = d;
        }
        if let Some(p) = new_clawd_price {
            model.clawd_price = p;
        }
        if let Some(cid) = new_cid {
            require!(cid.len() <= MAX_CID_LEN, ModelRegistryError::CidTooLong);
            model.model_cid = cid;
        }
        if let Some(uri) = new_metadata_uri {
            require!(uri.len() <= MAX_URI_LEN, ModelRegistryError::RegistrationUriTooLong);
            model.metadata_uri = uri;
        }
        model.updated_at = Clock::get()?.unix_timestamp;

        Ok(())
    }

    /// Deactivate a v2 model (creator-only).
    pub fn deactivate_model_v2(ctx: Context<UpdateModelV2>) -> Result<()> {
        let model = &mut ctx.accounts.model;
        require!(model.creator == ctx.accounts.authority.key(), ModelRegistryError::Unauthorized);
        model.is_active = false;
        model.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Record a download + CLAWD revenue increment (called by backend after verified payment).
    pub fn update_model_stats(
        ctx: Context<UpdateModelStats>,
        clawd_earned: u64,
    ) -> Result<()> {
        let model = &mut ctx.accounts.model;
        model.total_downloads = model.total_downloads.checked_add(1).ok_or(ModelRegistryError::Overflow)?;
        model.clawd_revenue = model.clawd_revenue.checked_add(clawd_earned).ok_or(ModelRegistryError::Overflow)?;
        model.updated_at = Clock::get()?.unix_timestamp;

        emit!(ModelStatsUpdated {
            model: model.key(),
            total_downloads: model.total_downloads,
            clawd_revenue: model.clawd_revenue,
            timestamp: model.updated_at,
        });

        Ok(())
    }

    /// Submit feedback (0–100 score) with optional Pinata proof URI and CLAWD-tagged capability.
    pub fn give_feedback(
        ctx: Context<GiveFeedback>,
        args: GiveFeedbackArgs,
    ) -> Result<()> {
        require!(args.score <= 100, ModelRegistryError::EvaluationScoreOutOfRange);
        require!(args.tag1.len() <= MAX_CLAWD_TAG_LEN, ModelRegistryError::TagTooLong);
        if let Some(ref t) = args.tag2 { require!(t.len() <= MAX_CLAWD_TAG_LEN, ModelRegistryError::TagTooLong); }
        if let Some(ref u) = args.proof_uri { require!(u.len() <= MAX_URI_LEN, ModelRegistryError::RegistrationUriTooLong); }

        let feedback = &mut ctx.accounts.feedback;
        feedback.version = 1;
        feedback.bump = ctx.bumps.feedback;
        feedback.model = ctx.accounts.model.key();
        feedback.reviewer = ctx.accounts.reviewer.key();
        feedback.score = args.score;
        feedback.tag1 = args.tag1;
        feedback.tag2 = args.tag2.unwrap_or_default();
        feedback.proof_uri = args.proof_uri.unwrap_or_default();
        feedback.timestamp = Clock::get()?.unix_timestamp;

        // Rolling average reputation on the parent model
        let model = &mut ctx.accounts.model;
        model.total_reviews = model.total_reviews.checked_add(1).ok_or(ModelRegistryError::Overflow)?;
        let prev_total = (model.reputation_score as u64)
            .checked_mul(model.total_reviews - 1)
            .ok_or(ModelRegistryError::Overflow)?;
        model.reputation_score = prev_total
            .checked_add(args.score as u64)
            .ok_or(ModelRegistryError::Overflow)?
            .checked_div(model.total_reviews)
            .unwrap_or(0) as u8;

        emit!(FeedbackSubmitted {
            feedback: feedback.key(),
            model: model.key(),
            reviewer: feedback.reviewer,
            score: feedback.score,
            timestamp: feedback.timestamp,
        });

        Ok(())
    }
}

// ── account structs ───────────────────────────────────────────────────────────

/// v1 identity record — 8004-style PDA keyed on MPL Core asset.
#[account]
pub struct ModelIdentityV1 {
    pub version: u8,
    pub bump: u8,
    pub asset: Pubkey,
    pub collection: Option<Pubkey>,
    pub authority: Pubkey,
    pub model_registration_uri: String,
    pub artifact_hash: String,
    pub model_type: String,
    pub royalty_bps: u16,
    pub lifecycle_checks: LifecycleChecks,
    pub active: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

impl ModelIdentityV1 {
    pub const SPACE: usize = 8
        + 1 + 1 + 32 + (1 + 32) + 32
        + (4 + MAX_URI_LEN) + (4 + MAX_HASH_LEN) + (4 + MAX_MODEL_TYPE_LEN)
        + 2 + LifecycleChecks::SPACE + 1 + 8 + 8;
}

/// v1 evaluation record — stores scored attestation per model identity.
#[account]
pub struct ModelEvaluationV1 {
    pub version: u8,
    pub bump: u8,
    pub model_identity: Pubkey,
    pub asset: Pubkey,
    pub attestor: Pubkey,
    pub evaluation_name: String,
    pub score_bps: u16,
    pub attestation_uri: String,
    pub created_at: i64,
}

impl ModelEvaluationV1 {
    pub const SPACE: usize = 8
        + 1 + 1 + 32 + 32 + 32
        + (4 + MAX_EVALUATION_NAME_LEN)
        + 2 + (4 + MAX_URI_LEN) + 8;
}

/// v2 model — CLAWD + Pinata + Hugging Face + reputation.
#[account]
pub struct AiModelV2 {
    pub version: u8,
    pub bump: u8,
    pub creator: Pubkey,
    pub name: String,
    pub description: String,
    pub hf_repo: String,
    pub model_cid: String,              // PDA seed id; full artifact CIDs live off-chain
    pub capabilities: Vec<String>,      // e.g. ["zk-transform", "code-compression"]
    pub clawd_price: u64,               // per-inference price in CLAWD lamports
    pub metadata_uri: String,           // Pinata gateway URL
    pub reputation_score: u8,           // 0–100 rolling average
    pub total_reviews: u64,
    pub total_downloads: u64,
    pub clawd_revenue: u64,             // total CLAWD earned (lamports)
    pub is_active: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

impl AiModelV2 {
    pub const SPACE: usize = 8
        + 1 + 1 + 32
        + (4 + MAX_NAME_LEN)
        + (4 + MAX_DESC_LEN)
        + (4 + MAX_HF_REPO_LEN)
        + (4 + MAX_CID_LEN)
        + (4 + MAX_CAPS * (4 + MAX_CAP_LEN))
        + 8
        + (4 + MAX_URI_LEN)
        + 1 + 8 + 8 + 8
        + 1 + 8 + 8;
}

/// Per-reviewer feedback PDA.
#[account]
pub struct ModelFeedback {
    pub version: u8,
    pub bump: u8,
    pub model: Pubkey,
    pub reviewer: Pubkey,
    pub score: u8,
    pub tag1: String,
    pub tag2: String,
    pub proof_uri: String,
    pub timestamp: i64,
}

impl ModelFeedback {
    pub const SPACE: usize = 8
        + 1 + 1 + 32 + 32 + 1
        + (4 + MAX_CLAWD_TAG_LEN) + (4 + MAX_CLAWD_TAG_LEN)
        + (4 + MAX_URI_LEN) + 8;
}

// ── context structs ───────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct RegisterModelIdentityV1<'info> {
    #[account(
        init, payer = payer, space = ModelIdentityV1::SPACE,
        seeds = [b"model_identity", asset.key().as_ref()],
        bump
    )]
    pub model_identity: Account<'info, ModelIdentityV1>,
    /// CHECK: MPL Core asset; production registry validates via Core CPI.
    pub asset: UncheckedAccount<'info>,
    /// CHECK: Optional MPL Core collection authority context.
    pub collection: Option<UncheckedAccount<'info>>,
    pub authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateModelIdentityV1<'info> {
    #[account(
        mut,
        seeds = [b"model_identity", model_identity.asset.as_ref()],
        bump = model_identity.bump,
        has_one = authority @ ModelRegistryError::Unauthorized
    )]
    pub model_identity: Account<'info, ModelIdentityV1>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct DeactivateModelIdentityV1<'info> {
    #[account(
        mut,
        seeds = [b"model_identity", model_identity.asset.as_ref()],
        bump = model_identity.bump,
        has_one = authority @ ModelRegistryError::Unauthorized
    )]
    pub model_identity: Account<'info, ModelIdentityV1>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(args: RecordModelEvaluationArgs)]
pub struct RecordModelEvaluationV1<'info> {
    #[account(
        seeds = [b"model_identity", model_identity.asset.as_ref()],
        bump = model_identity.bump
    )]
    pub model_identity: Account<'info, ModelIdentityV1>,
    #[account(
        init, payer = payer, space = ModelEvaluationV1::SPACE,
        seeds = [b"model_evaluation", model_identity.asset.as_ref(), args.evaluation_name.as_bytes()],
        bump
    )]
    pub evaluation: Account<'info, ModelEvaluationV1>,
    pub attestor: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(args: RegisterModelV2Args)]
pub struct RegisterModelV2<'info> {
    #[account(
        init, payer = payer, space = AiModelV2::SPACE,
        seeds = [b"clawd_model_v2", authority.key().as_ref(), args.model_cid.as_bytes()],
        bump
    )]
    pub model: Account<'info, AiModelV2>,
    pub authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateModelV2<'info> {
    #[account(
        mut,
        seeds = [b"clawd_model_v2", authority.key().as_ref(), model.model_cid.as_bytes()],
        bump = model.bump
    )]
    pub model: Account<'info, AiModelV2>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateModelStats<'info> {
    #[account(
        mut,
        seeds = [b"clawd_model_v2", model.creator.as_ref(), model.model_cid.as_bytes()],
        bump = model.bump,
        constraint = model.creator == updater.key() @ ModelRegistryError::Unauthorized
    )]
    pub model: Account<'info, AiModelV2>,
    pub updater: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(args: GiveFeedbackArgs)]
pub struct GiveFeedback<'info> {
    #[account(mut)]
    pub model: Account<'info, AiModelV2>,
    #[account(
        init, payer = payer, space = ModelFeedback::SPACE,
        seeds = [b"clawd_feedback", model.key().as_ref(), reviewer.key().as_ref()],
        bump
    )]
    pub feedback: Account<'info, ModelFeedback>,
    pub reviewer: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// ── arg structs ───────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RegisterModelIdentityArgs {
    pub model_registration_uri: String,
    pub artifact_hash: String,
    pub model_type: String,
    pub royalty_bps: u16,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpdateModelIdentityArgs {
    pub model_registration_uri: String,
    pub artifact_hash: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RecordModelEvaluationArgs {
    pub evaluation_name: String,
    pub score_bps: u16,
    pub attestation_uri: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RegisterModelV2Args {
    pub name: String,
    pub description: String,
    pub hf_repo: String,
    pub model_cid: String,
    pub capabilities: Vec<String>,
    pub clawd_price: u64,
    pub metadata_uri: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct GiveFeedbackArgs {
    pub score: u8,
    pub tag1: String,
    pub tag2: Option<String>,
    pub proof_uri: Option<String>,
}

// ── shared types ──────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct LifecycleChecks {
    pub transfer: bool,
    pub update: bool,
    pub execute: bool,
}

impl LifecycleChecks {
    pub const SPACE: usize = 3;
}

// ── events ────────────────────────────────────────────────────────────────────

#[event]
pub struct ModelIdentityRegisteredV1 {
    pub model_identity: Pubkey,
    pub asset: Pubkey,
    pub authority: Pubkey,
    pub model_registration_uri: String,
    pub timestamp: i64,
}

#[event]
pub struct ModelIdentityUpdatedV1 {
    pub model_identity: Pubkey,
    pub asset: Pubkey,
    pub authority: Pubkey,
    pub model_registration_uri: String,
    pub timestamp: i64,
}

#[event]
pub struct ModelIdentityDeactivatedV1 {
    pub model_identity: Pubkey,
    pub asset: Pubkey,
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ModelEvaluationRecordedV1 {
    pub evaluation: Pubkey,
    pub model_identity: Pubkey,
    pub asset: Pubkey,
    pub attestor: Pubkey,
    pub score_bps: u16,
    pub timestamp: i64,
}

#[event]
pub struct ModelRegisteredV2 {
    pub model: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub hf_repo: String,
    pub model_cid: String,
    pub clawd_price: u64,
    pub timestamp: i64,
}

#[event]
pub struct ModelStatsUpdated {
    pub model: Pubkey,
    pub total_downloads: u64,
    pub clawd_revenue: u64,
    pub timestamp: i64,
}

#[event]
pub struct FeedbackSubmitted {
    pub feedback: Pubkey,
    pub model: Pubkey,
    pub reviewer: Pubkey,
    pub score: u8,
    pub timestamp: i64,
}

// ── errors ────────────────────────────────────────────────────────────────────

#[error_code]
pub enum ModelRegistryError {
    #[msg("Model registration URI is required")]
    MissingRegistrationUri,
    #[msg("Registration URI exceeds maximum length")]
    RegistrationUriTooLong,
    #[msg("Artifact hash exceeds maximum length")]
    ArtifactHashTooLong,
    #[msg("Model type exceeds maximum length")]
    ModelTypeTooLong,
    #[msg("Royalty basis points must be 0–10000")]
    RoyaltyOutOfRange,
    #[msg("Evaluation score must be 0–10000 (bps) or 0–100")]
    EvaluationScoreOutOfRange,
    #[msg("Evaluation name exceeds maximum length")]
    EvaluationNameTooLong,
    #[msg("Signer is not authorized")]
    Unauthorized,
    #[msg("Model name exceeds maximum length")]
    NameTooLong,
    #[msg("Description exceeds maximum length")]
    DescriptionTooLong,
    #[msg("Hugging Face repo string exceeds maximum length")]
    HfRepoTooLong,
    #[msg("Model CID seed exceeds maximum length")]
    CidTooLong,
    #[msg("Too many capabilities (max 16)")]
    TooManyCapabilities,
    #[msg("Capability tag exceeds maximum length")]
    CapabilityTooLong,
    #[msg("Feedback tag exceeds maximum length")]
    TagTooLong,
    #[msg("Arithmetic overflow")]
    Overflow,
}
