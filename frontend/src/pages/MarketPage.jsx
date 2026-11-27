import { useState, useEffect } from 'react';
import api from '../services/api';
import MarkdownText from '../components/shared/MarkdownText';
import { TrendingUp, Star, Clock, Award, BarChart3, Activity, Globe, Heart, Shield, Car, Plane, Home, Briefcase, ExternalLink } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
    PolarRadiusAxis, Radar, Legend
} from 'recharts';
import toast from 'react-hot-toast';

export default function MarketPage() {
    const [providers, setProviders] = useState([]);
    const [insights, setInsights] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [insightsLoading, setInsightsLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [verifyInput, setVerifyInput] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [verifyResult, setVerifyResult] = useState(null);
    const [sortBy, setSortBy] = useState('rating');

    const handleVerifyInsurer = async (e) => {
        e.preventDefault();
        if (!verifyInput.trim()) {
            toast.error('Please enter an insurer name to verify');
            return;
        }
        setVerifying(true);
        try {
            const { data } = await api.post('/research/verify-insurer', { providerName: verifyInput.trim() });
            setVerifyResult(data);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Insurer live verification failed');
        } finally {
            setVerifying(false);
        }
    };

    useEffect(() => {
        loadProviders(sortBy);
    }, [sortBy]);

    useEffect(() => {
        loadInsights(false);
    }, []);

    const loadProviders = async (sortField = sortBy) => {
        setLoadError(false);
        try {
            const order = sortField === 'averageClaimTime' ? 'asc' : 'desc';
            const { data } = await api.get(`/market/providers?sortBy=${encodeURIComponent(sortField)}&order=${order}`);
            setProviders(data.providers || []);
        } catch (err) {
            console.error(err);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    };

    const loadInsights = async (forceRefresh = false) => {
        setInsightsLoading(true);
        try {
            const suffix = forceRefresh ? `?refresh=1&_t=${Date.now()}` : '';
            const { data } = await api.get(`/market/insights${suffix}`);
            setInsights(data);
            setLastUpdated(new Date());
        } catch {
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
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1>Market Analysis</h1>
                    <p>Compare Indian insurers, verify official portals & explore IRDAI policyholder rights</p>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => loadInsights(true)} disabled={insightsLoading}>
                    {insightsLoading ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <><BarChart3 size={16} /> Generate Insights</>}
                </button>
            </div>

            {/* AI LIVE Market Insights */}
            {insights && (
                <div className="card" style={{ border: '2px solid rgba(190, 18, 60, 0.35)', boxShadow: '0 12px 40px rgba(225, 29, 72, 0.12)', marginBottom: 32, overflow: 'hidden' }}>
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, background: 'rgba(225, 29, 72, 0.05)', borderBottom: '1px solid rgba(225, 29, 72, 0.12)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#b91c1c', boxShadow: '0 0 12px rgba(185, 28, 28, 0.55)', animation: 'pulse 1.5s infinite' }} />
                            <h2 style={{ margin: 0, color: '#be123c', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Global Market Live Feed</h2>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '6px 14px', borderRadius: 24, display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border-color)' }}>
                            <Activity size={14} style={{ color: '#be123c' }} />
                            {lastUpdated ? lastUpdated.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Updating...'}
                        </span>
                    </div>
                    <div style={{ padding: '32px 24px' }}>
                        <div style={{ background: 'var(--bg-glass)', padding: 28, borderRadius: 16, border: '1px solid rgba(225, 29, 72, 0.18)', position: 'relative' }}>
                            <div style={{ position: 'absolute', top: -14, left: 28, background: 'var(--bg-primary)', padding: '2px 12px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(225, 29, 72, 0.25)', borderRadius: 20, fontSize: 13 }}>
                                <Globe size={15} style={{ color: '#be123c' }} /> AI Quantitative Assessment
                            </div>
                            <div style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-primary)' }}>
                                <MarkdownText baseLevel={3} content={insights.insights?.summary || insights.insights?.puter || 'Establishing connection to Global Market Data...'} />
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
                        { icon: Heart, name: 'Health Insurance', color: '#be123c', desc: 'Medical expenses, hospitalization, surgeries, and preventive care coverage.', link: 'https://www.policybazaar.com/health-insurance/' },
                        { icon: Shield, name: 'Life Insurance', color: '#9f1239', desc: 'Financial protection for your family with term, endowment, and ULIP plans.', link: 'https://www.policybazaar.com/life-insurance/' },
                        { icon: Car, name: 'Motor Insurance', color: '#1d4ed8', desc: 'Comprehensive and third-party coverage for cars, bikes, and commercial vehicles.', link: 'https://www.policybazaar.com/motor-insurance/' },
                        { icon: Plane, name: 'Travel Insurance', color: '#b45309', desc: 'Trip cancellation, medical emergencies, lost baggage, and flight delay cover.', link: 'https://www.policybazaar.com/travel-insurance/' },
                        { icon: Home, name: 'Home Insurance', color: '#047857', desc: 'Property damage from fire, theft, natural disasters, and liability protection.', link: 'https://www.policybazaar.com/home-insurance/' },
                        { icon: Briefcase, name: 'Business Insurance', color: '#b91c1c', desc: 'Commercial liability, property, employee coverage, and business interruption.', link: 'https://www.coverfox.com/business-insurance/' },
                    ].map(({ icon: Icon, name, color, desc, link }) => (
                        <div key={name} className="card" style={{ padding: 20, border: `1px solid ${color}25`, transition: 'all 0.3s', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                                <div style={{ width: 42, height: 42, borderRadius: 12, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Icon size={20} style={{ color }} />
                                </div>
                                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{name}</h3>
                            </div>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>{desc}</p>
                            <a href={link} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                                Compare &amp; Buy <ExternalLink size={12} />
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

                    {/* Indian Insurance Market Benchmarks */}
                    <div className="card" style={{ marginBottom: 32 }}>
                        <div className="card-header">
                            <h2 style={{ fontSize: '1.08rem', margin: 0 }}>IRDAI Market Structure &amp; Product Segments</h2>
                        </div>
                        <div style={{ padding: 24 }}>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
                                Evaluate Indian insurers across IRDAI Claim Settlement Ratios (CSR), Incurred Claim Ratios (ICR), and cashless hospital/garage networks before buying or renewing:
                            </p>
                            <div className="grid-2">
                                <div style={{ background: 'var(--bg-glass)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                                    <h3 style={{ color: '#be123c', marginBottom: 8, fontSize: 15 }}>Health Insurance &amp; TPAs</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                                        Focus on Room-Rent Sub-limits (single private AC vs 1%/2% cap), Disease Sub-limits, Consumables Riders, No-Claim Bonus (NCB), and the 60-Month PED Moratorium under IRDAI 2024 rules.
                                    </p>
                                </div>
                                <div style={{ background: 'var(--bg-glass)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                                    <h3 style={{ color: '#be123c', marginBottom: 8, fontSize: 15 }}>Term Life &amp; Living Benefits</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                                        Compare Claim Settlement Ratio (CSR), Amount Settlement Ratio, and 3-year Section 45 non-forfeiture rules rather than focusing solely on low first-year premium illustrations.
                                    </p>
                                </div>
                                <div style={{ background: 'var(--bg-glass)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                                    <h3 style={{ color: '#be123c', marginBottom: 8, fontSize: 15 }}>Motor &amp; Home Insurance</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                                        Check IDV accuracy, Zero-Depreciation (Bumper-to-Bumper) add-on, Engine/Hydrostatic Lock cover, Return-to-Invoice, and NCB protection against standard IRDAI depreciation deductions.
                                    </p>
                                </div>
                                <div style={{ background: 'var(--bg-glass)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                                    <h3 style={{ color: '#be123c', marginBottom: 8, fontSize: 15 }}>Commercial, Cyber &amp; Travel</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                                        Covers cyber fraud/UPI unauthorized transaction riders, MSME marine &amp; transit cover, overseas medical evacuation, and D&amp;O liability with clear deductible structures.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="grid-2" style={{ marginBottom: 32 }}>
                        <div className="card" style={{ padding: 20 }}>
                            <div className="card-header"><h2 style={{ fontSize: '1.08rem', margin: 0 }}>Settlement Ratio Comparison</h2></div>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={chartData} margin={{ bottom: 16 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(225,29,72,0.12)" />
                                    <XAxis dataKey="name" interval={0} angle={-12} textAnchor="end" height={48} tick={{ fill: '#334155', fontSize: 11 }} />
                                    <YAxis domain={[0, 100]} tick={{ fill: '#334155', fontSize: 12 }} />
                                    <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, color: '#0f172a' }} />
                                    <Bar dataKey="settlement" name="Settlement %" fill="#e11d48" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="card" style={{ padding: 20 }}>
                            <div className="card-header"><h2 style={{ fontSize: '1.08rem', margin: 0 }}>Provider Comparison</h2></div>
                            <ResponsiveContainer width="100%" height={300}>
                                <RadarChart data={chartData}>
                                    <PolarGrid stroke="rgba(15,23,42,0.12)" />
                                    <PolarAngleAxis dataKey="name" tick={{ fill: '#334155', fontSize: 11 }} />
                                    <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} />
                                    <Radar name="Settlement %" dataKey="settlement" stroke="#e11d48" fill="#e11d48" fillOpacity={0.2} />
                                    <Radar name="Rating (/100)" dataKey="rating" stroke="#0284c7" fill="#0284c7" fillOpacity={0.18} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, color: '#0f172a' }} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Provider Table */}
                    <div className="card" style={{ marginBottom: 32 }}>
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                            <h2 style={{ fontSize: '1.08rem', margin: 0 }}>All Providers</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <label htmlFor="market-sort-by" className="form-label" style={{ margin: 0, fontSize: 12 }}>Sort By</label>
                                <select
                                    id="market-sort-by"
                                    name="sortBy"
                                    className="form-input"
                                    style={{ padding: '5px 10px', fontSize: 12, width: 'auto' }}
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                >
                                    <option value="rating">Highest Rating</option>
                                    <option value="claimSettlementRatio">Highest Settlement %</option>
                                    <option value="averageClaimTime">Fastest Claim Turnaround</option>
                                </select>
                            </div>
                        </div>
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
                                            <td>₹{Number(p.premiumRange?.min || 0).toLocaleString('en-IN')} - ₹{Number(p.premiumRange?.max || 0).toLocaleString('en-IN')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : loadError ? (
                <div className="empty-state" style={{ marginBottom: 24 }}>
                    <TrendingUp size={48} />
                    <h2 style={{ fontSize: '1.15rem' }}>Unable to Load Market Benchmarks</h2>
                    <p>Check your server connection and try again.</p>
                    <button type="button" className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => loadProviders(sortBy)}>Retry</button>
                </div>
            ) : (
                <div className="empty-state" style={{ marginBottom: 24 }}>
                    <TrendingUp size={64} />
                    <h2 style={{ fontSize: '1.15rem' }}>No Market Data Available</h2>
                    <p>Market benchmark data will appear here once populated by administrators.</p>
                </div>
            )}

            {/* Live Insurer Verification (Serper + Tavily + Official Domain Registry) */}
            <div className="card" style={{ padding: 24, marginTop: 24 }}>
                <h2 style={{ marginBottom: 10, fontSize: '1.08rem' }}>Verify Insurer Official Portal &amp; Live Brochure Claims</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    Cross-check any insurer against our Supabase Verified Domain Registry and live web search before buying or renewing.
                </p>
                <form onSubmit={handleVerifyInsurer} style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                    <input
                        id="market-verify-insurer"
                        name="providerName"
                        aria-label="Insurer name to verify official domain"
                        className="form-input"
                        style={{ flex: '1 1 260px' }}
                        placeholder="Enter insurer name (e.g. Star Health, HDFC ERGO, Acko)"
                        value={verifyInput}
                        onChange={(e) => setVerifyInput(e.target.value)}
                    />
                    <button className="btn btn-primary" type="submit" disabled={verifying}>
                        {verifying ? 'Verifying...' : 'Verify Official Domain & Presence'}
                    </button>
                </form>
                {verifyResult && (
                    <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                        {(verifyResult.verifiedRegistry || []).length > 0 ? (
                            <div style={{ marginBottom: 10 }}>
                                {verifyResult.verifiedRegistry.map((v) => (
                                    <div key={v.id} style={{ fontSize: 13 }}>
                                        <span className="badge badge-success">Verified Registry Match</span> <strong>{v.provider_name}</strong> — <code>{v.domain}</code> · Helpline: {v.official_helpline || '—'} · Grievance: {v.grievance_email || '—'}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <span className="badge badge-warning" style={{ marginBottom: 8 }}>Not in Baseline Registry — Inspect Live Results Carefully</span>
                        )}
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                            <strong>Web Search Engine ({verifyResult.webVerification?.engine || 'registry'}):</strong> {verifyResult.webVerification?.answer || ''}
                            <ul style={{ margin: '6px 0 0 18px' }}>
                                {(verifyResult.webVerification?.results || []).slice(0, 3).map((r, i) => {
                                    const safeHref = /^https?:\/\//i.test(String(r.url || '')) ? r.url : null;
                                    return (
                                        <li key={i}>{safeHref ? <a href={safeHref} target="_blank" rel="noreferrer" style={{ color: '#be123c' }}>{r.title}</a> : <span>{r.title}</span>}</li>
                                    );
                                })}
                            </ul>
                        </div>
                    </div>
                )}
            </div>

            {/* Insurance Education Centre (IRDAI Know Your Rights) */}
            <div className="card" style={{ padding: 24, marginTop: 24 }}>
                <h2 style={{ marginBottom: 14, fontSize: '1.08rem' }}>IRDAI Insurance Education &amp; Policyholder Rights</h2>
                <div className="grid-2">
                    {[
                        ['60-Month PED Moratorium (May 2024)', 'After 60 continuous months of health coverage, insurers cannot reject claims on non-disclosure or pre-existing disease grounds (except proven fraud).'],
                        ['3-Hour Cashless Discharge SLA', 'Insurers must decide pre-auth within 1 hour and approve final cashless discharge bills within 3 hours or bear additional hospital stay costs.'],
                        ['Proportionate Room-Rent Deduction Trap', 'Selecting a hospital room costlier than your policy’s eligible category/cap reduces surgeon fees, OT & diagnostics proportionally — check whether any-room or 1%/2% limits apply.'],
                        ['30-Day Free-Look & Bima Bharosa', 'Every digital/retail policy includes a 30-day review window to cancel if mis-sold. Unresolved grievances escalate freely via bimabharosa.irdai.gov.in.'],
                    ].map(([title, body]) => (
                        <div key={title} style={{ padding: 14, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                            <strong style={{ color: '#be123c', fontSize: 14 }}>{title}</strong>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, marginBottom: 0 }}>{body}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
