import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  FiActivity,
  FiBarChart2,
  FiCheckCircle,
  FiCpu,
  FiDatabase,
  FiGitBranch,
  FiLock,
  FiRefreshCw,
  FiShield,
  FiZap,
} from 'react-icons/fi';
import { apiGet, apiPost } from '../utils/api';

const DEFAULT_TRAINING_TEXT = `Decentralized AI training distributes model improvement across many nodes instead of relying on one central repository. Data owners keep datasets local, train or validate privately, and publish commitments, predictions, quality metrics, or model updates for aggregation.

Blockchain records contribution rights, usage, model versions, validator decisions, and rewards. Consensus learning adds a gossip-style communication phase where participants exchange predictions and confidence scores without exposing private datasets or proprietary models.

The result is a privacy-preserving training market for Solana AI models: better data diversity, transparent reward settlement, and lower dependency on centralized AI infrastructure.`;

const FALLBACK_OVERVIEW = {
  title: 'Decentralized AI Training Using Blockchain',
  subtitle: 'Consensus learning coordinates private local models, gossip-based prediction exchange, and on-chain contribution accounting.',
  phases: [],
  benefits: [],
  challenges: [],
};

const INITIAL_ROUND_FORM = {
  objective: 'Improve Solana AI data quality through consensus learning',
  modelType: 'CONSENSUS_LEARNING',
  datasetSummary: 'Privacy-preserving Solana AI training contribution',
  participantCount: 6,
  privacyMode: 'local-only',
};

const METRIC_LABELS = {
  completeness: 'Completeness',
  accuracy: 'Accuracy',
  uniqueness: 'Uniqueness',
  richness: 'Richness',
  relevance: 'Solana relevance',
  privacyPreservation: 'Privacy',
  consensusReadiness: 'Consensus ready',
  overallScore: 'Overall',
};

function MetricBar({ label, value }) {
  return (
    <div className="consensus-metric">
      <div>
        <span>{label}</span>
        <strong>{Number(value || 0).toFixed(1)}%</strong>
      </div>
      <div className="consensus-meter">
        <i style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }} />
      </div>
    </div>
  );
}

function ConsensusScene({ nodeCount = 8, active = true }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const width = mount.clientWidth || 900;
    const height = mount.clientHeight || 460;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090b13);

    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 1000);
    camera.position.set(0, 6, 17);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.domElement.className = 'consensus-canvas';
    renderer.domElement.dataset.consensusCanvas = 'true';
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enableZoom = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.55;

    scene.add(new THREE.AmbientLight(0x9fb6ff, 0.38));
    const keyLight = new THREE.PointLight(0x14f195, 2.2, 60);
    keyLight.position.set(6, 9, 10);
    scene.add(keyLight);
    const fillLight = new THREE.PointLight(0xffd166, 1.4, 44);
    fillLight.position.set(-8, -2, 8);
    scene.add(fillLight);

    const networkGroup = new THREE.Group();
    const nodeGroup = new THREE.Group();
    const lineGroup = new THREE.Group();
    const particleGroup = new THREE.Group();
    networkGroup.add(lineGroup, nodeGroup, particleGroup);
    scene.add(networkGroup);

    const positions = [];
    const safeCount = Math.max(5, Math.min(14, Number(nodeCount) || 8));
    for (let i = 0; i < safeCount; i += 1) {
      const angle = (i / safeCount) * Math.PI * 2;
      const radius = 7 + (i % 2) * 1.7;
      const y = Math.sin(i * 1.7) * 2.4;
      const position = new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      positions.push(position);

      const geometry = new THREE.IcosahedronGeometry(0.45 + (i % 3) * 0.08, 2);
      const material = new THREE.MeshPhongMaterial({
        color: i % 3 === 0 ? 0x9945ff : i % 3 === 1 ? 0x14f195 : 0xffd166,
        emissive: i % 2 === 0 ? 0x14f195 : 0x9945ff,
        emissiveIntensity: 0.28,
        shininess: 80,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(position);
      mesh.userData.phase = i * 0.55;
      mesh.userData.baseScale = 1 + (i % 4) * 0.04;
      nodeGroup.add(mesh);
    }

    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x14f195,
      transparent: true,
      opacity: 0.33,
    });
    positions.forEach((position, i) => {
      const next = positions[(i + 1) % positions.length];
      const chord = positions[(i + 3) % positions.length];
      [next, chord].forEach((target) => {
        const geometry = new THREE.BufferGeometry().setFromPoints([position, target]);
        lineGroup.add(new THREE.Line(geometry, lineMaterial.clone()));
      });
    });

    const particleMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
    });
    for (let i = 0; i < safeCount; i += 1) {
      const geometry = new THREE.SphereGeometry(0.07, 12, 12);
      const particle = new THREE.Mesh(geometry, particleMaterial.clone());
      particle.userData.from = positions[i];
      particle.userData.to = positions[(i + 1) % positions.length];
      particle.userData.offset = i / safeCount;
      particleGroup.add(particle);
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      const nextWidth = entry.contentRect.width;
      const nextHeight = entry.contentRect.height;
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    });
    resizeObserver.observe(mount);

    let frameId;
    const clock = new THREE.Clock();
    function animate() {
      const elapsed = clock.getElapsedTime();
      networkGroup.rotation.y = elapsed * 0.08;
      nodeGroup.children.forEach((node) => {
        const pulse = 1 + Math.sin(elapsed * 2.2 + node.userData.phase) * 0.08;
        node.scale.setScalar(node.userData.baseScale * pulse);
        node.rotation.x += 0.004;
        node.rotation.y += 0.006;
      });
      particleGroup.children.forEach((particle) => {
        const t = (elapsed * 0.18 + particle.userData.offset) % 1;
        particle.position.lerpVectors(particle.userData.from, particle.userData.to, t);
        particle.material.opacity = 0.3 + Math.sin(t * Math.PI) * 0.55;
      });
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    }

    if (active) animate();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
          else object.material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [active, nodeCount]);

  return <div className="consensus-scene" ref={mountRef} aria-label="Consensus learning network visualization" />;
}

