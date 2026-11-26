import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { FileText, MessageSquare, Shield, TrendingUp, Upload, ArrowRight, ShieldAlert, Users, Sparkles } from 'lucide-react';

export default function DashboardPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({ policies: 0, incidents: 0, familyMembers: 0, threatCount: 0 });
    const [policies, setPolicies] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            const [policyRes, incRes, famRes, scanRes] = await Promise.all([
                api.get('/policy?limit=5'),
                api.get('/incidents').catch(() => ({ data: { incidents: [] } })),
                api.get('/family').catch(() => ({ data: { members: [] } })),
                api.get('/security/scans').catch(() => ({ data: { scans: [] } })),
            ]);
            setPolicies(policyRes.data.policies || []);
            setStats({
                policies: policyRes.data.total || 0,
                incidents: (incRes.data?.incidents || []).length,
                familyMembers: (famRes.data?.members || []).length,
                threatCount: (scanRes.data?.scans || []).filter((s) => s.status !== 'safe').length,
            });
        } catch (err) {
            console.error('Dashboard load error:', err);
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

    return (
        <div>
            <div className="page-header">
                <h1>Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
                <p>Live insurance portfolio, deterministic claims readiness, Parinidhi AI, and threat defense</p>
            </div>

            {expiringSoon.length > 0 && (
                <div className="card" style={{ padding: 14, marginBottom: 20, border: '1px solid rgba(217,119,6,0.35)', background: 'rgba(254,243,199,0.55)' }}>
                    <strong>Upcoming Policy Renewals ({expiringSoon.length}):</strong>{' '}
                    {expiringSoon.map((p) => `${p.providerName} (#${p.policyNumber})`).join(' · ')}
                </div>
            )}

            <div className="stats-grid">
                <div className="stat-card" onClick={() => navigate('/policies')} style={{ cursor: 'pointer' }}>
                    <div className="stat-icon purple"><FileText size={24} /></div>
                    <div className="stat-value">{stats.policies}</div>
                    <div className="stat-label">Active Policies</div>
                </div>
                <div className="stat-card" onClick={() => navigate('/claims')} style={{ cursor: 'pointer' }}>
                    <div className="stat-icon green"><Shield size={24} /></div>
                    <div className="stat-value">{stats.incidents}</div>
                    <div className="stat-label">Claim Analyses Saved</div>
                </div>
                <div className="stat-card" onClick={() => navigate('/family')} style={{ cursor: 'pointer' }}>
                    <div className="stat-icon blue"><Users size={24} /></div>
                    <div className="stat-value">{stats.familyMembers}</div>
                    <div className="stat-label">Family Vault Members</div>
                </div>
                <div className="stat-card" onClick={() => navigate('/shield')} style={{ cursor: 'pointer' }}>
                    <div className="stat-icon amber"><ShieldAlert size={24} /></div>
                    <div className="stat-value">{stats.threatCount}</div>
                    <div className="stat-label">Shield Warnings Cached</div>
                </div>
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
                            {policies.map((p) => (
                                <div key={p._id} className="policy-card" style={{ cursor: 'default' }}>
                                    <div className="policy-type">{p.policyType}</div>
                                    <h3>{p.providerName}</h3>
                                    <div className="policy-info">
                                        <div className="policy-info-row">
                                            <span className="label">Policy #</span>
                                            <span className="value">{p.policyNumber}</span>
                                        </div>
                                        <div className="policy-info-row">
                                            <span className="label">Coverage</span>
                                            <span className="value">₹{p.coverageAmount?.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="score-bar">
                                        <div
                                            className={`score-bar-fill ${p.verificationScore > 70 ? 'high' : p.verificationScore > 40 ? 'medium' : 'low'}`}
                                            style={{ width: `${p.verificationScore}%` }}
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
                            { icon: Upload, label: 'Upload & Score Policy PDF', desc: 'Table-aware CIS card, 60m Moratorium & Gap Radar', path: '/policies', color: 'purple' },
                            { icon: Sparkles, label: 'Talk with Parinidhi AI (3D Voice)', desc: 'Voice/text policy advisor & live market comparisons', path: '/terminal', color: 'blue' },
                            { icon: Shield, label: 'Claim Estimator & Vehicle Damage AI', desc: 'What-If Room Rent slider, Motor repair split & GRO letters', path: '/claims', color: 'green' },
                            { icon: ShieldAlert, label: 'Download Browser Shield Extension', desc: 'Protect Chrome, WhatsApp Web & Gmail from .apk/UPI scams', path: '/shield', color: 'amber' },
                            { icon: TrendingUp, label: 'Market & IRDAI Rights', desc: 'Verify official insurers and compare live coverage terms', path: '/market', color: 'purple' },
                        ].map(({ icon: Icon, label, desc, path, color }) => (
                            <div
                                key={path}
                                className="policy-card"
                                onClick={() => navigate(path)}
                                style={{ display: 'flex', alignItems: 'center', gap: 16 }}
                            >
                                <div className={`stat-icon ${color}`}>
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
