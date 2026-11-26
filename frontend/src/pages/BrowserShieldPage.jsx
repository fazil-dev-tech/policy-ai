import { useState, useEffect } from 'react';
import api from '../services/api';
import {
    ShieldAlert, ShieldCheck, Download, Search, Globe,
    AlertTriangle, CheckCircle, PhoneCall
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function BrowserShieldPage() {
    const [testUrl, setTestUrl] = useState('');
    const [contextNote, setContextNote] = useState('');
    const [checking, setChecking] = useState(false);
    const [verdict, setVerdict] = useState(null);
    const [scans, setScans] = useState([]);
    const [verifiedDomains, setVerifiedDomains] = useState([]);
    const [scamReports, setScamReports] = useState([]);
    const [loading, setLoading] = useState(true);

    const [reportForm, setReportForm] = useState({ url: '', category: 'phishing', description: '' });

    useEffect(() => {
        loadShieldData();
    }, []);

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
        if (!reportForm.url.trim()) {
            toast.error('Enter a suspicious URL or domain to report');
            return;
        }
        try {
            const { data } = await api.post('/security/scam-reports', reportForm);
            toast.success(data.message || 'Scam report submitted!');
            setReportForm({ url: '', category: 'phishing', description: '' });
            loadShieldData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to submit scam report');
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
                    <p>Chrome Browser + WhatsApp Web + Gmail real-time scam, .apk & Reverse-UPI protection</p>
                </div>
                <a href="/policyguard-extension.zip" download="policyguard-extension.zip" className="btn btn-primary">
                    <Download size={16} /> Download Chrome Extension (.zip)
                </a>
            </div>

            {/* Extension Setup + 1930 Emergency Callout */}
            <div className="grid-2" style={{ marginBottom: 24 }}>
                <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ marginBottom: 10 }}><Globe size={17} /> Install 3-Surface Chrome Extension</h3>
                    <ol style={{ margin: '0 0 12px 18px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                        <li>Click <strong>Download Chrome Extension (.zip)</strong> above and extract the folder.</li>
                        <li>Open Chrome → visit <code>chrome://extensions</code> and enable <strong>Developer Mode</strong>.</li>
                        <li>Click <strong>Load Unpacked</strong> and select the extracted folder.</li>
                        <li><strong>🚨 THREAT</strong> & <strong>⚠ SUSPICIOUS</strong> badges activate immediately across Websites, WhatsApp Web & Gmail (toggle green <code>✓ SAFE</code> badges in popup).</li>
                    </ol>
                    <span className="badge badge-success">Works Without Login · Privacy-First (Zero Email Body Upload)</span>
                </div>

                <div className="card" style={{ padding: 20, border: '1px solid rgba(220,38,38,0.28)', background: 'rgba(254,242,242,0.65)' }}>
                    <h3 style={{ marginBottom: 10, color: 'var(--danger)' }}><PhoneCall size={17} /> Cyber Scam / Reverse-UPI Golden Hour</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
                        Never enter your UPI PIN to <em>receive</em> a claim refund or install <code>.apk</code> files shared on WhatsApp/Gmail (<code>Challan_Update.apk</code>, <code>Policy_KYC.apk</code>).
                    </p>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--danger)' }}>
                        Dial National Cybercrime Helpline: 1930 · cybercrime.gov.in
                    </div>
                </div>
            </div>

            {/* Live URL Threat Tester + Community Report */}
            <div className="grid-2" style={{ marginBottom: 24 }}>
                <form className="card" style={{ padding: 20 }} onSubmit={handleCheckUrl}>
                    <h3 style={{ marginBottom: 12 }}><Search size={17} /> Test Any Link / Renewal URL</h3>
                    <input className="form-input" placeholder="https://example-renewal.xyz/claim.apk" style={{ marginBottom: 8 }}
                        value={testUrl} onChange={(e) => setTestUrl(e.target.value)} />
                    <input className="form-input" placeholder="Optional message context (e.g. Enter UPI PIN to receive refund)" style={{ marginBottom: 12 }}
                        value={contextNote} onChange={(e) => setContextNote(e.target.value)} />
                    <button className="btn btn-primary" type="submit" disabled={checking} style={{ width: '100%' }}>
                        {checking ? 'Scanning Registry + RDAP + VirusTotal...' : 'Run Multi-Tier URL Threat Check'}
                    </button>

                    {verdict && (
                        <div style={{ marginTop: 14, padding: 14, borderRadius: 12, border: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.78)', backdropFilter: 'blur(12px)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <strong>{verdict.domain || verdict.url}</strong>
                                <span className={`badge ${verdict.status === 'threat' ? 'badge-danger' : verdict.status === 'suspicious' ? 'badge-warning' : 'badge-success'}`}>
                                    {(verdict.status || 'unknown').toUpperCase()} ({verdict.riskScore ?? 0}/100)
                                </span>
                            </div>
                            <ul style={{ margin: '4px 0 0 18px', fontSize: 12 }}>
                                {(verdict.reasons || []).map((r, i) => <li key={i}>{r}</li>)}
                            </ul>
                        </div>
                    )}
                </form>

                <form className="card" style={{ padding: 20 }} onSubmit={handleSubmitScam}>
                    <h3 style={{ marginBottom: 12 }}><ShieldAlert size={17} /> Report Scam URL to Threat Network</h3>
                    <input className="form-input" placeholder="Suspicious URL or domain" style={{ marginBottom: 8 }}
                        value={reportForm.url} onChange={(e) => setReportForm({ ...reportForm, url: e.target.value })} />
                    <select className="form-input" style={{ marginBottom: 8 }} value={reportForm.category} onChange={(e) => setReportForm({ ...reportForm, category: e.target.value })}>
                        <option value="phishing">Phishing / Fake Portal</option>
                        <option value="apk_malware">WhatsApp / Gmail .APK Malware</option>
                        <option value="upi_scam">Reverse-UPI Refund Scam</option>
                        <option value="fake_renewal">Fake Renewal Notice</option>
                        <option value="impersonation">Agent / IRDAI Impersonation</option>
                    </select>
                    <input className="form-input" placeholder="Short description of how you encountered it" style={{ marginBottom: 12 }}
                        value={reportForm.description} onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })} />
                    <button className="btn btn-danger" type="submit" style={{ width: '100%' }}>Submit Report for Admin Verification</button>
                </form>
            </div>

            {/* Verified Domains + Recent Scan Telemetry */}
            <div className="grid-2">
                <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ marginBottom: 12 }}><CheckCircle size={17} /> Verified Official Domains ({verifiedDomains.length})</h3>
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
                                    <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No verified domains found yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ marginBottom: 12 }}><AlertTriangle size={17} /> Recent Domain Scans & Community Alerts</h3>
                    <div className="table-wrapper" style={{ maxHeight: 280, overflowY: 'auto' }}>
                        <table className="table">
                            <thead><tr><th>Domain</th><th>Surface</th><th>Verdict</th><th>Score</th></tr></thead>
                            <tbody>
                                {scans.length === 0 && scamReports.length === 0 ? (
                                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No scans or community alerts recorded yet.</td></tr>
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
                                                <td><span className={`badge ${r.moderation_status === 'verified' ? 'badge-danger' : 'badge-warning'}`}>{r.moderation_status}</span></td>
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