export default function ConsensusTraining({ publicPreview = false }) {
  const { publicKey } = useWallet();
  const [overview, setOverview] = useState(FALLBACK_OVERVIEW);
  const [stats, setStats] = useState(null);
  const [trainingText, setTrainingText] = useState(DEFAULT_TRAINING_TEXT);
  const [qualityResult, setQualityResult] = useState(null);
  const [qualityError, setQualityError] = useState('');
  const [qualityLoading, setQualityLoading] = useState(false);
  const [roundForm, setRoundForm] = useState(INITIAL_ROUND_FORM);
  const [roundResult, setRoundResult] = useState(null);
  const [roundError, setRoundError] = useState('');
  const [roundLoading, setRoundLoading] = useState(false);
  const [inferencePrompt, setInferencePrompt] = useState('How should a Solana AI protocol aggregate private local models without exposing raw training data?');
  const [inferenceResult, setInferenceResult] = useState(null);
  const [inferenceLoading, setInferenceLoading] = useState(false);

  const walletAddress = publicKey?.toString() || null;

  const fetchOverview = useCallback(async () => {
    try {
      const response = await apiGet('/api/training/overview');
      setOverview(response.overview || FALLBACK_OVERVIEW);
      setStats(response.stats || null);
    } catch (error) {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const phaseSummary = useMemo(() => overview.phases || [], [overview.phases]);
  const sceneNodeCount = roundResult?.nodes?.length || Number(roundForm.participantCount) || 8;

  async function analyzeContribution() {
    setQualityLoading(true);
    setQualityError('');
    try {
      const response = await apiPost('/api/training/quality', {
        content: trainingText,
        filename: 'decentralized-ai-training.md',
        mimeType: 'text/markdown',
        metadata: {
          source: 'consensus-learning-brief',
          privacyMode: roundForm.privacyMode,
          objective: roundForm.objective,
        },
        walletAddress,
      });
      setQualityResult(response.analysis);
      setRoundForm((current) => ({
        ...current,
        datasetSummary: `${response.analysis.tier} ${response.analysis.dataType} contribution, ${response.analysis.metrics.overallScore}% quality`,
      }));
    } catch (error) {
      setQualityError(error.message);
    } finally {
      setQualityLoading(false);
    }
  }

  async function startRound(event) {
    event.preventDefault();
    setRoundLoading(true);
    setRoundError('');
    try {
      const response = await apiPost('/api/training/rounds', {
        ...roundForm,
        participantCount: Number(roundForm.participantCount),
        walletAddress,
      });
      setRoundResult(response.round);
    } catch (error) {
      setRoundError(error.message);
    } finally {
      setRoundLoading(false);
    }
  }

  async function aggregateRound() {
    if (!roundResult?.id) return;
    setRoundLoading(true);
    setRoundError('');
    try {
      const response = await apiPost(`/api/training/rounds/${roundResult.id}/aggregate`, {});
      setRoundResult(response.round);
    } catch (error) {
      setRoundError(error.message);
    } finally {
      setRoundLoading(false);
    }
  }

  async function runInference() {
    setInferenceLoading(true);
    try {
      const response = await apiPost('/api/ai/consensus-inference', {
        prompt: inferencePrompt,
        participantCount: Number(roundForm.participantCount),
      });
      setInferenceResult(response.result);
    } catch (error) {
      setInferenceResult({ error: error.message });
    } finally {
      setInferenceLoading(false);
    }
  }

  return (
    <section className={`consensus-shell ${publicPreview ? 'is-preview' : ''}`}>
      <div className="consensus-hero">
        <ConsensusScene nodeCount={sceneNodeCount} />
        <div className="consensus-hero-copy">
          <span className="eyebrow">Consensus Learning</span>
          <h2>{overview.title}</h2>
          <p>{overview.subtitle}</p>
          <div className="consensus-stat-strip">
            <div><span>Treasury backing</span><strong>{typeof stats?.treasuryClawd === 'number' ? `${stats.treasuryClawd.toLocaleString()} CLAWD` : '—'}</strong></div>
            <div><span>Rounds this session</span><strong>{(stats?.activeRounds || 0) + (stats?.settledRounds || 0)}</strong></div>
          </div>
          <p className="text-secondary" style={{ fontSize: '13px', lineHeight: 1.6, marginTop: '12px' }}>
            Consensus rounds run as a local simulation on this server — the trainer nodes
            and votes are simulated, and round rewards are illustrative only. Real $CLAWD
            is earned through Jev-rated submissions on the Portfolio tab and paid from
            the treasury shown above.
          </p>
        </div>
      </div>

      <div className="consensus-phase-grid">
        {phaseSummary.map((phase, index) => (
          <article className="consensus-phase" key={phase.id}>
            <span>{index + 1}</span>
            <h3>{phase.name}</h3>
            <p>{phase.description}</p>
          </article>
        ))}
      </div>

      <div className="consensus-workbench">
        <div className="consensus-panel">
          <div className="consensus-panel-heading">
            <FiDatabase />
            <div>
              <span className="eyebrow">Training data quality</span>
              <h3>Score decentralized AI data before settlement.</h3>
            </div>
          </div>
          <textarea
            className="consensus-textarea"
            value={trainingText}
            onChange={(event) => setTrainingText(event.target.value)}
            rows={10}
          />
          <div className="consensus-actions">
            <button className="btn btn-primary" type="button" onClick={analyzeContribution} disabled={qualityLoading}>
              <FiBarChart2 />
              {qualityLoading ? 'Scoring...' : 'Score contribution'}
            </button>
            {qualityResult && (
              <span className="consensus-reward" title="Heuristic estimate only — submit in the Jev panel on the Portfolio tab to actually earn">
                <FiZap /> est. {qualityResult.clawdReward.toLocaleString()} CLAWD via Jev
              </span>
            )}
          </div>
          {qualityError && <div className="workbench-error">{qualityError}</div>}
          {qualityResult && (
            <div className="quality-result">
              <div className="quality-tier">
                <FiCheckCircle />
                <strong>{qualityResult.tier}</strong>
                <span>{qualityResult.tierLabel}</span>
              </div>
              {Object.entries(METRIC_LABELS).map(([key, label]) => (
                <MetricBar key={key} label={label} value={qualityResult.metrics[key]} />
              ))}
              <div className="consensus-recommendations">
                {qualityResult.recommendations.map((item) => <span key={item}>{item}</span>)}
              </div>
            </div>
          )}
        </div>

        <form className="consensus-panel" onSubmit={startRound}>
          <div className="consensus-panel-heading">
            <FiGitBranch />
            <div>
              <span className="eyebrow">Training round</span>
              <h3>Commit local models into a consensus cycle.</h3>
            </div>
          </div>
          <label>
            <span>Objective</span>
            <input value={roundForm.objective} onChange={(event) => setRoundForm({ ...roundForm, objective: event.target.value })} />
          </label>
          <div className="consensus-form-row">
            <label>
              <span>Model type</span>
              <select value={roundForm.modelType} onChange={(event) => setRoundForm({ ...roundForm, modelType: event.target.value })}>
                <option value="CONSENSUS_LEARNING">Consensus learning</option>
                <option value="FEDERATED_LLM">Federated LLM</option>
                <option value="QUALITY_ORACLE">Quality oracle</option>
                <option value="SOLANA_CLASSIFIER">Solana classifier</option>
              </select>
            </label>
            <label>
              <span>Nodes</span>
              <input type="number" min="3" max="12" value={roundForm.participantCount} onChange={(event) => setRoundForm({ ...roundForm, participantCount: event.target.value })} />
            </label>
          </div>
          <label>
            <span>Dataset summary</span>
            <textarea value={roundForm.datasetSummary} onChange={(event) => setRoundForm({ ...roundForm, datasetSummary: event.target.value })} rows={3} />
          </label>
          <label>
            <span>Privacy mode</span>
            <select value={roundForm.privacyMode} onChange={(event) => setRoundForm({ ...roundForm, privacyMode: event.target.value })}>
              <option value="local-only">Local-only data</option>
              <option value="prediction-gossip">Prediction gossip</option>
              <option value="zk-commitments">ZK commitments</option>
            </select>
          </label>
          {roundError && <div className="workbench-error">{roundError}</div>}
          <div className="consensus-actions">
            <button className="btn btn-primary" type="submit" disabled={roundLoading}>
              <FiCpu />
              {roundLoading ? 'Working...' : 'Start round'}
            </button>
            <button className="btn btn-secondary" type="button" onClick={aggregateRound} disabled={!roundResult || roundLoading}>
              <FiRefreshCw />
              Aggregate
            </button>
          </div>

          {roundResult && (
            <div className="round-output">
              <div className="round-status">
                <FiActivity />
                <div>
                  <span>Status</span>
                  <strong>{roundResult.status.replaceAll('-', ' ')}</strong>
                </div>
              </div>
              {roundResult.aggregate && (
                <div className="aggregate-grid">
                  <div><span>Prediction</span><strong>{roundResult.aggregate.consensusPrediction}</strong></div>
                  <div><span>Confidence</span><strong>{roundResult.aggregate.consensusConfidence}%</strong></div>
                  <div><span>Rewards</span><strong>{roundResult.aggregate.rewardPool} CLAWD</strong></div>
                </div>
              )}
              <div className="node-list">
                {roundResult.nodes.slice(0, 6).map((node) => (
                  <div key={node.id}>
                    <span>{node.label}</span>
                    <strong>{node.confidence}%</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>

      <div className="consensus-inference">
        <div>
          <span className="eyebrow">Consensus inference</span>
          <h3>Merge multiple model perspectives into one ledger-backed answer.</h3>
          <p>
            The backend simulates local model votes, confidence weighting, and a final
            commitment hash suitable for model-version or prediction receipts.
          </p>
        </div>
        <div className="consensus-inference-box">
          <textarea value={inferencePrompt} onChange={(event) => setInferencePrompt(event.target.value)} rows={4} />
          <button className="btn btn-primary" type="button" onClick={runInference} disabled={inferenceLoading}>
            <FiShield />
            {inferenceLoading ? 'Aggregating...' : 'Run consensus inference'}
          </button>
          {inferenceResult && (
            <div className="inference-result">
              {inferenceResult.error ? (
                <p className="text-error">{inferenceResult.error}</p>
              ) : (
                <>
                  <div className="quality-tier">
                    <FiLock />
                    <strong>{inferenceResult.confidence}% confidence</strong>
                    <span>{inferenceResult.participatingModels} model votes</span>
                  </div>
                  <p>{inferenceResult.finalAnswer}</p>
                  <code>{inferenceResult.ledgerCommitment}</code>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
