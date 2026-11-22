import { useState } from 'react';
import {
  FiCheckCircle,
  FiClipboard,
  FiExternalLink,
  FiKey,
  FiTerminal,
  FiUploadCloud,
} from 'react-icons/fi';

// The official TrainToEarn CLI — lives in cli/ in the public repo
// (github.com/Solizardking/train-to-earn). It talks to the same API as
// this site: wallet-signature login, all-forms submission, uploads,
// the omnichain registry, and the rewards ledger.
//
// Keys never leave the user's machine: login signs a server challenge
// with the local Solana keypair; the server only ever sees the
// signature and the resulting session token.

const REPO_URL = 'https://github.com/Solizardking/train-to-earn';

const INSTALL_SNIPPET = `git clone https://github.com/Solizardking/train-to-earn.git
cd train-to-earn/cli
npm install -g .
traintoearn --help`;

const NPX_SNIPPET = `git clone https://github.com/Solizardking/train-to-earn.git
cd train-to-earn
npx ./cli login
npx ./cli submit text ./solana-pda-guide.md`;

const LOGIN_SNIPPET = `$ traintoearn login
Challenge received from earn.onchainai.fund
Sign this message to log in to TrainToEarn: …
Signing with local keypair 7xKZ…9dF2 (key never leaves this machine)
✓ Logged in — session token saved to ~/.config/traintoearn/auth.json (0600)

$ traintoearn whoami
Wallet: 7xKZ…9dF2 · Session valid · Rewards wallet = this wallet`;

const COMMANDS = [
  { cmd: 'traintoearn login', blurb: 'Sign a server challenge with your local Solana keypair and save the session token. Your keypair file is read locally only — nothing secret is ever sent.' },
  { cmd: 'traintoearn whoami', blurb: 'Show the logged-in wallet and session state (GET /api/auth/me).' },
  { cmd: 'traintoearn submit text <file>', blurb: 'Rate a text submission with Jev (POST /api/jev/rate). Prints score, tier, engine source, and the CLAWD reward.' },
  { cmd: 'traintoearn submit image <manifest.json>', blurb: 'Rate image + caption pairs by reference (POST /api/jev/rate-media, kind "image").' },
  { cmd: 'traintoearn submit video <url>', blurb: 'Rate a video by reference (POST /api/jev/rate-media, kind "video"). Async — the CLI polls the job for you.' },
  { cmd: 'traintoearn submit dataset <manifest.json>', blurb: 'Rate a bulk dataset by manifest (POST /api/jev/rate-dataset, kind "dataset"). Async job, polled to completion.' },
  { cmd: 'traintoearn submit robot <manifest.json>', blurb: 'Rate robot episode data by manifest (POST /api/jev/rate-dataset, kind "robot").' },
  { cmd: 'traintoearn upload <file | --url <url>>', blurb: 'Save a file or a by-reference item to your account uploads (POST /api/uploads, login required).' },
  { cmd: 'traintoearn models list', blurb: 'Browse the omnichain model registry (GET /api/registry/models) — name, publisher, home chain, tier, manifest hash.' },
  { cmd: 'traintoearn models register <manifest.json>', blurb: 'Build a registry manifest, print its SHA-256, the publisher-proof message to sign on your home chain, and the Solana memo payload to anchor it.' },
  { cmd: 'traintoearn balance', blurb: 'Your rewards ledger straight from the source: earned / paid / pending / claimable CLAWD (GET /api/rewards/balance/<wallet>).' },
  { cmd: 'traintoearn status', blurb: 'Platform status: submission totals, treasury, and per-modality engine state — including whether Jev is live or a rating would be heuristic-fallback.' },
];

function CodeCard({ title, code }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard unavailable — the snippet is selectable text
    }
  };
  return (
    <div style={terminalCardStyle}>
      <div style={terminalHeadStyle}>
        <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ ...dotStyle, background: '#FF6B6B' }} />
          <span style={{ ...dotStyle, background: '#FFD700' }} />
          <span style={{ ...dotStyle, background: '#14F195' }} />
          <span style={{ marginLeft: '8px', fontSize: '12px', color: '#B0B0B0' }}>{title}</span>
        </span>
        <button type="button" onClick={copy} style={copyBtnStyle} title="Copy">
          {copied ? <FiCheckCircle size={13} color="#14F195" /> : <FiClipboard size={13} />}
        </button>
      </div>
      <pre style={preStyle}>{code}</pre>
    </div>
  );
}

