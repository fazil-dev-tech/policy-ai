import { useState, useEffect } from 'react';
import api from '../services/api';
import {
    Users, FileText, Shield, MessageSquare, AlertTriangle,
    BarChart3, TrendingUp, Activity
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import toast from 'react-hot-toast';

const COLORS = ['#8b5cf6', '#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function AdminPage() {
    const [stats, setStats] = useState(null);
    const [scamReports, setScamReports] = useState([]);
    const [verifiedDomains, setVerifiedDomains] = useState([]);
    const [newDomain, setNewDomain] = useState({ domain: '', providerName: '', category: 'insurer' });
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadStats(); }, []);

    const loadStats = async () => {
        try {
            const [statsRes, reportsRes, domainsRes] = await Promise.all([
                api.get('/admin/stats'),
                api.get('/admin/scam-reports').catch(() => ({ data: { reports: [] } })),
                api.get('/admin/verified-domains').catch(() => ({ data: { domains: [] } })),
            ]);
            setStats(statsRes.data);
            setScamReports(reportsRes.data.reports || []);
            setVerifiedDomains(domainsRes.data.domains || []);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to load admin stats');
        } finally {
            setLoading(false);
        }
    };

    const handleModerateReport = async (id, moderationStatus) => {
        try {
            await api.patch(`/admin/scam-reports/${id}`, { moderationStatus });
            toast.success(`Report marked ${moderationStatus}`);
            loadStats();
        } catch {
            toast.error('Moderation update failed');
        }
    };

    const handleAddDomain = async (e) => {
        e.preventDefault();
        if (!newDomain.domain || !newDomain.providerName) return;
        try {
            await api.post('/admin/verified-domains', newDomain);
            toast.success('Verified domain added');
            setNewDomain({ domain: '', providerName: '', category: 'insurer' });
            loadStats();
        } catch {
            toast.error('Failed to add verified domain');
        }
    };

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!stats) return <div className="empty-state"><h3>Unable to load admin data</h3></div>;

    const policyChartData = (stats.analytics?.policyTypeDistribution || []).map((d) => ({
        name: d._id || 'Unknown',
        value: d.count,
    }));

    const userGrowthData = (stats.analytics?.userGrowth || []).map((d) => ({
        date: d._id,
        users: d.count,
    }));

    return (
        <div>
            <div className="page-header">
                <h1>Admin Dashboard</h1>
                <p>System overview and analytics</p>
            </div>

            {/* Overview Stats */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon purple"><Users size={24} /></div>
                    <div className="stat-value">{stats.overview?.totalUsers}</div>
                    <div className="stat-label">Total Users</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon blue"><Activity size={24} /></div>
                    <div className="stat-value">{stats.overview?.activeUsers}</div>
                    <div className="stat-label">Active Users (30d)</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon green"><FileText size={24} /></div>
                    <div className="stat-value">{stats.overview?.totalPolicies}</div>
                    <div className="stat-label">Total Policies</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon amber"><Shield size={24} /></div>
                    <div className="stat-value">{stats.overview?.totalClaims}</div>
                    <div className="stat-label">Total Claims</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon blue"><MessageSquare size={24} /></div>
                    <div className="stat-value">{stats.aiUsage?.totalChats}</div>
                    <div className="stat-label">AI Chats</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon green"><TrendingUp size={24} /></div>
                    <div className="stat-value">{stats.analytics?.claimSuccessRate}%</div>
                    <div className="stat-label">Claim Success Rate</div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid-2" style={{ marginBottom: 32 }}>
                <div className="card">
                    <div className="card-header">
                        <h3>Policy Distribution</h3>
                    </div>
                    {policyChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={policyChartData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                    {policyChartData.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #f472b6', borderRadius: 10, color: '#0f172a' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="empty-state" style={{ padding: 40 }}><p>No policy data yet</p></div>
                    )}
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3>User Growth (30 Days)</h3>
                    </div>
                    {userGrowthData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={userGrowthData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(236,72,153,0.12)" />
                                <XAxis dataKey="date" tick={{ fill: '#334155', fontSize: 12 }} />
                                <YAxis tick={{ fill: '#334155', fontSize: 12 }} />
                                <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #f472b6', borderRadius: 10, color: '#0f172a' }} />
                                <Line type="monotone" dataKey="users" stroke="#ec4899" strokeWidth={2} dot={{ fill: '#ec4899' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="empty-state" style={{ padding: 40 }}><p>No growth data yet</p></div>
                    )}
                </div>
            </div>

            {/* Claims Analytics */}
            <div className="grid-2" style={{ marginBottom: 32 }}>
                <div className="card">
                    <div className="card-header">
                        <h3>Claims Overview</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div style={{ background: 'var(--bg-glass)', padding: 16, borderRadius: 12 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Pending</div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>{stats.overview?.pendingClaims}</div>
                        </div>
                        <div style={{ background: 'var(--bg-glass)', padding: 16, borderRadius: 12 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Approved</div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{stats.overview?.approvedClaims}</div>
                        </div>
                        <div style={{ background: 'var(--bg-glass)', padding: 16, borderRadius: 12 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Rejected</div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#ef4444' }}>{stats.overview?.rejectedClaims}</div>
                        </div>
                        <div style={{ background: 'var(--bg-glass)', padding: 16, borderRadius: 12 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Avg Amount</div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#8b5cf6' }}>
                                ₹{Math.round(stats.analytics?.claimAmountStats?.avgAmount || 0).toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3>AI Usage</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div style={{ background: 'var(--bg-glass)', padding: 16, borderRadius: 12 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Total Chats</div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6' }}>{stats.aiUsage?.totalChats}</div>
                        </div>
                        <div style={{ background: 'var(--bg-glass)', padding: 16, borderRadius: 12 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Recent (7d)</div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#6366f1' }}>{stats.aiUsage?.recentChats}</div>
                        </div>
                        <div style={{ background: 'var(--bg-glass)', padding: 16, borderRadius: 12, gridColumn: 'span 2' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Avg Chats/Day</div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#8b5cf6' }}>{stats.aiUsage?.avgChatsPerDay}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Fraud Alerts */}
            <div className="card">
                <div className="card-header">
                    <h3><AlertTriangle size={18} style={{ color: 'var(--warning)', marginRight: 8 }} />Fraud Detection Alerts</h3>
                </div>
                {(stats.fraudAlerts?.policies?.length > 0 || stats.fraudAlerts?.claims?.length > 0) ? (
                    <div className="table-wrapper">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Details</th>
                                    <th>User</th>
                                    <th>Risk Score</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(stats.fraudAlerts?.policies || []).map((alert) => (
                                    <tr key={`p-${alert.id}`}>
                                        <td><span className="badge badge-warning">Policy</span></td>
                                        <td>{alert.policyNumber} ({alert.providerName})</td>
                                        <td>{alert.user}</td>
                                        <td>
                                            <span className={`badge ${alert.verificationScore < 30 ? 'badge-danger' : 'badge-warning'}`}>
                                                {alert.verificationScore}% verified
                                            </span>
                                        </td>
                                        <td>{new Date(alert.createdAt).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                                {(stats.fraudAlerts?.claims || []).map((alert) => (
                                    <tr key={`c-${alert.id}`}>
                                        <td><span className="badge badge-danger">Claim</span></td>
                                        <td>{alert.policyNumber} — ₹{alert.claimAmount?.toLocaleString()}</td>
                                        <td>{alert.user}</td>
                                        <td>
                                            <span className="badge badge-danger">{alert.fraudScore}% fraud risk</span>
                                        </td>
                                        <td>{new Date(alert.claimDate).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state" style={{ padding: 30 }}>
                        <p>No fraud alerts — all clear! ✅</p>
                    </div>
                )}
            </div>

            {/* Browser Shield Scam Moderation & Verified Registry */}
            <div className="grid-2" style={{ marginTop: 28 }}>
                <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ marginBottom: 12 }}>Browser Shield Scam Moderation ({scamReports.length})</h3>
                    {scamReports.length > 0 ? (
                        <div className="table-wrapper" style={{ maxHeight: 280, overflowY: 'auto' }}>
                            <table className="table">
                                <thead><tr><th>Domain</th><th>Category</th><th>Status</th><th>Action</th></tr></thead>
                                <tbody>
                                    {scamReports.map((r) => (
                                        <tr key={r.id}>
                                            <td><code>{r.domain}</code></td>
                                            <td>{r.category}</td>
                                            <td><span className={`badge ${r.moderation_status === 'verified' ? 'badge-danger' : r.moderation_status === 'rejected' ? 'badge-success' : 'badge-warning'}`}>{r.moderation_status}</span></td>
                                            <td style={{ display: 'flex', gap: 6 }}>
                                                <button className="btn btn-danger btn-sm" onClick={() => handleModerateReport(r.id, 'verified')}>Verify</button>
                                                <button className="btn btn-secondary btn-sm" onClick={() => handleModerateReport(r.id, 'rejected')}>Reject</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No community scam reports queued.</p>
                    )}
                </div>

                <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ marginBottom: 12 }}>Verified Domains Manager ({verifiedDomains.length})</h3>
                    <form onSubmit={handleAddDomain} style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                        <input className="form-input" placeholder="domain.in" style={{ flex: 1 }} value={newDomain.domain} onChange={(e) => setNewDomain({ ...newDomain, domain: e.target.value })} />
                        <input className="form-input" placeholder="Provider Name" style={{ flex: 1 }} value={newDomain.providerName} onChange={(e) => setNewDomain({ ...newDomain, providerName: e.target.value })} />
                        <button className="btn btn-primary btn-sm" type="submit">Add</button>
                    </form>
                    <div style={{ maxHeight: 210, overflowY: 'auto', fontSize: 12 }}>
                        {verifiedDomains.slice(0, 12).map((d) => (
                            <div key={d.id} style={{ padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}>
                                <strong>{d.provider_name}</strong> — <code>{d.domain}</code> ({d.category})
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
