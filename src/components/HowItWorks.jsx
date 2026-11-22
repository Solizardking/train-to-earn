import { FaWallet, FaTrophy } from 'react-icons/fa';
import { FiUploadCloud, FiZap, FiCheckCircle } from 'react-icons/fi';

// Static onboarding guide: how to sign in with a Solana wallet, how to
// submit training data, what the Jev decision engine checks, and how the
// score turns into $CLAWD rewards. Tier thresholds/multipliers mirror
// contributionTiers in server/consensusTraining.js.

const STEPS = [
  {
    Icon: FaWallet,
    color: '#9945FF',
    title: '1. Sign in with your Solana wallet',
    body: 'Click "Select Wallet" in the top-right corner and choose Phantom, Solflare, or Backpack, then approve the connection in your wallet. There is no email or password — your wallet address is your account, and your ratings and rewards are saved to it. New to wallets? Install one free at phantom.app or solflare.com, create a wallet, then come back and connect.',
  },
  {
    Icon: FiUploadCloud,
    color: '#14F195',
    title: '2. Submit Solana training data',
    body: 'On the Portfolio tab, find the Jev Training-Data Rating panel. Paste your data or upload a .txt, .md, or .json file. The format that scores best is an instruction/response pair that teaches something about Solana — for example "Instruction: Explain how a Solana program uses a PDA. Response: …" with a real explanation and a concrete example.',
  },
  {
    Icon: FiZap,
    color: '#9945FF',
    title: '3. Jev rates it in realtime',
    body: 'The Jev decision model reads your submission and checks it against five criteria (below), then blends its verdict with a local quality heuristic into a single score from 0 to 100. You see the score, the tier, and every individual verdict the moment it finishes — usually a few seconds.',
  },
  {
    Icon: FaTrophy,
    color: '#FFD700',
    title: '4. Earn $CLAWD rewards',
    body: 'Your score lands in a reward tier. Higher tiers multiply your $CLAWD reward, and every rating is saved to your wallet profile so your totals build up over time. Improve a low-scoring submission — add detail, a worked example, correct terminology — and resubmit to climb tiers.',
  },
];

const CHECKS = [
  'Solana-specific — actually about Solana, not generic crypto or filler',
  'Teaches something — a model could learn a real fact or skill from it',
  'Original content — written by you, not copied or templated filler',
  'Well-formed — clear structure, readable, complete sentences',
  'Safe to train on — no secrets, private keys, or harmful content (unsafe data is capped at 20 points)',
];

const TIERS = [
  { tier: 'Platinum', range: '92 – 100', multiplier: '×8', color: '#E5E4E2', label: 'Exceptional consensus-ready data' },
  { tier: 'Diamond', range: '85 – 91', multiplier: '×6', color: '#7DD3FC', label: 'Premium model training signal' },
  { tier: 'Gold', range: '75 – 84', multiplier: '×4', color: '#FFD700', label: 'High-quality ecosystem data' },
  { tier: 'Silver', range: '65 – 74', multiplier: '×2.5', color: '#C0C0C0', label: 'Useful structured contribution' },
  { tier: 'Bronze', range: '0 – 64', multiplier: '×1', color: '#CD7F32', label: 'Baseline accepted contribution' },
];

export default function HowItWorks() {
  return (
    <div style={{ marginTop: '56px', textAlign: 'left' }}>
      <h2 style={{ fontSize: '30px', fontWeight: 700, textAlign: 'center', marginBottom: '8px' }}>
        How Train2Earn <span className="gradient-text">Works</span>
      </h2>
      <p className="text-secondary" style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 32px', lineHeight: 1.6 }}>
        Contribute Solana training data, let the Jev decision engine grade it, and earn
        $CLAWD for quality. Four steps, no sign-up form:
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
        {STEPS.map(({ Icon, color, title, body }) => (
          <div key={title} className="card" style={{ padding: '24px' }}>
            <Icon size={28} color={color} />
            <h3 style={{ margin: '14px 0 8px', fontSize: '17px', fontWeight: 600 }}>{title}</h3>
            <p className="text-secondary" style={{ fontSize: '14px', lineHeight: 1.6, margin: 0 }}>{body}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: '20px', padding: '24px' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '17px', fontWeight: 600 }}>
          What Jev checks — and how rewards work
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          <div>
            {CHECKS.map((check) => (
              <div key={check} style={{ display: 'flex', gap: '8px', padding: '4px 0', alignItems: 'flex-start' }}>
                <FiCheckCircle color="#14F195" size={15} style={{ marginTop: '3px', flexShrink: 0 }} />
                <span style={{ fontSize: '14px', lineHeight: 1.55 }}>{check}</span>
              </div>
            ))}
            <p className="text-secondary" style={{ fontSize: '13px', lineHeight: 1.6, marginTop: '12px' }}>
              Tips: complete explanations with a worked example score highest. Very short
              snippets, copied docs, and lorem-ipsum filler score near the bottom.
              Never include seed phrases or private keys — in your data or anywhere else.
            </p>
          </div>
          <div>
            {TIERS.map(({ tier, range, multiplier, color, label }) => (
              <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 0', fontSize: '14px' }}>
                <span style={{ color, fontWeight: 700, minWidth: '74px' }}>{tier}</span>
                <span className="text-secondary" style={{ minWidth: '62px' }}>{range}</span>
                <span style={{ fontWeight: 600, minWidth: '34px' }}>{multiplier}</span>
                <span className="text-secondary" style={{ fontSize: '13px' }}>{label}</span>
              </div>
            ))}
            <p className="text-secondary" style={{ fontSize: '13px', lineHeight: 1.6, marginTop: '12px' }}>
              Reward = (submission size + base) × tier multiplier, paid in $CLAWD and
              recorded against your wallet every time you submit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
