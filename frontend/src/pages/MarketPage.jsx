import { useState, useEffect } from 'react';
import api from '../services/api';
import { TrendingUp, Star, Clock, Award, BarChart3, Activity, Globe, Heart, Shield, Car, Plane, Home, Briefcase, ExternalLink } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
    PolarRadiusAxis, Radar
} from 'recharts';
import toast from 'react-hot-toast';

export default function MarketPage() {
    const [providers, setProviders] = useState([]);
    const [insights, setInsights] = useState(null);
    const [loading, setLoading] = useState(true);
    const [insightsLoading, setInsightsLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    useEffect(() => {
        loadProviders();
        loadInsights();
    }, []);

    const loadProviders = async () => {
        try {
            const { data } = await api.get('/market/providers');
            setProviders(data.providers || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadInsights = async () => {
        setInsightsLoading(true);
        try {
            const { data } = await api.get(`/market/insights?_t=${Date.now()}`);
            setInsights(data);
            setLastUpdated(new Date());
        } catch (err) {
            toast.error('Failed to load market insights');
        } finally {
            setInsightsLoading(false);
        }
    };

    const chartData = providers.map((p) => ({
        name: p.providerName?.length > 15 ? p.providerName.slice(0, 15) + '...' : p.providerName,
        settlement: p.claimSettlementRatio,
        rating: p.rating * 20,
        time: p.averageClaimTime,
    }));

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1>Market Analysis</h1>
                    <p>Compare insurance providers and get AI-powered insights</p>
                </div>
                <button className="btn btn-primary" onClick={loadInsights} disabled={insightsLoading}>
                    {insightsLoading ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <><BarChart3 size={16} /> Generate Insights</>}
                </button>
            </div>

            {/* AI LIVE Market Insights */}
            {insights && (
                <div className="card" style={{ border: '2px solid var(--accent-primary)', boxShadow: '0 12px 40px rgba(139, 92, 246, 0.2)', marginBottom: 32, overflow: 'hidden' }}>
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(139, 92, 246, 0.05)', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--danger)', boxShadow: '0 0 12px var(--danger)', animation: 'pulse 1.5s infinite' }} />
                            <h3 style={{ margin: 0, color: 'var(--accent-primary)', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Global Market Live Feed</h3>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '6px 14px', borderRadius: 24, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-color)' }}>
                            <Activity size={14} style={{ color: 'var(--accent-primary)' }} />
                            {lastUpdated ? lastUpdated.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'Updating...'}
                        </span>
                    </div>
                    <div style={{ padding: '32px 24px' }}>
                        <div style={{ background: 'var(--bg-glass)', padding: 32, borderRadius: 16, border: '1px solid rgba(139, 92, 246, 0.2)', position: 'relative' }}>
                            <div style={{ position: 'absolute', top: -14, left: 32, background: 'var(--bg-primary)', padding: '0 12px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: 20 }}>
                                <Globe size={16} style={{ color: 'var(--accent-primary)' }} /> AI Quantitative Assessment
                            </div>
                            <div style={{ fontSize: 16, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em' }}>
                                {insights.insights?.puter || 'Establishing connection to Global Market Data...'}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Insurance Types Explorer */}
            <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Insurance Types Available</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14 }}>Explore different insurance categories and find the best coverage for your needs</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                    {[
                        { icon: Heart, name: 'Health Insurance', color: '#ec4899', desc: 'Medical expenses, hospitalization, surgeries, and preventive care coverage.', link: 'https://www.policybazaar.com/health-insurance/' },
                        { icon: Shield, name: 'Life Insurance', color: '#8b5cf6', desc: 'Financial protection for your family with term, endowment, and ULIP plans.', link: 'https://www.policybazaar.com/life-insurance/' },
                        { icon: Car, name: 'Motor Insurance', color: '#3b82f6', desc: 'Comprehensive and third-party coverage for cars, bikes, and commercial vehicles.', link: 'https://www.policybazaar.com/motor-insurance/' },
                        { icon: Plane, name: 'Travel Insurance', color: '#f59e0b', desc: 'Trip cancellation, medical emergencies, lost baggage, and flight delay cover.', link: 'https://www.policybazaar.com/travel-insurance/' },
                        { icon: Home, name: 'Home Insurance', color: '#10b981', desc: 'Property damage from fire, theft, natural disasters, and liability protection.', link: 'https://www.policybazaar.com/home-insurance/' },
                        { icon: Briefcase, name: 'Business Insurance', color: '#ef4444', desc: 'Commercial liability, property, employee coverage, and business interruption.', link: 'https://www.coverfox.com/business-insurance/' },
                    ].map(({ icon: Icon, name, color, desc, link }) => (
                        <div key={name} className="card" style={{ padding: 20, border: `1px solid ${color}20`, transition: 'all 0.3s', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 12px 30px ${color}15`; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                                <div style={{ width: 42, height: 42, borderRadius: 12, background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Icon size={20} style={{ color }} />
                                </div>
                                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{name}</h3>
                            </div>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>{desc}</p>
                            <a href={link} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                                Compare & Buy <ExternalLink size={12} />
                            </a>
                        </div>
                    ))}
                </div>
            </div>

            {/* Provider Stats */}
            {providers.length > 0 ? (
                <>
                    <div className="stats-grid" style={{ marginBottom: 32 }}>
                        <div className="stat-card">
                            <div className="stat-icon purple"><Award size={24} /></div>
                            <div className="stat-value">{providers.length}</div>
                            <div className="stat-label">Providers Tracked</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon green"><TrendingUp size={24} /></div>
                            <div className="stat-value">
                                {Math.round(providers.reduce((s, p) => s + p.claimSettlementRatio, 0) / providers.length)}%
                            </div>
                            <div className="stat-label">Avg Settlement Ratio</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon amber"><Star size={24} /></div>
                            <div className="stat-value">
                                {(providers.reduce((s, p) => s + p.rating, 0) / providers.length).toFixed(1)}
                            </div>
                            <div className="stat-label">Avg Rating</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon blue"><Clock size={24} /></div>
                            <div className="stat-value">
                                {Math.round(providers.reduce((s, p) => s + p.averageClaimTime, 0) / providers.length)}d
                            </div>
                            <div className="stat-label">Avg Claim Time</div>
                        </div>
                    </div>

                    {/* Market Perspectives & Types */}
                    <div className="card" style={{ marginBottom: 32 }}>
                        <div className="card-header">
                            <h3>Global Insurance Market Insights</h3>
                        </div>
                        <div style={{ padding: 24 }}>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
                                Understanding the fundamental structure of the insurance market allows for optimized policy
                                selection. Below is a professional breakdown of major insurance provider categories and current market perspectives:
                            </p>
                            <div className="grid-2">
                                <div style={{ background: 'var(--bg-glass)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                                    <h4 style={{ color: 'var(--accent-primary)', marginBottom: 8 }}>Health Insurance Providers</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                                        Dominated by HMOs (Health Maintenance Organizations) and PPOs (Preferred Provider Organizations).
                                        The market is trending towards AI-driven preventative care and personalized premiums based on
                                        biometric tracking.
                                    </p>
                                </div>
                                <div style={{ background: 'var(--bg-glass)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                                    <h4 style={{ color: 'var(--accent-primary)', marginBottom: 8 }}>Life Insurance Markets</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                                        Divided primarily into Term Life and Whole/Universal Life providers. The market perspective
                                        is shifting heavily towards accelerated underwriting and living benefits that provide value
                                        prior to mortality events.
                                    </p>
                                </div>
                                <div style={{ background: 'var(--bg-glass)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                                    <h4 style={{ color: 'var(--accent-primary)', marginBottom: 8 }}>P&C (Property & Casualty)</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                                        Covers Auto, Home, and Renters insurance. This sector is experiencing rapid transformation via
                                        telematics (driving data) and IoT (smart home sensors) to dynamically price risk and prevent
                                        claims before they happen.
                                    </p>
                                </div>
                                <div style={{ background: 'var(--bg-glass)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                                    <h4 style={{ color: 'var(--accent-primary)', marginBottom: 8 }}>Commercial & Business Specialty</h4>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                                        Providers explicitly catering to corporate liability, D&O (Directors and Officers), and Cyber
                                        Insurance. Cyber policies currently represent the highest growth sector due to escalating
                                        digital threats globally.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="grid-2" style={{ marginBottom: 32 }}>
                        <div className="card">
                            <div className="card-header"><h3>Settlement Ratio Comparison</h3></div>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.1)" />
                                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, color: '#e2e8f0' }} />
                                    <Bar dataKey="settlement" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="card">
                            <div className="card-header"><h3>Provider Comparison</h3></div>
                            <ResponsiveContainer width="100%" height={300}>
                                <RadarChart data={chartData}>
                                    <PolarGrid stroke="rgba(139,92,246,0.1)" />
                                    <PolarAngleAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <PolarRadiusAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                    <Radar name="Settlement" dataKey="settlement" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} />
                                    <Radar name="Rating" dataKey="rating" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, color: '#e2e8f0' }} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Provider Table */}
                    <div className="card" style={{ marginBottom: 32 }}>
                        <div className="card-header"><h3>All Providers</h3></div>
                        <div className="table-wrapper">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Provider</th>
                                        <th>Rating</th>
                                        <th>Settlement Ratio</th>
                                        <th>Avg Claim Time</th>
                                        <th>Premium Range</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {providers.map((p) => (
                                        <tr key={p._id}>
                                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.providerName}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <Star size={14} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
                                                    {p.rating}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`badge ${p.claimSettlementRatio > 80 ? 'badge-success' : p.claimSettlementRatio > 60 ? 'badge-warning' : 'badge-danger'}`}>
                                                    {p.claimSettlementRatio}%
                                                </span>
                                            </td>
                                            <td>{p.averageClaimTime} days</td>
                                            <td>₹{p.premiumRange?.min?.toLocaleString()} - ₹{p.premiumRange?.max?.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <div className="empty-state">
                    <TrendingUp size={64} />
                    <h3>No Market Data Available</h3>
                    <p>Market data will be populated by administrators</p>
                </div>
            )}
        </div>
    );
}
