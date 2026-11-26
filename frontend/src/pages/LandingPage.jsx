import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import {
    Shield, ChevronRight, Zap, Lock, Globe, BarChart2,
    Cpu, FileText, Calculator, Car, ShieldAlert, ArrowUpRight, CheckCircle2
} from 'lucide-react';
import CanvasErrorBoundary from '../components/shared/CanvasErrorBoundary';
import CyberCore from '../components/shared/CyberCore';
import DataStreamField from '../components/shared/DataStreamField';
import CameraRig from '../components/shared/CameraRig';
import GridFloor from '../components/shared/GridFloor';
import ArchitectureOrbit3D from '../components/ArchitectureOrbit3D';

function FeatureCard({ icon: Icon, title, desc, tag, color }) {
    return (
        <article className="feature-card">
            <div className="feature-card-top">
                <div className="feature-icon" style={{ background: `${color}15`, color }}>
                    <Icon size={22} />
                </div>
                <span className="feature-tag">{tag}</span>
            </div>
            <h3>{title}</h3>
            <p>{desc}</p>
        </article>
    );
}

export default function LandingPage() {
    const navigate = useNavigate();
    const reducedMotion = useMemo(
        () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,
        []
    );

    const scrollTo = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    };

    return (
        <div className="landing-root">
            {/* Editorial Obsidian Nav */}
            <nav className="landing-nav">
                <div className="landing-nav-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                    <img src="/logo.png" alt="PolicyGuard AI" className="landing-nav-img" />
                    <span>PolicyGuard <span className="landing-logo-badge">AI</span></span>
                </div>

                <div className="landing-nav-links">
                    <button type="button" onClick={() => scrollTo('architecture')}>Architecture</button>
                    <button type="button" onClick={() => scrollTo('capabilities')}>Capabilities</button>
                    <button type="button" onClick={() => scrollTo('workflow')}>Workflow</button>
                </div>

                <div className="landing-nav-actions">
                    <button type="button" className="btn-nav-ghost" onClick={() => navigate('/login')}>Sign In</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/register')}>
                        Get Started <ChevronRight size={15} />
                    </button>
                </div>
            </nav>

            {/* Dark Atmospheric Hero Stage */}
            <section className="landing-hero-stage">
                <div className="landing-hero-canvas">
                    <CanvasErrorBoundary fallbackTitle="3D Core visualization ready when WebGL is enabled.">
                        <Canvas
                            dpr={[1, 1.5]}
                            camera={{ position: [0, 0, 12], fov: 56 }}
                            gl={{ alpha: true, antialias: true }}
                        >
                            <ambientLight intensity={1.1} />
                            <directionalLight position={[10, 10, 10]} intensity={1.8} color="#f43f5e" />
                            <pointLight position={[-10, -8, -8]} intensity={1.2} color="#22d3ee" />
                            <CameraRig />
                            <DataStreamField active={false} color="#f472b6" />
                            <CyberCore position={[4.1, -0.1, -2]} active={false} />
                            <GridFloor />
                            <fog attach="fog" args={['#050814', 10, 28]} />
                        </Canvas>
                    </CanvasErrorBoundary>
                </div>

                <div className="landing-hero-inner">
                    <div className="hero-badge-obsidian">
                        <Zap size={13} />
                        <span>IRDAI-Aligned Policy &amp; Claims Intelligence</span>
                    </div>

                    <h1 className="hero-title-obsidian">
                        Decode Every Clause.<br />
                        <span className="hero-title-accent">Win Every Fair Claim.</span>
                    </h1>

                    <p className="hero-subtitle-obsidian">
                        Stop signing blind PDF renewals. PolicyGuard AI extracts hidden room-rent traps, computes deterministic claim payouts, verifies vehicle damage, and blocks WhatsApp &amp; Gmail scams in real time.
                    </p>

                    <div className="hero-cta">
                        <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/register')}>
                            Start Free Analysis <ChevronRight size={18} />
                        </button>
                        <button type="button" className="btn-hero-outline" onClick={() => scrollTo('architecture')}>
                            Inspect 3D Architecture <ArrowUpRight size={16} />
                        </button>
                    </div>

                    <div className="hero-telemetry-grid">
                        <div className="hero-telemetry-cell">
                            <span className="hero-telemetry-val">IRDAI 2024</span>
                            <span className="hero-telemetry-lbl">60m Moratorium &amp; 3h SLA Rules</span>
                        </div>
                        <div className="hero-telemetry-cell">
                            <span className="hero-telemetry-val">Nemotron + Gemma 4</span>
                            <span className="hero-telemetry-lbl">$0 Free Multi-Model Failover</span>
                        </div>
                        <div className="hero-telemetry-cell">
                            <span className="hero-telemetry-val">3-Surface Shield</span>
                            <span className="hero-telemetry-lbl">Chrome Web · WhatsApp · Gmail</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Interactive 3D System Architecture Showcase */}
            <section id="architecture" className="landing-arch-section">
                <div className="landing-section-shell">
                    <div className="arch-section-header">
                        <span className="arch-eyebrow">LIVE TELEMETRY PIPELINE</span>
                        <h2>Deterministic + Multi-Model System Architecture</h2>
                        <p>
                            Inspect how encrypted PDFs, Chrome Shield signals, OpenRouter zero-cost models, Supabase RLS tables, and IRDAI actuarial math connect end-to-end. Click any orbital node below.
                        </p>
                    </div>

                    <ArchitectureOrbit3D />
                </div>
            </section>

            {/* Clean Editorial Light Band — Core Capabilities */}
            <section id="capabilities" className="landing-features">
                <div className="landing-section-shell">
                    <div className="section-heading-left">
                        <span className="section-kicker">Core Modules</span>
                        <h2 className="section-title-clean">Precision tools built for real policyholders</h2>
                        <p className="section-subtitle-clean">
                            Every button maps directly to deterministic rules, indexed PDF citations, and auditable outputs — never vague guesses.
                        </p>
                    </div>

                    <div className="features-grid">
                        <FeatureCard
                            icon={FileText}
                            tag="PDF + OCR"
                            color="#e11d48"
                            title="Table-Aware Policy CIS & Index"
                            desc="Parses multi-column policy tables cleanly into IRDAI CIS cards, room-rent sub-limits, waiting periods, and searchable page-cited clauses."
                        />
                        <FeatureCard
                            icon={Calculator}
                            tag="Deterministic"
                            color="#059669"
                            title="7-Scenario Payout Waterfall"
                            desc="Interactive What-If room rent sliders, co-pay & deductible calculators, 3-hour cashless SLA countdowns, and downloadable Claim Guide PDFs."
                        />
                        <FeatureCard
                            icon={Car}
                            tag="Vision + ML"
                            color="#d97706"
                            title="Vehicle Damage & Quote Audit"
                            desc="Multimodal vision with local FastAPI YOLOv8/sklearn fallback detects damaged parts, calculates IRDAI part depreciation, and flags garage overcharges."
                        />
                        <FeatureCard
                            icon={ShieldAlert}
                            tag="Chrome MV3"
                            color="#0284c7"
                            title="3-Surface Browser Scam Shield"
                            desc="Blocks malicious .apk installers, reverse-UPI refund lures, lookalike insurer domains, and phishing banners across Chrome, WhatsApp Web & Gmail."
                        />
                        <FeatureCard
                            icon={Cpu}
                            tag="3D Voice"
                            color="#7c3aed"
                            title="Parinidhi Voice & Live Research"
                            desc="Multilingual 3D voice advisor backed by indexed clause citations and live insurer portal & brochure verification."
                        />
                        <FeatureCard
                            icon={Lock}
                            tag="Zero-Leak"
                            color="#0f766e"
                            title="Family Vault & Emergency SOS"
                            desc="Centralize blood groups, PED history, linked policies, 1-tap SOS playbooks (112/108/1930/155255), and printable Emergency E-Cards."
                        />
                    </div>
                </div>
            </section>

            {/* Clean Workflow Band */}
            <section id="workflow" className="landing-workflow">
                <div className="landing-section-shell">
                    <div className="workflow-grid">
                        <div>
                            <span className="section-kicker">3-Step Execution</span>
                            <h2 className="section-title-clean">From confusing fine print to clear claim action in seconds</h2>
                            <p className="section-subtitle-clean">
                                Upload an insurer schedule, run live Claim &amp; Settlement decoders, and export formal GRO escalation PDFs when a TPA short-pays.
                            </p>
                            <button type="button" className="btn btn-primary" onClick={() => navigate('/register')}>
                                Launch Workspace <ChevronRight size={16} />
                            </button>
                        </div>

                        <div className="workflow-steps">
                            {[
                                ['01', 'Upload Policy PDF or E-Card Photo', 'Signed private storage with PII masking and multi-page clause indexing.'],
                                ['02', 'Audit Coverage Gaps & Run What-Ifs', 'Simulate room-rent proportionate deductions and 60-month PED moratorium rules before admission.'],
                                ['03', 'Export Claim Prep & GRO Appeal PDFs', 'Download structured checklists, Emergency Cards, and regulation-backed settlement dispute letters.'],
                            ].map(([num, heading, body]) => (
                                <div key={num} className="workflow-step-card">
                                    <span className="workflow-step-num">{num}</span>
                                    <div>
                                        <h3>{heading}</h3>
                                        <p>{body}</p>
                                    </div>
                                    <CheckCircle2 size={18} className="workflow-check" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Final CTA & Footer */}
            <section className="landing-cta-dark">
                <div className="landing-cta-card-dark">
                    <Shield size={28} style={{ color: '#fb7185', marginBottom: 12 }} />
                    <h2>Take Control of Your Coverage Today</h2>
                    <p>Open-source insurer intelligence powered by Supabase, IRDAI deterministic rules, and zero-cost open AI.</p>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/register')}>
                            Create Free Account <ChevronRight size={18} />
                        </button>
                        <button type="button" className="btn-hero-outline" onClick={() => navigate('/login')}>
                            Sign In
                        </button>
                    </div>
                </div>
            </section>

            <footer className="landing-footer-dark">
                <span>© 2026 PolicyGuard AI · IRDAI Policy &amp; Claims Intelligence</span>
                <span>Built by Mohamed Fazil Pasha</span>
            </footer>
        </div>
    );
}
