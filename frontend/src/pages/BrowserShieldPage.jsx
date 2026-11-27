import { useState, useEffect } from 'react';
import api from '../services/api';
import { supabase } from '../services/supabase';
import {
    ShieldAlert, ShieldCheck, Download, Search, Globe,
    AlertTriangle, CheckCircle, PhoneCall
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function BrowserShieldPage() {
    const [testUrl, setTestUrl] = useState('');
    const [contextNote, setContextNote] = useState('');
    const [sensitivity, setSensitivity] = useState('balanced');
    const [checking, setChecking] = useState(false);
    const [reporting, setReporting] = useState(false);
    const [verdict, setVerdict] = useState(null);
    const [scans, setScans] = useState([]);
    const [verifiedDomains, setVerifiedDomains] = useState([]);
    const [scamReports, setScamReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [extVersion, setExtVersion] = useState(() => document.documentElement.dataset.policyguardExtension || '');
    const [syncingExt, setSyncingExt] = useState(false);

    const [reportForm, setReportForm] = useState({ url: '', category: 'phishing', description: '' });

    useEffect(() => {
        loadShieldData();
        const onMsg = (e) => {
            if (e.source !== window || !e.data || !e.data.policyguard) return;
            if (e.data.policyguard === 'pong' && e.data.version) {
                setExtVersion(e.data.version);
            }
            if (e.data.policyguard === 'synced') {
                setSyncingExt(false);
                if (e.data.ok) toast.success(`Extension v${e.data.version} linked cleanly!`);
                else toast.error('Extension refused sync — reload the extension and try again.');
            }
        };
        window.addEventListener('message', onMsg);
        window.postMessage({ policyguard: 'ping' }, window.location.origin);
        return () => window.removeEventListener('message', onMsg);
    }, []);

    const handleSyncExtension = async () => {
        setSyncingExt(true);
        let token = localStorage.getItem('accessToken') || '';
        let refreshToken = localStorage.getItem('refreshToken') || '';
        let userEmail = '';
        try {
            if (supabase) {
                const { data } = await supabase.auth.getSession();
                token = data?.session?.access_token || token;
                refreshToken = data?.session?.refresh_token || refreshToken;
                userEmail = data?.session?.user?.email || '';
            }
        } catch {}
        const apiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:5000/api'
            : `${window.location.origin}/api`;
        window.postMessage(
            {
                policyguard: 'sync_config',
                payload: { apiBaseUrl, accessToken: token, refreshToken, userEmail },
            },
            window.location.origin
        );
        setTimeout(() => setSyncingExt(false), 2000);
    };

    const loadShieldData = async () => {
        try {
            const [domainsRes, scansRes, reportsRes] = await Promise.all([
                api.get('/security/verified-domains'),
                api.get('/security/scans'),
                api.get('/security/scam-reports'),
            ]);
            setVerifiedDomains(domainsRes.data.domains || []);
            setScans(scansRes.data.scans || []);
            setScamReports(reportsRes.data.reports || []);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to load Browser Shield data');
        } finally {
            setLoading(false);
        }
    };

    const handleCheckUrl = async (e) => {
        e.preventDefault();
        if (!testUrl.trim()) {
            toast.error('Enter a URL or domain to check');
            return;
        }
        setChecking(true);
        try {
            const { data } = await api.post('/security/check-url', {
                url: testUrl.trim(),
                sourceSurface: 'manual',
                contextFlags: contextNote,
                sensitivity,
            });
            setVerdict(data);
            loadShieldData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'URL scan failed');
        } finally {
            setChecking(false);
        }
    };

    const handleSubmitScam = async (e) => {
        e.preventDefault();
        if (reporting) return;
        if (!reportForm.url.trim()) {
            toast.error('Enter a suspicious URL or domain to report');
            return;
        }
        setReporting(true);
        try {
            const { data } = await api.post('/security/scam-reports', reportForm);
            toast.success(data.message || 'Scam report submitted!');
            setReportForm({ url: '', category: 'phishing', description: '' });
            loadShieldData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to submit scam report');
        } finally {
            setReporting(false);
        }
    };

    if (loading) {
        return <div className="loading-spinner"><div className="spinner" /></div>;
    }

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
                <div>
                    <h1>Browser Shield & Threat Network</h1>
                    <p>Chrome Browser + WhatsApp Web + Telegram + Instagram DMs + Gmail/Outlook real-time scam, .apk &amp; Reverse-UPI protection</p>
                </div>
                <a href="/policyguard-extension.zip" download="policyguard-extension.zip" className="btn btn-primary">
                    <Download size={16} /> Download Chrome Extension (.zip)
                </a>
            </div>

            {/* Extension Setup + 1930 Emergency Callout */}
            <div className="grid-2" style={{ marginBottom: 24 }}>
                <div className="card" style={{ padding: 20 }}>
                    <h2 style={{ marginBottom: 10, fontSize: '1.08rem' }}><Globe size={17} /> Install Multi-Surface Chrome Extension (v2.1)</h2>
                    <ol style={{ margin: '0 0 12px 18px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                        <li>Click <strong>Download Chrome Extension (.zip)</strong> above and extract the folder.</li>
                        <li>Open Chrome → visit <code>chrome://extensions</code> and enable <strong>Developer Mode</strong>.</li>
                        <li>Click <strong>Load Unpacked</strong> and select the extracted folder.</li>
                        <li><strong>🚨 THREAT</strong> &amp; <strong>⚠ SUSPICIOUS</strong> badges + click-block modal activate across Websites, WhatsApp Web, Telegram Web, Instagram DMs, Gmail &amp; Outlook (adjust sensitivity or toggle <code>✓ SAFE</code> badges in popup).</li>
                    </ol>
                    <span className="badge badge-success" style={{ marginRight: 8 }}>Works Without Login · Privacy-First · Server-Side VirusTotal</span>
                    {extVersion ? (
                        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span className="badge badge-success">Chrome Extension v{extVersion} Linked &amp; Active</span>
                            <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={handleSyncExtension} disabled={syncingExt}>
                                {syncingExt ? 'Syncing...' : 'Sync Session & Backend API'}
                            </button>
                        </div>
                    ) : (
                        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                            Status: Extension not detected on this browser tab (install or reload extension + refresh this page).
                        </div>
                    )}
                </div>

                <div className="card" style={{ padding: 20, border: '1px solid rgba(220,38,38,0.28)', background: 'rgba(254,242,242,0.65)' }}>
                    <h2 style={{ marginBottom: 10, fontSize: '1.08rem', color: '#b91c1c' }}><PhoneCall size={17} /> Cyber Scam / Reverse-UPI Golden Hour</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
                        Never enter your UPI PIN to <em>receive</em> a claim refund or install <code>.apk</code> files shared on WhatsApp/Gmail (<code>Challan_Update.apk</code>, <code>Policy_KYC.apk</code>).
                    </p>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#991b1b' }}>
                        Dial National Cybercrime Helpline: 1930 · cybercrime.gov.in
                    </div>
                </div>
            </div>

            {/* Live URL Threat Tester + Community Report */}
            <div className="grid-2" style={{ marginBottom: 24 }}>
                <form className="card" style={{ padding: 20 }} onSubmit={handleCheckUrl}>
                    <h2 style={{ marginBottom: 12, fontSize: '1.08rem' }}><Search size={17} /> Test Any Link / Renewal URL</h2>
                    <label htmlFor="shield-test-url" className="form-label" style={{ fontSize: 12 }}>Suspicious or Official URL</label>
                    <input id="shield-test-url" name="testUrl" className="form-input" placeholder="https://example-renewal.xyz/claim.apk" style={{ marginBottom: 8 }}
                        value={testUrl} onChange={(e) => setTestUrl(e.target.value)} />
                    <label htmlFor="shield-context-note" className="form-label" style={{ fontSize: 12 }}>Optional Message Context</label>
                    <input id="shield-context-note" name="contextNote" className="form-input" placeholder="Optional message context (e.g. Enter UPI PIN to receive refund)" style={{ marginBottom: 8 }}
                        value={contextNote} onChange={(e) => setContextNote(e.target.value)} />
                    <label htmlFor="shield-sensitivity" className="form-label" style={{ fontSize: 12 }}>Detection Sensitivity</label>
                    <select id="shield-sensitivity" name="sensitivity" className="form-input" style={{ marginBottom: 12 }} value={sensitivity} onChange={(e) => setSensitivity(e.target.value)}>
                        <option value="high">High (Strict · Threat at 45+)</option>
                        <option value="balanced">Balanced (Default · Threat at 60+)</option>
                        <option value="relaxed">Relaxed (Low Noise · Threat at 80+)</option>
                    </select>
                    <button className="btn btn-primary" type="submit" disabled={checking} style={{ width: '100%' }}>
                        {checking ? 'Scanning Registry + RDAP + VirusTotal...' : 'Run Multi-Tier URL Threat Check'}
                    </button>

                    {verdict && (
                        <div style={{ marginTop: 14, padding: 14, borderRadius: 12, border: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.78)', backdropFilter: 'blur(12px)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <strong>{verdict.domain || verdict.url}</strong>
                                    {verdict.threatCategory && verdict.threatCategory !== 'safe' && (
                                        <span className="badge badge-warning" style={{ textTransform: 'uppercase', fontSize: 10 }}>
                                            {verdict.threatCategory}
                                        </span>
                                    )}
                                </div>
                                <span className={`badge ${verdict.status === 'threat' ? 'badge-danger' : verdict.status === 'suspicious' ? 'badge-warning' : 'badge-success'}`}>
                                    {(verdict.status || 'unknown').toUpperCase()} ({verdict.riskScore ?? 0}/100)
                                </span>
                            </div>
                            <ul style={{ margin: '4px 0 0 18px', fontSize: 12 }}>
                                {(verdict.reasons || []).map((r, i) => <li key={i}>{r}</li>)}
                            </ul>
                            {(verdict.rdapAgeDays !== null && verdict.rdapAgeDays !== undefined) || (verdict.vtStats && (verdict.vtStats.malicious > 0 || verdict.vtStats.totalVendors > 0)) ? (
                                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(15,23,42,0.08)', fontSize: 11.5, color: 'var(--text-secondary)' }}>
                                    {verdict.rdapAgeDays !== null && verdict.rdapAgeDays !== undefined && (
                                        <span style={{ marginRight: 12 }}>Domain Age (RDAP): <strong>{verdict.rdapAgeDays} days</strong></span>
                                    )}
                                    {verdict.vtStats && (verdict.vtStats.malicious > 0 || verdict.vtStats.totalVendors > 0) && (
                                        <span>
                                            VirusTotal: <strong>{verdict.vtStats.malicious || 0} malicious</strong> / {verdict.vtStats.totalVendors || '—'} engines
                                        </span>
                                    )}
                                    {Array.isArray(verdict.vtStats?.flaggedBy) && verdict.vtStats.flaggedBy.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                            {verdict.vtStats.flaggedBy.slice(0, 5).map((v, idx) => (
                                                <span key={idx} className="badge badge-danger" style={{ fontSize: 10 }}>
                                                    {v.vendor}: {v.result || v.category}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    )}
                </form>

                <form className="card" style={{ padding: 20 }} onSubmit={handleSubmitScam}>
                    <h2 style={{ marginBottom: 12, fontSize: '1.08rem' }}><ShieldAlert size={17} /> Report Scam URL to Threat Network</h2>
                    <label htmlFor="shield-report-url" className="form-label" style={{ fontSize: 12 }}>Scam URL or Domain</label>
                    <input id="shield-report-url" name="reportUrl" className="form-input" placeholder="Suspicious URL or domain" style={{ marginBottom: 8 }}
                        value={reportForm.url} onChange={(e) => setReportForm({ ...reportForm, url: e.target.value })} />
                    <label htmlFor="shield-report-category" className="form-label" style={{ fontSize: 12 }}>Scam Category</label>
                    <select id="shield-report-category" name="reportCategory" className="form-input" style={{ marginBottom: 8 }} value={reportForm.category} onChange={(e) => setReportForm({ ...reportForm, category: e.target.value })}>
                        <option value="phishing">Phishing / Fake Portal</option>
                        <option value="apk_malware">WhatsApp / Gmail .APK Malware</option>
                        <option value="upi_scam">Reverse-UPI Refund Scam</option>
                        <option value="fake_renewal">Fake Renewal Notice</option>
                        <option value="impersonation">Agent / IRDAI Impersonation</option>
                    </select>
                    <label htmlFor="shield-report-desc" className="form-label" style={{ fontSize: 12 }}>Incident Description</label>
                    <input id="shield-report-desc" name="reportDescription" className="form-input" placeholder="Short description of how you encountered it" style={{ marginBottom: 12 }}
                        value={reportForm.description} onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })} />
                    <button className="btn btn-danger" type="submit" disabled={reporting} style={{ width: '100%' }}>
                        {reporting ? 'Submitting Report...' : 'Submit Report for Admin Verification'}
                    </button>
                </form>
            </div>

            {/* Verified Domains + Recent Scan Telemetry */}
            <div className="grid-2">
                <div className="card" style={{ padding: 20 }}>
                    <h2 style={{ marginBottom: 12, fontSize: '1.08rem' }}><CheckCircle size={17} /> Verified Official Domains ({verifiedDomains.length})</h2>
                    <div className="table-wrapper" style={{ maxHeight: 280, overflowY: 'auto' }}>
                        <table className="table">
                            <thead><tr><th>Provider</th><th>Domain</th><th>Category</th></tr></thead>
                            <tbody>
                                {verifiedDomains.length > 0 ? verifiedDomains.map((d) => (
                                    <tr key={d.id}>
                                        <td style={{ fontWeight: 600 }}>{d.provider_name}</td>
                                        <td><code>{d.domain}</code></td>
                                        <td><span className="badge badge-success">{d.category}</span></td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No verified domains found yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="card" style={{ padding: 20 }}>
                    <h2 style={{ marginBottom: 12, fontSize: '1.08rem' }}><AlertTriangle size={17} /> Recent Domain Scans &amp; Community Alerts</h2>
                    <div className="table-wrapper" style={{ maxHeight: 280, overflowY: 'auto' }}>
                        <table className="table">
                            <thead><tr><th>Domain</th><th>Surface</th><th>Verdict</th><th>Score</th></tr></thead>
                            <tbody>
                                {scans.length === 0 && scamReports.length === 0 ? (
                                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No scans or community alerts recorded yet.</td></tr>
                                ) : (
                                    <>
                                        {scans.map((s) => (
                                            <tr key={s.id}>
                                                <td><code>{s.domain}</code></td>
                                                <td>{s.source_surface}</td>
                                                <td>
                                                    <span className={`badge ${s.status === 'threat' ? 'badge-danger' : s.status === 'suspicious' ? 'badge-warning' : 'badge-success'}`}>
                                                        {s.status}
                                                    </span>
                                                </td>
                                                <td>{s.risk_score}/100</td>
                                            </tr>
                                        ))}
                                        {scamReports.slice(0, 5).map((r) => (
                                            <tr key={r.id}>
                                                <td><code>{r.domain}</code></td>
                                                <td>{r.category}</td>
                                                <td>
                                                    <span className={`badge ${r.moderation_status === 'verified' ? 'badge-danger' : 'badge-warning'}`}>
                                                        {r.moderation_status === 'pending' ? 'unverified (pending)' : r.moderation_status}
                                                    </span>
                                                </td>
                                                <td>Community</td>
                                            </tr>
                                        ))}
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