const terminalCardStyle = {
  background: '#0B0C10',
  border: '1px solid rgba(153,69,255,0.35)',
  borderRadius: '12px',
  overflow: 'hidden',
  boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
};

const terminalHeadStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '9px 12px',
  background: 'rgba(153,69,255,0.10)',
  borderBottom: '1px solid rgba(153,69,255,0.2)',
};

const dotStyle = { width: '10px', height: '10px', borderRadius: '50%', display: 'inline-block' };

const copyBtnStyle = {
  background: 'transparent',
  border: 'none',
  color: '#B0B0B0',
  cursor: 'pointer',
  display: 'inline-flex',
  padding: '2px',
};

const preStyle = {
  margin: 0,
  padding: '14px 16px',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: '12.5px',
  lineHeight: 1.6,
  color: '#D6E4FF',
  overflowX: 'auto',
  whiteSpace: 'pre',
};

export default function CliPage() {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(153,69,255,0.12), rgba(20,241,149,0.08))', border: '1px solid rgba(153,69,255,0.3)' }}>
        <span className="eyebrow"><FiTerminal style={{ marginRight: '6px' }} /> Official CLI</span>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', margin: '6px 0 12px', lineHeight: 1.05 }}>
          TrainToEarn from your <span className="gradient-text">terminal</span>
        </h2>
        <p className="text-secondary" style={{ lineHeight: 1.65, maxWidth: '820px', margin: 0 }}>
          The official CLI ships in the <code>cli/</code> folder of the public repo and speaks
          the same API as this site: log in with a wallet signature, submit training data in
          every form (text, image, video, dataset, robot), save uploads, browse and register
          models in the omnichain registry, and read your rewards ledger — scriptable, from
          any machine, on any chain&apos;s workflow. Agents can drive it too: every command
          prints machine-readable results.
        </p>
        <div style={{ display: 'flex', gap: '12px', marginTop: '18px', flexWrap: 'wrap' }}>
          <a className="btn btn-primary" href={REPO_URL} target="_blank" rel="noreferrer">
            <FiExternalLink size={14} style={{ marginRight: '6px' }} /> github.com/Solizardking/train-to-earn
          </a>
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0 }}>Install</h3>
          <CodeCard title="install — global" code={INSTALL_SNIPPET} />
          <CodeCard title="no install — npx from a clone" code={NPX_SNIPPET} />
          <p className="text-secondary" style={{ fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
            Requires Node.js 18+. The CLI has no custody features: it cannot move funds, and
            claims/payouts remain human actions on this site.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiKey size={17} color="#14F195" /> Log in — keys never leave your machine
          </h3>
          <CodeCard title="traintoearn login" code={LOGIN_SNIPPET} />
          <div style={{ padding: '14px 16px', borderRadius: '12px', background: 'rgba(20,241,149,0.06)', border: '1px solid rgba(20,241,149,0.22)' }}>
            <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.65 }}>
              <strong>How login works:</strong> the server issues a one-time challenge message;
              the CLI signs it locally with your Solana keypair (your Solana CLI id.json or a
              keypair path you pass with <code>--keypair</code>); the server verifies the
              signature and returns a session token. The keypair is read on your machine only —
              it is never uploaded, logged, or sent. The token is stored at{' '}
              <code>~/.config/traintoearn/auth.json</code> with 0600 permissions, and{' '}
              <code>traintoearn logout</code> deletes it. This is the same challenge → sign →
              verify flow as the <strong>Log in</strong> button in this site&apos;s header.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiUploadCloud size={17} color="#9945FF" /> Commands
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {COMMANDS.map(({ cmd, blurb }) => (
            <div
              key={cmd}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(220px, 340px) 1fr',
                gap: '14px',
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'rgba(25,27,35,0.88)',
                border: '1px solid rgba(255,255,255,0.08)',
                alignItems: 'baseline',
              }}
            >
              <code style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '13px', color: '#14F195', overflowWrap: 'anywhere' }}>{cmd}</code>
              <span className="text-secondary" style={{ fontSize: '13px', lineHeight: 1.55 }}>{blurb}</span>
            </div>
          ))}
        </div>
        <p className="text-secondary" style={{ fontSize: '12px', lineHeight: 1.6, marginTop: '14px' }}>
          Scores are labelled honestly everywhere: a <code>heuristic-fallback</code> result means
          the Jev gateway was unreachable and only the heuristic leg ran — the CLI prints that
          label verbatim, exactly like this site. Rewards are ledger facts from{' '}
          <code>/api/rewards/balance/&lt;wallet&gt;</code>, never promises.
        </p>
      </div>
    </section>
  );
}
