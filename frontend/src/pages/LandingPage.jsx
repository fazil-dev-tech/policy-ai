import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Shield, ChevronRight, Lock, Activity, Sparkles, ArrowUpRight,
    CheckCircle2, ChevronDown, Database, Cpu, ShieldCheck, FileCheck2
} from 'lucide-react';
import HeroVaultScene3D from '../components/shared/HeroVaultScene3D';
import ArchitectureOrbit3D from '../components/ArchitectureOrbit3D';
import { Reveal, SpotlightCard } from '../components/shared/MotionPrimitives';
import {
    SvgPolicyCisGraph,
    SvgPayoutWaterfall,
    SvgVehicleDamageBlueprint,
    SvgBrowserShieldRadar,
    SvgParinidhiAcoustic,
    SvgFamilyEmergencyCard,
} from '../components/LandingVectors';

const PREVIEW_SCENARIOS = [
    {
        id: 'health',
        label: 'Health Audit',
        badge: 'RULE-CHECKED',
        badgeTone: 'rose',
        scoreLabel: 'Policy Clarity Score',
        scoreSub: 'IRDAI 2024 Audit Rulebook',
        scoreValue: '94 / 100',
        scoreColor: '#34d399',
        scorePct: 94,
        barGradient: 'linear-gradient(90deg, #e11d48 0%, #fb7185 55%, #fda4af 100%)',
        rows: [
            ['Room-Rent Cap', 'Single AC Room', '0% Cut', 'ok'],
            ['Pre-Existing Wait', '60-Month Rule', 'Cleared', 'ok'],
            ['Cashless SLA', 'Discharge Window', '3h Ready', 'ok'],
        ],
        footer: '10 MB private vault · Page-cited answers · Instant appeal PDFs',
    },
    {
        id: 'motor',
        label: 'Motor Estimate',
        badge: 'PHOTO ESTIMATE',
        badgeTone: 'amber',
        scoreLabel: 'Bumper Damage Match',
        scoreSub: 'OEM Range & Depreciation Tier',
        scoreValue: '88% Fit',
        scoreColor: '#fbbf24',
        scorePct: 88,
        barGradient: 'linear-gradient(90deg, #d97706 0%, #fbbf24 100%)',
        rows: [
            ['Front Bumper', 'OEM Benchmark', '₹11k – ₹16k', 'warn'],
            ['Zero-Dep Waiver', 'Plastic Parts Tier', '50% Waived', 'ok'],
            ['Workshop Quote', 'Garage Overcharge', 'Flags >25%', 'info'],
        ],
        footer: 'Up to 6 accident photos · Standard vs Zero-Dep depreciation',
    },
    {
        id: 'shield',
        label: 'Scam Shield',
        badge: 'CHROME SHIELD',
        badgeTone: 'sky',
        scoreLabel: 'Phishing Risk Score',
        scoreSub: 'Web, WhatsApp Web & Gmail',
        scoreValue: '98 / 100',
        scoreColor: '#fb7185',
        scorePct: 98,
        barGradient: 'linear-gradient(90deg, #0284c7 0%, #fb7185 100%)',
        rows: [
            ['Suspicious File', 'KYC Installer Link', '.APK Blocked', 'risk'],
            ['Payment Trap', 'Reverse-UPI Collect', 'PIN Lure Alert', 'warn'],
            ['Domain Check', 'Insurer Registry', 'Lookalike Match', 'info'],
        ],
        footer: 'Protects Websites, WhatsApp Web & Gmail in real time',
    },
];

