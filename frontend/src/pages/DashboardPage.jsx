import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { FileText, MessageSquare, Shield, TrendingUp, Upload, ArrowRight } from 'lucide-react';

export default function DashboardPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({ policies: 0, claims: 0, chats: 0 });
    const [policies, setPolicies] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            const [policyRes] = await Promise.all([
                api.get('/policy?limit=5')
            ]);
            setPolicies(policyRes.data.policies || []);
            setStats({
                policies: policyRes.data.total || 0,
                chats: 0,
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

    return (
        <div>
            <div className="page-header">
                <h1>Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
                <p>Here's an overview of your insurance portfolio</p>
            </div>

            <div className="stats-grid">
                <div className="stat-card" onClick={() => navigate('/policies')} style={{ cursor: 'pointer' }}>
                    <div className="stat-icon purple"><FileText size={24} /></div>
                    <div className="stat-value">{stats.policies}</div>
                    <div className="stat-label">Total Policies</div>
                </div>
                <div className="stat-card" onClick={() => navigate('/claims')} style={{ cursor: 'pointer' }}>
                    <div className="stat-icon green"><Shield size={24} /></div>
                    <div className="stat-value">Active</div>
                    <div className="stat-label">AI Claim Rules</div>
                </div>
                <div className="stat-card" onClick={() => navigate('/chat')} style={{ cursor: 'pointer' }}>
                    <div className="stat-icon blue"><MessageSquare size={24} /></div>
                    <div className="stat-value">{stats.chats}</div>
                    <div className="stat-label">AI Chats</div>
                </div>
                <div className="stat-card" onClick={() => navigate('/market')} style={{ cursor: 'pointer' }}>
                    <div className="stat-icon amber"><TrendingUp size={24} /></div>
                    <div className="stat-value">Live</div>
                    <div className="stat-label">Market Insights</div>
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
                            { icon: Upload, label: 'Upload New Policy', desc: 'Get AI analysis of your insurance policy', path: '/policies', color: 'purple' },
                            { icon: MessageSquare, label: 'Ask AI Assistant', desc: 'Chat about your policies and coverage', path: '/chat', color: 'blue' },
                            { icon: Shield, label: 'View Claim Rules', desc: 'Extract AI guidance for filing claims', path: '/claims', color: 'green' },
                            { icon: TrendingUp, label: 'Market Analysis', desc: 'Compare providers and live market trends', path: '/market', color: 'amber' },
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
