import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
    FileText, Shield, TrendingUp, Upload, ArrowRight, ShieldAlert,
    Users, Sparkles, Car, HeartPulse, FileSearch, MessageSquare,
    RefreshCw, AlertTriangle, CheckCircle2, Clock, Settings
} from 'lucide-react';
import { AnimatedCounter, Reveal, SpotlightCard } from '../components/shared/MotionPrimitives';

const getPolicyExpiryMeta = (policy) => {
    if (policy?.status === 'expired') {
        return { isExpired: true, isExpiringSoon: false, daysLeft: -1, label: 'Expired', tone: 'danger' };
    }
    if (!policy?.endDate) {
        return { isExpired: false, isExpiringSoon: false, daysLeft: null, label: 'Active', tone: 'success' };
    }
    const endMs = new Date(policy.endDate).getTime();
    if (Number.isNaN(endMs)) {
        return { isExpired: false, isExpiringSoon: false, daysLeft: null, label: 'Active', tone: 'success' };
    }
    const daysLeft = Math.ceil((endMs - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) {
        return { isExpired: true, isExpiringSoon: false, daysLeft, label: `Expired ${Math.abs(daysLeft)}d ago`, tone: 'danger' };
    }
    if (daysLeft <= 45) {
        return {
            isExpired: false,
            isExpiringSoon: true,
            daysLeft,
            label: daysLeft === 0 ? 'Renews today' : `${daysLeft}d left`,
            tone: 'warning',
        };
    }
    return { isExpired: false, isExpiringSoon: false, daysLeft, label: 'Active', tone: 'success' };
};

export default function DashboardPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        policies: 0,
        claimsTotal: 0,
        incidents: 0,
        damageReports: 0,
        settlements: 0,
        filedClaims: 0,
        documents: 0,
        familyMembers: 0,
        threatCount: 0,
        scansTotal: 0,
    });
    const [policies, setPolicies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [partialWarning, setPartialWarning] = useState('');

    const loadDashboard = useCallback(async ({ silent = false } = {}) => {
        if (silent) setRefreshing(true);
        else setLoading(true);
        setLoadError('');
        setPartialWarning('');

        try {
            const results = await Promise.allSettled([
                api.get('/policy?limit=50'),
                api.get('/incidents'),
                api.get('/damage'),
                api.get('/settlements'),
                api.get('/claims?limit=50'),
                api.get('/family'),
                api.get('/security/scans'),
                api.get('/documents?limit=50'),
            ]);

            const [policyR, incR, dmgR, setlR, claimR, famR, scanR, docR] = results;

            if (policyR.status === 'rejected') {
                throw policyR.reason;
            }

            const failedSecondary = results.slice(1).filter((r) => r.status === 'rejected').length;
            if (failedSecondary > 0) {
                setPartialWarning('Some live module counters could not refresh cleanly. Click Retry to sync again.');
            }

            const policyList = policyR.value?.data?.policies || [];
            const incidentsCount = incR.status === 'fulfilled' ? (incR.value?.data?.incidents || []).length : 0;
            const damageCount = dmgR.status === 'fulfilled' ? (dmgR.value?.data?.reports || []).length : 0;
            const settlementsCount = setlR.status === 'fulfilled' ? (setlR.value?.data?.settlements || []).length : 0;
            const filedClaimsCount = claimR.status === 'fulfilled'
                ? (claimR.value?.data?.total ?? (claimR.value?.data?.claims || []).length)
                : 0;
            const familyCount = famR.status === 'fulfilled' ? (famR.value?.data?.members || []).length : 0;
            const scans = scanR.status === 'fulfilled' ? (scanR.value?.data?.scans || []) : [];
            const docsCount = docR.status === 'fulfilled'
                ? (docR.value?.data?.total ?? (docR.value?.data?.documents || []).length)
                : 0;

            setPolicies(policyList);
            setStats({
                policies: policyR.value?.data?.total ?? policyList.length,
                claimsTotal: incidentsCount + damageCount + settlementsCount + filedClaimsCount,
                incidents: incidentsCount,
                damageReports: damageCount,
                settlements: settlementsCount,
                filedClaims: filedClaimsCount,
                documents: docsCount,
                familyMembers: familyCount,
                threatCount: scans.filter((s) => s.status !== 'safe').length,
                scansTotal: scans.length,
            });
        } catch (err) {
            console.error('Dashboard load error:', err);
            setLoadError(err.response?.data?.error || 'Could not load dashboard metrics.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    if (loading) {
        return <div className="loading-spinner"><div className="spinner" /></div>;
    }

    const enrichedPolicies = policies.map((p) => {
        const expiry = getPolicyExpiryMeta(p);
        const displayScore = Number(p.healthScore || p.verificationScore || 0);
        return { ...p, expiry, displayScore };
    });

    const expiringSoon = enrichedPolicies.filter((p) => p.expiry.isExpiringSoon);
    const expiredPolicies = enrichedPolicies.filter((p) => p.expiry.isExpired);
    const activePoliciesCount = Math.max(0, enrichedPolicies.length - expiredPolicies.length);

    const totalSumInsured = enrichedPolicies.reduce((sum, p) => sum + Number(p.coverageAmount || 0), 0);
    const avgHealthScore = enrichedPolicies.length > 0
        ? Math.round(enrichedPolicies.reduce((sum, p) => sum + p.displayScore, 0) / enrichedPolicies.length)
        : 0;

    const firstName = user?.name?.trim()?.split(/\s+/)?.[0] || 'User';

    const quickModules = [
        { icon: Upload, label: 'Policies & CIS', desc: 'Score PDFs & clause search', path: '/policies', color: 'purple', chip: stats.policies > 0 ? `${stats.policies} saved` : 'Upload' },
        { icon: FileSearch, label: 'Document AI', desc: 'Summarize any insurance PDF', path: '/analyzer', color: 'blue', chip: stats.documents > 0 ? `${stats.documents} docs` : 'PDF Q&A' },
        { icon: MessageSquare, label: 'Policy Chat', desc: 'Clause-cited NVIDIA NIM QA', path: '/chat', color: 'purple', chip: 'AI Chat' },
        { icon: Sparkles, label: 'Parinidhi AI', desc: '3D voice & IRDAI research', path: '/terminal', color: 'blue', chip: '3D Voice' },
        { icon: Shield, label: 'Claims & Motor AI', desc: 'Estimator, bike/car & GRO', path: '/claims', color: 'green', chip: stats.claimsTotal > 0 ? `${stats.claimsTotal} saved` : 'Simulate' },
        { icon: ShieldAlert, label: 'Browser Shield', desc: 'WhatsApp/Gmail scam blocker', path: '/shield', color: 'amber', chip: stats.threatCount > 0 ? `${stats.threatCount} alerts` : 'MV3 Ext' },
        { icon: Users, label: 'Family & SOS', desc: 'Offline emergency cards', path: '/family', color: 'blue', chip: stats.familyMembers > 0 ? `${stats.familyMembers} members` : 'Setup' },
        { icon: TrendingUp, label: 'Market & IRDAI', desc: 'Verified insurer benchmarks', path: '/market', color: 'purple', chip: 'Live' },
        ...(user?.role === 'admin'
            ? [{ icon: Settings, label: 'Admin Telemetry', desc: 'Users, domains & moderation', path: '/admin', color: 'red', chip: 'Admin' }]
            : []),
    ];

    const claimsSubtitle = stats.claimsTotal > 0
        ? [
            stats.incidents > 0 ? `${stats.incidents} est` : null,
            stats.damageReports > 0 ? `${stats.damageReports} motor` : null,
            stats.settlements > 0 ? `${stats.settlements} audit` : null,
            stats.filedClaims > 0 ? `${stats.filedClaims} filed` : null,
        ].filter(Boolean).join(' · ')
        : 'Claims & Motor Analyses';

    return (
        <div>
            <Reveal className="page-header dashboard-hero-row">
                <div>
                    <span className="workspace-eyebrow">
                        <span className="dot active-dot" aria-hidden="true" />
                        POLICYGUARD WORKSPACE · PROTECTED
                    </span>
                    <h1>Welcome back, {firstName}</h1>
                    <p>Live insurance portfolio, deterministic claims readiness, Parinidhi AI, and threat defense</p>
                </div>
                <div className="dashboard-hero-actions">
                    {policies.length > 0 ? (
                        <SpotlightCard className="portfolio-glass-strip">
                            <div>
                                <span className="meta-label">Total Sum Insured</span>
                                <strong>₹<AnimatedCounter value={totalSumInsured} locale /></strong>
                            </div>
                            <div className="portfolio-divider" aria-hidden="true" />
                            <div>
                                <span className="meta-label">Avg Health Score</span>
                                <strong style={{ color: avgHealthScore >= 70 ? 'var(--success)' : avgHealthScore >= 45 ? '#d97706' : 'var(--accent-primary)' }}>
                                    <AnimatedCounter value={avgHealthScore} suffix="/100" />
                                </strong>
                            </div>
                            <div className="portfolio-divider" aria-hidden="true" />
                            <div className="portfolio-strip-btns">
                                <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/policies')}>
                                    <Upload size={14} /> Upload
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => loadDashboard({ silent: true })}
                                    disabled={refreshing}
                                    title="Refresh dashboard metrics"
                                    aria-label="Refresh dashboard metrics"
                                >
                                    <RefreshCw size={14} className={refreshing ? 'spin-icon' : ''} />
                                </button>
                            </div>
                        </SpotlightCard>
                    ) : (
                        <SpotlightCard className="portfolio-glass-strip">
                            <div>
                                <span className="meta-label">Vault Status</span>
                                <strong style={{ color: 'var(--success)' }}>Ready · Encrypted</strong>
                            </div>
                            <div className="portfolio-divider" aria-hidden="true" />
                            <div className="portfolio-strip-btns">
                                <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/policies')}>
                                    <Upload size={14} /> Upload Policy
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => loadDashboard({ silent: true })}
                                    disabled={refreshing}
                                    title="Refresh dashboard metrics"
                                    aria-label="Refresh dashboard metrics"
                                >
                                    <RefreshCw size={14} className={refreshing ? 'spin-icon' : ''} />
                                </button>
                            </div>
                        </SpotlightCard>
                    )}
                </div>
            </Reveal>

            {loadError && (
                <div className="dashboard-alert-banner danger" role="alert">
                    <div className="dashboard-alert-content">
                        <AlertTriangle size={16} />
                        <span>{loadError}</span>
                    </div>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => loadDashboard()}>Retry</button>
                </div>
            )}

            {!loadError && partialWarning && (
                <div className="dashboard-alert-banner warning" role="status">
                    <div className="dashboard-alert-content">
                        <AlertTriangle size={16} />
                        <span>{partialWarning}</span>
                    </div>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => loadDashboard({ silent: true })}>Retry</button>
                </div>
            )}

            {expiredPolicies.length > 0 && (
                <div className="dashboard-alert-banner danger" role="region" aria-label="Expired Policies Alert">
                    <div className="dashboard-alert-content">
                        <AlertTriangle size={16} />
                        <span>
                            <strong>Expired Policies ({expiredPolicies.length}):</strong> Review renewal status to avoid waiting-period loss:
                        </span>
                        <div className="dashboard-alert-pills">
                            {expiredPolicies.map((p) => (
                                <button
                                    key={p._id}
                                    type="button"
                                    className="dashboard-alert-pill danger"
                                    onClick={() => navigate(`/policies?policyId=${p._id}`)}
                                >
                                    {p.providerName} (#{p.policyNumber}) · {p.expiry.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {expiringSoon.length > 0 && (
                <div className="dashboard-alert-banner warning" role="region" aria-label="Upcoming Policy Renewals">
                    <div className="dashboard-alert-content">
                        <Clock size={16} />
                        <span>
                            <strong>Upcoming Renewals ({expiringSoon.length}):</strong>
                        </span>
                        <div className="dashboard-alert-pills">
                            {expiringSoon.map((p) => (
                                <button
                                    key={p._id}
                                    type="button"
                                    className="dashboard-alert-pill warning"
                                    onClick={() => navigate(`/policies?policyId=${p._id}`)}
                                >
                                    {p.providerName} (#{p.policyNumber}) · {p.expiry.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="stats-grid">
                <Reveal delay={0}>
                    <SpotlightCard
                        className="stat-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate('/policies')}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/policies'); } }}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="stat-card-top">
                            <div className="stat-icon purple"><FileText size={22} /></div>
                            <span className="stat-hint">
                                {expiredPolicies.length > 0
                                    ? `${activePoliciesCount} active · ${expiredPolicies.length} expired`
                                    : stats.policies > 0
                                      ? 'All Active'
                                      : 'Upload ->'}
                            </span>
                        </div>
                        <div className="stat-value"><AnimatedCounter value={stats.policies} /></div>
                        <div className="stat-label">{stats.policies > 0 ? 'Policies in Vault' : 'Active Policies'}</div>
                    </SpotlightCard>
                </Reveal>
                <Reveal delay={60}>
                    <SpotlightCard
                        className="stat-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate('/claims')}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/claims'); } }}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="stat-card-top">
                            <div className="stat-icon green"><Shield size={22} /></div>
                            <span className="stat-hint">{stats.claimsTotal > 0 ? 'Review' : 'Simulate ->'}</span>
                        </div>
                        <div className="stat-value"><AnimatedCounter value={stats.claimsTotal} /></div>
                        <div className="stat-label">{stats.claimsTotal > 0 ? `Claims & Motor (${claimsSubtitle})` : 'Claims & Motor Analyses'}</div>
                    </SpotlightCard>
                </Reveal>
                <Reveal delay={120}>
                    <SpotlightCard
                        className="stat-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate('/family')}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/family'); } }}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="stat-card-top">
                            <div className="stat-icon blue"><Users size={22} /></div>
                            <span className="stat-hint">{stats.familyMembers > 0 ? 'SOS Card' : 'Add Family ->'}</span>
                        </div>
                        <div className="stat-value"><AnimatedCounter value={stats.familyMembers} /></div>
                        <div className="stat-label">Family Vault Members</div>
                    </SpotlightCard>
                </Reveal>
                <Reveal delay={180}>
                    <SpotlightCard
                        className="stat-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate('/shield')}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/shield'); } }}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="stat-card-top">
                            <div className="stat-icon amber"><ShieldAlert size={22} /></div>
                            <span className="stat-hint">{stats.scansTotal > 0 ? `${stats.scansTotal} scanned` : 'Shield ->'}</span>
                        </div>
                        <div className="stat-value"><AnimatedCounter value={stats.threatCount} /></div>
                        <div className="stat-label">Shield Warnings Cached</div>
                    </SpotlightCard>
                </Reveal>
            </div>

            <div className="grid-2 dashboard-main-grid">
                <div className="card">
                    <div className="card-header">
                        <h2>Recent Policies</h2>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/policies')}>
                            {policies.length > 0 ? 'View All' : 'Go to Vault'} <ArrowRight size={14} />
                        </button>
                    </div>
                    {enrichedPolicies.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {enrichedPolicies.slice(0, 5).map((p) => {
                                const scoreTier = p.displayScore >= 70 ? 'high' : p.displayScore >= 45 ? 'medium' : 'low';
                                return (
                                    <article
                                        key={p._id}
                                        className="policy-card dashboard-policy-card"
                                        onClick={(e) => {
                                            if (!e.target.closest('button, a')) navigate(`/policies?policyId=${p._id}`);
                                        }}
                                    >
                                        <div className="dashboard-policy-top">
                                            <div className="dashboard-policy-badges">
                                                <span className="policy-type" style={{ marginBottom: 0 }}>{p.policyType}</span>
                                                <span className={`badge badge-${scoreTier === 'high' ? 'success' : scoreTier === 'medium' ? 'warning' : 'danger'}`}>
                                                    Score {p.displayScore}/100
                                                </span>
                                                <span className={`badge badge-${p.expiry.tone}`}>
                                                    {p.expiry.isExpired ? <AlertTriangle size={11} /> : p.expiry.isExpiringSoon ? <Clock size={11} /> : <CheckCircle2 size={11} />}
                                                    {p.expiry.label}
                                                </span>
                                            </div>
                                        </div>
                                        <h3>
                                            <button
                                                type="button"
                                                className="dashboard-policy-title-btn"
                                                onClick={() => navigate(`/policies?policyId=${p._id}`)}
                                            >
                                                {p.providerName}
                                            </button>
                                        </h3>
                                        <div className="policy-info">
                                            <div className="policy-info-row">
                                                <span className="label">Policy #</span>
                                                <span className="value">{p.policyNumber}</span>
                                            </div>
                                            <div className="policy-info-row">
                                                <span className="label">Coverage</span>
                                                <span className="value">₹{Number(p.coverageAmount || 0).toLocaleString('en-IN')}</span>
                                            </div>
                                            {p.endDate && (
                                                <div className="policy-info-row">
                                                    <span className="label">End Date</span>
                                                    <span className="value">{new Date(p.endDate).toLocaleDateString('en-IN')}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="score-bar">
                                            <div
                                                className={`score-bar-fill ${scoreTier}`}
                                                style={{ width: `${Math.min(100, Math.max(0, p.displayScore))}%` }}
                                            />
                                        </div>
                                        <div className="dashboard-policy-actions">
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => navigate(`/policies?policyId=${p._id}`)}
                                            >
                                                Inspect CIS <ArrowRight size={12} />
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => navigate(`/chat?policyId=${p._id}`)}
                                            >
                                                <MessageSquare size={12} /> Ask Policy Chat
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                            {enrichedPolicies.length <= 2 && (
                                <button
                                    type="button"
                                    className="dashboard-add-policy-strip"
                                    onClick={() => navigate('/policies')}
                                >
                                    <Upload size={15} />
                                    <span>Upload another Health, Motor, or Renewal PDF to compare CIS coverage</span>
                                    <ArrowRight size={14} />
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="vault-activation-stack">
                            <div className="vault-starter-hero">
                                <div className="stat-icon purple" style={{ margin: '0 auto 12px' }}>
                                    <Upload size={22} />
                                </div>
                                <h3>No Policies Uploaded Yet</h3>
                                <p>Drop your Health, Car, 2-Wheeler, or Term PDF to decode hidden room-rent caps, waiting periods &amp; exclusions.</p>
                                <div className="vault-starter-actions">
                                    <button type="button" className="btn btn-primary" onClick={() => navigate('/policies')}>
                                        <Upload size={15} /> Upload First Policy
                                    </button>
                                    <button type="button" className="btn btn-secondary" onClick={() => navigate('/claims')}>
                                        Try Claim Simulator
                                    </button>
                                </div>
                            </div>

                            <div className="starter-steps-list">
                                {[
                                    {
                                        icon: HeartPulse,
                                        color: 'purple',
                                        title: 'Health & Family Floater',
                                        desc: 'Instant CIS summary, room-rent cap math & 60-month moratorium check',
                                        path: '/policies',
                                    },
                                    {
                                        icon: Car,
                                        color: 'green',
                                        title: 'Car & 2-Wheeler Motor',
                                        desc: 'Photo damage estimator, OEM part depreciation & ₹100 / ₹1,000 excess check',
                                        path: '/claims',
                                    },
                                    {
                                        icon: Users,
                                        color: 'blue',
                                        title: 'Family Vault & Emergency SOS',
                                        desc: 'Share offline TPA helplines & cashless hospital checklist in one tap',
                                        path: '/family',
                                    },
                                ].map(({ icon: StepIcon, color, title, desc, path }) => (
                                    <div
                                        key={title}
                                        className="quick-action-tile"
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => navigate(path)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(path); } }}
                                    >
                                        <div className={`stat-icon ${color}`}>
                                            <StepIcon size={19} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <h3>{title}</h3>
                                            <p>{desc}</p>
                                        </div>
                                        <ArrowRight size={15} className="quick-action-arrow" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="card">
                    <div className="card-header">
                        <h2>Workspace Modules</h2>
                        <span className="quick-actions-chip">{quickModules.length} Tools</span>
                    </div>
                    <div className="dashboard-quick-grid">
                        {quickModules.map(({ icon: Icon, label, desc, path, color, chip }) => (
                            <div
                                key={path}
                                className="quick-action-tile compact"
                                role="button"
                                tabIndex={0}
                                onClick={() => navigate(path)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(path); } }}
                            >
                                <div className={`stat-icon ${color}`}>
                                    <Icon size={18} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="quick-tile-title-row">
                                        <h3>{label}</h3>
                                        {chip && <span className="quick-tile-mini-chip">{chip}</span>}
                                    </div>
                                    <p>{desc}</p>
                                </div>
                                <ArrowRight size={15} className="quick-action-arrow" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