const CORE_CAPABILITIES = [
    {
        span: 'bento-span-7',
        delay: 40,
        kicker: 'POLICY VAULT',
        tag: 'PDF & E-Card',
        title: 'Plain-English Policy Decoder',
        desc: 'Upload policy PDFs or E-Cards up to 10 MB to extract room-rent sub-limits, waiting periods, and exclusions cleanly—with personal IDs masked and every answer linked to its PDF page.',
        route: '/policies',
        cta: 'Open Policy Vault',
        dark: false,
        Vector: SvgPolicyCisGraph,
    },
    {
        span: 'bento-span-5',
        delay: 90,
        kicker: 'CLAIMS SIMULATOR',
        tag: '7 Scenarios',
        title: 'Payout Waterfall & Cashless Timer',
        desc: 'Test how room selection, consumables, deductibles, and co-pays change your final payout before hospitalization, track the 3-hour cashless discharge rule, and download appeal PDFs.',
        route: '/claims',
        cta: 'Open Claims Studio',
        dark: false,
        Vector: SvgPayoutWaterfall,
    },
    {
        span: 'bento-span-5',
        delay: 130,
        kicker: 'MOTOR ACCIDENT AI',
        tag: 'Photo + Quote',
        title: 'Vehicle Damage & Garage Audit',
        desc: 'Upload up to 6 accident photos and an optional repair bill. Estimates part repair ranges using statutory or Zero-Dep rules and flags garage quotes 25% above OEM benchmarks.',
        route: '/claims',
        cta: 'Estimate Car Damage',
        dark: true,
        Vector: SvgVehicleDamageBlueprint,
    },
    {
        span: 'bento-span-7',
        delay: 170,
        kicker: 'SCAM SHIELD',
        tag: 'Chrome Extension',
        title: 'Web, WhatsApp & Gmail Protection',
        desc: 'Detects malicious KYC .apk downloads, reverse-UPI refund lures, and lookalike insurer domains across normal web tabs, WhatsApp Web chats, and Gmail threads.',
        route: '/shield',
        cta: 'Check URL or Get Extension',
        dark: false,
        Vector: SvgBrowserShieldRadar,
    },
    {
        span: 'bento-span-6',
        delay: 200,
        kicker: 'AI & VOICE ADVISOR',
        tag: 'Multilingual',
        title: 'Parinidhi Voice & Live Policy Q&A',
        desc: 'Ask coverage questions by voice or text in English, Hindi, and regional languages—backed by cited pages from your uploaded policy and verified insurer sources.',
        route: '/terminal',
        cta: 'Ask Parinidhi',
        dark: false,
        Vector: SvgParinidhiAcoustic,
    },
    {
        span: 'bento-span-6',
        delay: 240,
        kicker: 'FAMILY & MIS-SELLING',
        tag: 'Emergency Ready',
        title: 'Family Vault, E-Cards & Free-Look Check',
        desc: 'Centralize family blood groups and linked policies for printable Emergency Cards, audit agent promises within the 30-day free-look window, and access 112, 108, 1930 & 155255.',
        route: '/family',
        cta: 'Open Family Vault',
        dark: false,
        Vector: SvgFamilyEmergencyCard,
    },
];

const SECURITY_PILLARS = [
    {
        icon: ShieldCheck,
        tone: 'emerald',
        title: 'Personal IDs Masked Before AI',
        desc: 'PAN numbers, Aadhaar IDs, and +91 mobile numbers are masked automatically before any AI model reads your policy text.',
        tag: 'PII Masking',
    },
    {
        icon: Database,
        tone: 'sky',
        title: 'Private Vault & Expiring Links',
        desc: 'Uploaded policy files and family emergency profiles stay isolated inside your account with per-user security rules and expiring file links.',
        tag: 'Private Vault',
    },
    {
        icon: Cpu,
        tone: 'rose',
        title: 'Rule-Checked Claim Math',
        desc: 'Room-rent ratios, deductibles, and car part depreciation run on explicit formulas—AI explains your clauses, it never invents payout rupees.',
        tag: 'Rule Engine',
    },
    {
        icon: FileCheck2,
        tone: 'amber',
        title: 'Verified Uploads & Auto Cleanup',
        desc: 'Every uploaded file up to 10 MB is checked by file type, and temporary accident photo packets are deleted right after your assessment.',
        tag: 'Safe Uploads',
    },
];

const FORMULA_STEPS = [
    { op: '', label: 'Hospital Bill', tone: 'neutral' },
    { op: '−', label: 'Non-Payables', tone: 'warn' },
    { op: '×', label: 'Room Cap Ratio', tone: 'rose' },
    { op: '−', label: 'Deductible & Co-Pay', tone: 'blue' },
    { op: '=', label: 'Est. Insurer Share', tone: 'ok' },
];

