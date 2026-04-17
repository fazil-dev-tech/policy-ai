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
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadStats(); }, []);

    const loadStats = async () => {
        try {
            const { data } = await api.get('/admin/stats');
            setStats(data);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to load admin stats');
        } finally {
            setLoading(false);
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
                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, color: '#e2e8f0' }} />
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
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.1)" />
                                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, color: '#e2e8f0' }} />
                                <Line type="monotone" dataKey="users" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} />
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
        </div>
    );
}
