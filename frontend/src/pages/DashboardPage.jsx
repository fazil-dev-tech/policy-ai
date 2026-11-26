import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { FileText, Shield, TrendingUp, Upload, ArrowRight, ShieldAlert, Users, Sparkles } from 'lucide-react';
import { AnimatedCounter, Reveal, SpotlightCard } from '../components/shared/MotionPrimitives';

export default function DashboardPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({ policies: 0, incidents: 0, familyMembers: 0, threatCount: 0 });
    const [policies, setPolicies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        setLoading(true);
        setLoadError('');
        try {
            const [policyRes, incRes, famRes, scanRes] = await Promise.all([
                api.get('/policy?limit=50'),
                api.get('/incidents').catch(() => ({ data: { incidents: [] } })),
                api.get('/family').catch(() => ({ data: { members: [] } })),
                api.get('/security/scans').catch(() => ({ data: { scans: [] } })),
            ]);
            setPolicies(policyRes.data.policies || []);
            setStats({
                policies: policyRes.data.total ?? (policyRes.data.policies || []).length,
                incidents: (incRes.data?.incidents || []).length,
                familyMembers: (famRes.data?.members || []).length,
                threatCount: (scanRes.data?.scans || []).filter((s) => s.status !== 'safe').length,
            });
        } catch (err) {
            console.error('Dashboard load error:', err);
            setLoadError(err.response?.data?.error || 'Could not load dashboard metrics.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="loading-spinner"><div className="spinner" /></div>;
    }

    const expiringSoon = policies.filter((p) => {
        if (!p.endDate) return false;
        const d = Math.ceil((new Date(p.endDate) - new Date()) / (1000 * 60 * 60 * 24));
        return d >= 0 && d <= 45;
    });

    const totalSumInsured = policies.reduce((sum, p) => sum + Number(p.coverageAmount || 0), 0);
    const avgHealthScore = policies.length > 0
        ? Math.round(policies.reduce((sum, p) => sum + Number(p.verificationScore || 0), 0) / policies.length)
        : 0;

    return (
        <div>
            <Reveal className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <span className="workspace-eyebrow">
                        <span className="dot active-dot" aria-hidden="true" />
                        POLICYGUARD WORKSPACE · PROTECTED
                    </span>
                    <h1>Welcome back, {user?.name?.split(' ')[0] || 'User'}</h1>
                    <p>Live insurance portfolio, deterministic claims readiness, Parinidhi AI, and threat defense</p>
                </div>
                {policies.length > 0 && (
                    <SpotlightCard className="portfolio-glass-strip">
                        <div>
                            <span className="meta-label">Total Sum Insured</span>
                            <strong>₹<AnimatedCounter value={totalSumInsured} locale /></strong>
                        </div>
                        <div className="portfolio-divider" aria-hidden="true" />
                        <div>
                            <span className="meta-label">Avg Policy Score</span>
                            <strong style={{ color: avgHealthScore >= 75 ? 'var(--success)' : 'var(--accent-primary)' }}>
                                <AnimatedCounter value={avgHealthScore} suffix="/100" />
                            </strong>
                        </div>
                    </SpotlightCard>
                )}
            </Reveal>

            {loadError && (
                <div className="card" style={{ padding: 14, marginBottom: 20, border: '1px solid rgba(220,38,38,0.3)', background: 'rgba(254,242,242,0.75)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: 'var(--danger)', fontSize: 13 }}>{loadError}</span>
                    <button className="btn btn-secondary btn-sm" onClick={loadDashboard}>Retry</button>
                </div>
            )}

            {expiringSoon.length > 0 && (
                <div className="card" style={{ padding: 14, marginBottom: 20, border: '1px solid rgba(217,119,6,0.35)', background: 'rgba(254,243,199,0.68)' }}>
                    <strong>Upcoming Policy Renewals ({expiringSoon.length}):</strong>{' '}
                    {expiringSoon.map((p) => `${p.providerName} (#${p.policyNumber})`).join(' · ')}
                </div>
            )}

            <div className="stats-grid">
                <Reveal delay={0}>
                    <SpotlightCard className="stat-card" role="button" tabIndex={0} onClick={() => navigate('/policies')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/policies'); } }} style={{ cursor: 'pointer' }}>
                        <div className="stat-icon purple"><FileText size={24} /></div>
                        <div className="stat-value"><AnimatedCounter value={stats.policies} /></div>
                        <div className="stat-label">Active Policies</div>
                    </SpotlightCard>
                </Reveal>
                <Reveal delay={60}>
                    <SpotlightCard className="stat-card" role="button" tabIndex={0} onClick={() => navigate('/claims')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/claims'); } }} style={{ cursor: 'pointer' }}>
                        <div className="stat-icon green"><Shield size={24} /></div>
                        <div className="stat-value"><AnimatedCounter value={stats.incidents} /></div>
                        <div className="stat-label">Claim Analyses Saved</div>
                    </SpotlightCard>
                </Reveal>
                <Reveal delay={120}>
                    <SpotlightCard className="stat-card" role="button" tabIndex={0} onClick={() => navigate('/family')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/family'); } }} style={{ cursor: 'pointer' }}>
                        <div className="stat-icon blue"><Users size={24} /></div>
                        <div className="stat-value"><AnimatedCounter value={stats.familyMembers} /></div>
                        <div className="stat-label">Family Vault Members</div>
                    </SpotlightCard>
                </Reveal>
                <Reveal delay={180}>
                    <SpotlightCard className="stat-card" role="button" tabIndex={0} onClick={() => navigate('/shield')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/shield'); } }} style={{ cursor: 'pointer' }}>
                        <div className="stat-icon amber"><ShieldAlert size={24} /></div>
                        <div className="stat-value"><AnimatedCounter value={stats.threatCount} /></div>
                        <div className="stat-label">Shield Warnings Cached</div>
                    </SpotlightCard>
                </Reveal>
            </div>

            <div className="grid-2">
                <div className="card">
                    <div className="card-header">
                        <h2>Recent Policies</h2>
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/policies')}>
                            View All <ArrowRight size={14} />
                        </button>
                    </div>
                    {policies.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {policies.slice(0, 5).map((p) => (
                                <div key={p._id} className="policy-card" role="button" tabIndex={0} style={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/policies?policyId=${p._id}`)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/policies?policyId=${p._id}`); } }}>
                                    <div className="policy-type">{p.policyType}</div>
                                    <h3>{p.providerName}</h3>
                                    <div className="policy-info">
                                        <div className="policy-info-row">
                                            <span className="label">Policy #</span>
                                            <span className="value">{p.policyNumber}</span>
                                        </div>
                                        <div className="policy-info-row">
                                            <span className="label">Coverage</span>
                                            <span className="value">₹{Number(p.coverageAmount || 0).toLocaleString('en-IN')}</span>
                                        </div>
                                    </div>
                                    <div className="score-bar">
                                        <div
                                            className={`score-bar-fill ${p.verificationScore > 70 ? 'high' : p.verificationScore > 40 ? 'medium' : 'low'}`}
                                            style={{ width: `${p.verificationScore || 0}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <Upload size={48} />
                            <h3>No Policies Yet</h3>
                            <p>Upload your first policy to get AI-powered insights</p>
                            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/policies')}>
                                Upload Policy
                            </button>
                        </div>
                    )}
                </div>

                <div className="card">
                    <div className="card-header">
                        <h2>Quick Actions</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {[
                            { icon: Upload, label: 'Upload & Score Policy PDF', desc: 'Plain-English coverage card, waiting periods & page links', path: '/policies', color: 'purple' },
                            { icon: Sparkles, label: 'Talk with Parinidhi AI (3D Voice)', desc: 'Voice & text policy advisor with live insurer checks', path: '/terminal', color: 'blue' },
                            { icon: Shield, label: 'Claim Estimator & Vehicle Damage AI', desc: 'Room-rent slider, car damage photo check & appeal letters', path: '/claims', color: 'green' },
                            { icon: ShieldAlert, label: 'Download Browser Shield Extension', desc: 'Protect Chrome, WhatsApp Web & Gmail from scam links', path: '/shield', color: 'amber' },
                            { icon: TrendingUp, label: 'Market & IRDAI Rights', desc: 'Verify official insurers and compare live coverage terms', path: '/market', color: 'purple' },
                        ].map(({ icon: Icon, label, desc, path, color }) => (
                            <div
                                key={path}
                                className="policy-card"
                                role="button"
                                tabIndex={0}
                                onClick={() => navigate(path)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(path); } }}
                                style={{ display: 'flex', alignItems: 'center', gap: 16 }}
                            >
                                <div className={`stat-icon ${color}`} style={{ flexShrink: 0 }}>
                                    <Icon size={22} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: 14, marginBottom: 2 }}>{label}</h3>
                                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{desc}</p>
                                </div>
                                <ArrowRight size={16} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