const ARCHITECTURE_FAQS = [
    {
        q: 'Does AI calculate my hospital claim or vehicle payout?',
        a: 'No. Every deduction—including proportionate room-rent cuts, deductibles, co-pays, and motor plastic or metal depreciation—runs on fixed IRDAI-aligned formulas. AI is only used to summarize plain-English clauses and inspect damage photos.',
    },
    {
        q: 'How are my PAN, Aadhaar, and policy PDFs kept private?',
        a: 'Sensitive personal IDs and phone numbers are masked automatically before any text reaches an AI model. Your uploaded policies live in user-isolated cloud storage protected by Row-Level Security and signed expiring URLs.',
    },
    {
        q: 'How does the Chrome Scam Shield guard WhatsApp Web and Gmail?',
        a: 'Our Chrome extension evaluates suspicious domains, fake KYC .apk links, and reverse-UPI refund phrases directly inside your browser first—flagging threats on Websites, WhatsApp Web, and Gmail without uploading your private emails or chats.',
    },
    {
        q: 'What if I upload accident photos with poor lighting?',
        a: 'Up to 6 photos are inspected using multimodal vision with an automatic local Python fallback estimator. You can also select or adjust damaged panels manually and compare any workshop bill against OEM price benchmarks.',
    },
    {
        q: 'Is PolicyGuard AI completely free for policyholders?',
        a: 'Yes. Creating an account, decoding policies, running all 7 claim scenarios, checking suspicious links, managing Family Emergency Cards, and downloading Claim Prep & GRO appeal PDFs are 100% free.',
    },
];

