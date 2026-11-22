// Live smoke test for the Jev decision engine via the Neon AI Gateway.
// Usage: node scripts/test-jev.mjs
// Reads NEON_AI_GATEWAY_* + DATABASE_URL from .env. Prints no secrets.
import dotenv from 'dotenv';
dotenv.config();

const { listGatewayModels, rateTrainingData, jevConfigured, JEV_MODEL_ID } = await import('../server/jevRating.js');

console.log('Jev configured:', jevConfigured(), '| model:', JEV_MODEL_ID);

const list = await listGatewayModels();
console.log(`Gateway models: ${list.count} enabled on ${list.gatewayHost}`);
console.log('Jev model present:', list.models.some((m) => m.id === JEV_MODEL_ID));

const wallet = 'So1anaTestWa11etAddressForJevSmoke1111111111';
const good = await rateTrainingData({
  walletAddress: wallet,
  filename: 'solana-pda-guide.md',
  content: `Instruction: Explain how a Solana program uses a PDA.
Response: A Program Derived Address (PDA) is derived from a program id and seeds and falls off the Ed25519 curve, so only the owning program can sign for it via invoke_signed. In Anchor, seeds and bump are declared in the account constraints. Example: a vault PDA with seeds [b"vault", user.key()] escrows funds that only the vault program can move, which removes the need for a stored private key and makes the vault's authority fully auditable on-chain.`,
  metadata: { source: 'smoke-test' },
});
console.log('\nGOOD sample → score:', good.score, '| tier:', good.tier, '| reward:', good.clawdReward, 'CLAWD | source:', good.source);
console.log('verdicts:', JSON.stringify(good.verdicts, null, 2));
console.log('usage:', JSON.stringify(good.usage));
if (good.jevError) console.log('jevError:', good.jevError);

const junk = await rateTrainingData({
  walletAddress: wallet,
  filename: 'notes.txt',
  content: 'lorem ipsum todo placeholder unknown tbd. buy now click here. the the the the the.',
  metadata: { source: 'smoke-test' },
});
console.log('\nJUNK sample → score:', junk.score, '| tier:', junk.tier, '| reward:', junk.clawdReward, 'CLAWD | source:', junk.source);
console.log('verdicts:', JSON.stringify(junk.verdicts, null, 2));