export default function LandingPage() {
    const navigate = useNavigate();
    const [navScrolled, setNavScrolled] = useState(false);
    const [previewIdx, setPreviewIdx] = useState(0);
    const [openFaq, setOpenFaq] = useState(0);

    const reducedMotion = useMemo(
        () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,
        []
    );

    useEffect(() => {
        const onScroll = () => setNavScrolled((window.scrollY || 0) > 24);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const scrollTo = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    };

    const preview = PREVIEW_SCENARIOS[previewIdx];

    return (
        <div className="landing-root">
            {/* Crystal Floating Navigation Bar */}
            <header className={`landing-nav ${navScrolled ? 'scrolled' : ''}`}>
                <div
                    className="landing-nav-logo"
                    role="button"
                    tabIndex={0}
                    onClick={() => window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
                        }
                    }}
                >
                    <span className="brand-emblem-dark landing-nav-emblem">
                        <img src="/logo.png" alt="PolicyGuard AI" width={26} height={26} className="landing-nav-img" />
                    </span>
                    <span>PolicyGuard <span className="landing-logo-badge">AI</span></span>
                </div>
                <nav className="landing-nav-links" aria-label="Landing Navigation">
                    <button type="button" onClick={() => scrollTo('capabilities')}>Tools</button>
                    <button type="button" onClick={() => scrollTo('architecture')}>How It Works</button>
                    <button type="button" onClick={() => scrollTo('workflow')}>Payout Math</button>
                    <button type="button" onClick={() => scrollTo('security')}>Privacy</button>
                </nav>
                <div className="landing-nav-actions">
                    <button type="button" className="btn-nav-ghost" onClick={() => navigate('/login')}>Sign In</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/register')}>
                        Get Started <ChevronRight size={14} />
                    </button>
                </div>
            </header>

            <main>
            {/* HERO STAGE: Obsidian Vault 3D + Interactive Sample Console */}
            <section className="landing-hero-stage">
                <div className="landing-hero-canvas" aria-hidden="true">
                    <HeroVaultScene3D mode={preview.id} reducedMotion={reducedMotion} />
                </div>

                <div className="landing-hero-inner">
                    <div className="hero-split-grid">
                        <div className="hero-copy-col">
                            <div className="hero-badge-obsidian">
                                <span className="hero-live-dot" aria-hidden="true" />
                                <Sparkles size={13} /> IRDAI-Aligned Policy &amp; Claim Clarity
                            </div>
                            <h1 className="hero-title-obsidian">
                                Decode Every Clause.
                                <span className="hero-title-accent">Win Every Fair Claim.</span>
                            </h1>
                            <p className="hero-subtitle-obsidian">
                                Decode confusing policy PDFs into plain language, estimate real hospital or car payouts before billing surprises hit, and block WhatsApp &amp; Gmail insurance scams automatically.
                            </p>
                            <div className="hero-cta">
                                <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/register')}>
                                    Start Free Analysis <ChevronRight size={18} />
                                </button>
                                <button type="button" className="btn-hero-outline" onClick={() => scrollTo('capabilities')}>
                                    Explore 6 Core Tools <ArrowUpRight size={16} />
                                </button>
                            </div>
                            <div className="hero-guarantees-inline">
                                <span><Lock size={13} /> PAN &amp; Aadhaar Masked</span>
                                <span><Shield size={13} /> Rule-Checked Payouts</span>
                                <span><CheckCircle2 size={13} /> Free Personal Vault</span>
                            </div>
                        </div>

                        <div className="hero-center-spacer" aria-hidden="true" />

                        {/* Structured Frosted Specimen Console */}
                        <SpotlightCard className="hero-diagnostic-card" hoverLift={false}>
                            <div className="hero-diag-header">
                                <span className="hero-diag-title">
                                    <Activity size={14} style={{ color: '#fb7185' }} />
                                    <span>Sample Workspace Audit</span>
                                </span>
                                <span className={`hero-diag-pill tone-${preview.badgeTone}`}>{preview.badge}</span>
                            </div>

                            <div className="hero-diag-tabs" role="tablist" aria-label="Sample preview modes">
                                {PREVIEW_SCENARIOS.map((item, idx) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={previewIdx === idx}
                                        className={`hero-diag-tab ${previewIdx === idx ? 'active' : ''}`}
                                        onClick={() => setPreviewIdx(idx)}
                                    >
                                        {previewIdx === idx && (
                                            <motion.span
                                                layoutId="heroPreviewTabPill"
                                                className="hero-diag-tab-pill"
                                                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                                            />
                                        )}
                                        <span style={{ position: 'relative', zIndex: 1 }}>{item.label}</span>
                                    </button>
                                ))}
                            </div>

                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={preview.id}
                                    className="hero-diag-metrics"
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    transition={{ duration: 0.18 }}
                                >
                                    <div className="hero-diag-kpi">
                                        <div className="hero-diag-kpi-top">
                                            <div>
                                                <div className="hero-diag-kpi-label">{preview.scoreLabel}</div>
                                                <div className="hero-diag-kpi-sub">{preview.scoreSub}</div>
                                            </div>
                                            <strong className="hero-diag-kpi-val" style={{ color: preview.scoreColor }}>
                                                {preview.scoreValue}
                                            </strong>
                                        </div>
                                        <div className="hero-diag-bar">
                                            <motion.span
                                                initial={{ width: 0 }}
                                                animate={{ width: `${preview.scorePct}%` }}
                                                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                                                style={{ background: preview.barGradient }}
                                            />
                                        </div>
                                    </div>

                                    <div className="hero-diag-list">
                                        {preview.rows.map(([title, sub, status, tone]) => (
                                            <div key={title} className="hero-diag-item">
                                                <div className="hero-diag-item-left">
                                                    <span className="hero-diag-item-title">{title}</span>
                                                    <span className="hero-diag-item-sub">{sub}</span>
                                                </div>
                                                <span className={`hero-diag-badge tone-${tone}`}>{status}</span>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            </AnimatePresence>

                            <div className="hero-diag-footer">
                                <CheckCircle2 size={13} style={{ color: '#fb7185', flexShrink: 0 }} />
                                <span>{preview.footer}</span>
                            </div>
                        </SpotlightCard>
                    </div>

                    <div className="hero-telemetry-grid">
                        <SpotlightCard className="hero-telemetry-cell">
                            <div className="hero-telemetry-top">
                                <span className="hero-telemetry-icon"><ShieldCheck size={15} /></span>
                                <span className="hero-telemetry-val">IRDAI 2024 Protection</span>
                            </div>
                            <span className="hero-telemetry-lbl">Checks 60-month pre-existing moratorium, 3-hour cashless discharge SLA &amp; room-rent caps</span>
                        </SpotlightCard>
                        <SpotlightCard className="hero-telemetry-cell">
                            <div className="hero-telemetry-top">
                                <span className="hero-telemetry-icon"><FileCheck2 size={15} /></span>
                                <span className="hero-telemetry-val">Policy + Vehicle Photo AI</span>
                            </div>
                            <span className="hero-telemetry-lbl">Turns multi-column PDFs into page-cited cards and audits up to 6 accident photos cleanly</span>
                        </SpotlightCard>
                        <SpotlightCard className="hero-telemetry-cell">
                            <div className="hero-telemetry-top">
                                <span className="hero-telemetry-icon"><Shield size={15} /></span>
                                <span className="hero-telemetry-val">3-Surface Scam Shield</span>
                            </div>
                            <span className="hero-telemetry-lbl">Blocks fake KYC .apk apps, UPI refund lures &amp; lookalike links on Web, WhatsApp &amp; Gmail</span>
                        </SpotlightCard>
                    </div>
                </div>
            </section>

            {/* BENTO SHOWCASE: Six Clear Policyholder Tools */}
            <section id="capabilities" className="landing-features">
                <div className="landing-section-shell">
                    <Reveal className="capabilities-header-row">
                        <div>
                            <span className="section-kicker">Core Product Suite</span>
                            <h2 className="section-title-clean">Six clear tools for every stage of your policy</h2>
                            <p className="section-subtitle-clean">
                                Every calculation follows transparent insurance rules and links directly back to your uploaded policy pages—never vague guesswork.
                            </p>
                        </div>
                        <div className="capabilities-trust-glass">
                            <div className="trust-stat-item">
                                <strong>100%</strong>
                                <span>Rule-Checked Math</span>
                            </div>
                            <span className="trust-divider" aria-hidden="true" />
                            <div className="trust-stat-item">
                                <strong>7</strong>
                                <span>Claim Scenarios</span>
                            </div>
                            <span className="trust-divider" aria-hidden="true" />
                            <div className="trust-stat-item">
                                <strong>10 MB</strong>
                                <span>Private Vault Upload</span>
                            </div>
                        </div>
                    </Reveal>

                    <div className="bento-grid-12">
                        {CORE_CAPABILITIES.map(({ span, delay, kicker, tag, title, desc, route, cta, dark, Vector }, idx) => (
                            <Reveal key={title} delay={delay} className={span}>
                                <SpotlightCard as="article" className="bento-card">
                                    <div className="bento-card-head">
                                        <span className="bento-kicker">
                                            <span className="bento-index">0{idx + 1}</span>
                                            {kicker}
                                        </span>
                                        <span className="feature-tag">{tag}</span>
                                    </div>
                                    <h3>{title}</h3>
                                    <p>{desc}</p>
                                    <div className={`bento-schematic-wrap ${dark ? 'dark-blueprint' : ''}`}>
                                        <Vector />
                                    </div>
                                    <div className="bento-card-foot">
                                        <button
                                            type="button"
                                            className="bento-action-link"
                                            onClick={() => navigate(route)}
                                        >
                                            <span>{cta}</span>
                                            <ArrowUpRight size={15} />
                                        </button>
                                    </div>
                                </SpotlightCard>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* INTERACTIVE 3D SYSTEM PIPELINE */}
            <section id="architecture" className="landing-arch-section">
                <div className="landing-section-shell">
                    <Reveal className="arch-section-header">
                        <span className="arch-eyebrow">CONNECTED DATA FLOW</span>
                        <h2>See how your policy moves safely from upload to payout clarity</h2>
                        <p>
                            Inspect the six connected layers linking your browser shield, API security gate, free AI router, encrypted user vault, payout &amp; vehicle engine, and downloadable PDFs.
                        </p>
                    </Reveal>
                    <Reveal delay={100}>
                        <ArchitectureOrbit3D />
                    </Reveal>
                </div>
            </section>

            {/* TRANSPARENT PAYOUT MATH & 3-STEP WORKFLOW */}
            <section id="workflow" className="landing-workflow">
                <div className="landing-section-shell">
                    <div className="workflow-grid">
                        <Reveal>
                            <span className="section-kicker">Transparent Claim Math</span>
                            <h2 className="section-title-clean">From buried PDF tables to clear claim outcomes</h2>
                            <p className="section-subtitle-clean">
                                PolicyGuard AI converts complex insurance rules into transparent math backed by page numbers, countdown timers, and ready-to-send appeal letters.
                            </p>

                            <SpotlightCard className="formula-proof-card">
                                <span className="formula-proof-label">HOW YOUR INSURER CALCULATES PAYOUT</span>
                                <div className="formula-steps-row" aria-label="Hospital claim payout breakdown formula">
                                    {FORMULA_STEPS.map((step) => (
                                        <span key={step.label} className="formula-token-group">
                                            {step.op && <span className="formula-op" aria-hidden="true">{step.op}</span>}
                                            <span className={`formula-chip tone-${step.tone}`}>
                                                {step.label}
                                            </span>
                                        </span>
                                    ))}
                                </div>
                                <div className="workflow-trust-pills" style={{ marginTop: 14, marginBottom: 0 }}>
                                    <span>Capped at Sum Insured</span>
                                    <span>3h Cashless Timer</span>
                                    <span>Ready Appeal PDFs</span>
                                </div>
                            </SpotlightCard>

                            <button type="button" className="btn btn-primary" style={{ marginTop: 22 }} onClick={() => navigate('/register')}>
                                Launch Free Workspace <ChevronRight size={16} />
                            </button>
                        </Reveal>

                        <div className="workflow-steps">
                            {[
                                ['01', 'rose', 'Upload Policy PDF or E-Card (Up to 10 MB)', 'Personal IDs are masked automatically while tables extract room-rent caps, waiting periods, and clickable page citations.'],
                                ['02', 'sky', 'Simulate Claim Payouts, Damage & Scam Links', 'Test hospital bill scenarios with the room-rent slider, analyze up to 6 accident photos, or check suspicious WhatsApp & Gmail URLs.'],
                                ['03', 'emerald', 'Download Checklists, E-Cards & GRO Appeals', 'Export Claim Prep Guides, printable Family Emergency Wallet E-Cards, and formal IRDAI settlement appeal letters anytime.'],
                            ].map(([num, tone, title, desc], idx) => (
                                <Reveal key={num} delay={idx * 90}>
                                    <SpotlightCard className={`workflow-step-card tone-${tone}`}>
                                        <span className={`workflow-step-num tone-${tone}`}>{num}</span>
                                        <div>
                                            <h3>{title}</h3>
                                            <p>{desc}</p>
                                        </div>
                                        <CheckCircle2 size={18} className="workflow-check" />
                                    </SpotlightCard>
                                </Reveal>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* PRIVACY, SECURITY & FAQ BAND */}
            <section id="security" className="landing-security-band">
                <div className="landing-section-shell">
                    <Reveal className="security-header-center">
                        <span className="section-kicker">Privacy &amp; Accuracy</span>
                        <h2 className="section-title-clean">Built to protect your identity, data &amp; claim rights</h2>
                    </Reveal>

                    <div className="security-pillars-grid">
                        {SECURITY_PILLARS.map(({ icon: Icon, tone, title, desc, tag }, idx) => (
                            <Reveal key={title} delay={idx * 70}>
                                <SpotlightCard className="security-pillar-card">
                                    <div className="security-pillar-top">
                                        <span className={`security-pillar-icon tone-${tone}`}><Icon size={18} /></span>
                                        <span className={`security-pillar-tag tone-${tone}`}>{tag}</span>
                                    </div>
                                    <h3>{title}</h3>
                                    <p>{desc}</p>
                                </SpotlightCard>
                            </Reveal>
                        ))}
                    </div>

                    <Reveal delay={120} className="landing-faq-box">
                        <h3 className="landing-faq-heading">Common Questions</h3>
                        <div className="landing-faq-list">
                            {ARCHITECTURE_FAQS.map((item, idx) => {
                                const isOpen = openFaq === idx;
                                return (
                                    <div key={item.q} className={`landing-faq-item ${isOpen ? 'open' : ''}`}>
                                        <button
                                            type="button"
                                            className="landing-faq-q"
                                            aria-expanded={isOpen}
                                            onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                                        >
                                            <span>{item.q}</span>
                                            <ChevronDown size={16} className="landing-faq-chevron" />
                                        </button>
                                        <AnimatePresence initial={false}>
                                            {isOpen && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.22 }}
                                                    style={{ overflow: 'hidden' }}
                                                >
                                                    <p className="landing-faq-a">{item.a}</p>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* DARK OBSIDIAN FINAL CTA */}
            <section className="landing-cta-dark">
                <Reveal className="landing-section-shell">
                    <SpotlightCard className="landing-cta-card-dark">
                        <div className="cta-shield-medallion" aria-hidden="true">
                            <Shield size={28} style={{ color: '#fb7185' }} />
                        </div>
                        <h2>Take Control of Your Coverage Today</h2>
                        <p>Decode hidden limits, simulate fair payouts, and guard your family before an emergency strikes.</p>
                        <div className="hero-cta" style={{ justifyContent: 'center', marginTop: 24 }}>
                            <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/register')}>
                                Create Free Account <ChevronRight size={18} />
                            </button>
                            <button type="button" className="btn-hero-outline" onClick={() => navigate('/login')}>
                                Sign In
                            </button>
                        </div>
                    </SpotlightCard>
                </Reveal>
            </section>
            </main>

            <footer className="landing-footer-dark">
                <div className="landing-footer-inner">
                    <div className="landing-footer-brand-col">
                        <div className="landing-footer-brand">
                            <span className="brand-emblem-dark landing-footer-emblem">
                                <img src="/logo.png" alt="PolicyGuard AI" width={28} height={28} className="landing-footer-logo" />
                            </span>
                            <div>
                                <span className="landing-footer-title">PolicyGuard <span className="landing-logo-badge">AI</span></span>
                                <span className="landing-footer-sub">IRDAI-Aligned Policy &amp; Claim Intelligence</span>
                            </div>
                        </div>
                        <p className="landing-footer-note">
                            Clear policy decoding, rule-checked hospital &amp; motor payout math, family emergency cards, and real-time scam defense across Web, WhatsApp &amp; Gmail.
                        </p>
                        <div className="landing-footer-badges">
                            <span><Lock size={11} /> PAN &amp; Aadhaar Masked</span>
                            <span><ShieldCheck size={11} /> Rule-Checked Payouts</span>
                        </div>
                    </div>

                    <div className="landing-footer-cols">
                        <div className="landing-footer-col">
                            <h3>Platform</h3>
                            <button type="button" onClick={() => scrollTo('capabilities')}>Six Core Tools</button>
                            <button type="button" onClick={() => scrollTo('architecture')}>3D Architecture</button>
                            <button type="button" onClick={() => scrollTo('workflow')}>Transparent Claim Math</button>
                            <button type="button" onClick={() => scrollTo('security')}>Privacy &amp; FAQ</button>
                        </div>
                        <div className="landing-footer-col">
                            <h3>Modules</h3>
                            <button type="button" onClick={() => navigate('/policies')}>Policy Vault <ArrowUpRight size={12} /></button>
                            <button type="button" onClick={() => navigate('/claims')}>Claims &amp; Motor AI <ArrowUpRight size={12} /></button>
                            <button type="button" onClick={() => navigate('/shield')}>Browser Scam Shield <ArrowUpRight size={12} /></button>
                            <button type="button" onClick={() => navigate('/terminal')}>Parinidhi Voice AI <ArrowUpRight size={12} /></button>
                            <button type="button" onClick={() => navigate('/family')}>Family &amp; SOS Cards <ArrowUpRight size={12} /></button>
                        </div>
                        <div className="landing-footer-col">
                            <h3>Account &amp; SOS</h3>
                            <button type="button" onClick={() => navigate('/login')}>Workspace Sign In</button>
                            <button type="button" onClick={() => navigate('/register')}>Create Free Account</button>
                            <div className="landing-footer-sos">
                                <span className="landing-footer-sos-label">India Helplines</span>
                                <div className="landing-footer-sos-pills">
                                    <span>112 SOS</span>
                                    <span>1930 Cyber</span>
                                    <span>155255 IRDAI</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="landing-footer-bottom">
                    <span>© {new Date().getFullYear()} PolicyGuard AI · Clear Policy &amp; Claim Intelligence</span>
                    <span className="landing-footer-credit">Built by Mohamed Fazil Pasha</span>
                </div>
            </footer>
        </div>
    );
}
