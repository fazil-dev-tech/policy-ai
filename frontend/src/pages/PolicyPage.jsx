import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { resolveAssetUrl, uploadDirectToSignedStorage } from '../services/api';
import {
    Upload, FileText, Eye, X, AlertTriangle, CheckCircle, Shield,
    ClipboardList, FileCheck, Zap, Bot, AlertCircle, Search, Download,
    Activity, GitCompare, UserCheck
} from 'lucide-react';
import {
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
    ResponsiveContainer, Tooltip
} from 'recharts';
import toast from 'react-hot-toast';

function ScoreRing({ score }) {
    const r = 36, circ = 2 * Math.PI * r;
    const dash = ((score || 0) / 100) * circ;
    const color = score >= 70 ? '#059669' : score >= 40 ? '#d97706' : '#dc2626';
    return (
        <svg width="90" height="90" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="45" cy="45" r={r} fill="none" stroke="rgba(236,72,153,0.12)" strokeWidth="7" />
            <circle cx="45" cy="45" r={r} fill="none" stroke={color} strokeWidth="7"
                strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
            <text x="45" y="45" textAnchor="middle" dominantBaseline="central"
                style={{ transform: 'rotate(90deg)', transformOrigin: '45px 45px', fontSize: 15, fontWeight: 700, fill: color }}>
                {score ?? '--'}%
            </text>
        </svg>
    );
}

function AiValue({ value }) {
    if (!value || value === '') return <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not available</span>;
    if (Array.isArray(value)) {
        return (
            <ul className="ai-list">
                {value.map((item, i) => (
                    <li key={i}>
                        {typeof item === 'object' ? (
                            <div className="ai-object">
                                {Object.entries(item).map(([k, v]) => (
                                    <div key={k}><strong>{k}:</strong> {String(v)}</div>
                                ))}
                            </div>
                        ) : item}
                    </li>
                ))}
            </ul>
        );
    }
    if (typeof value === 'object') {
        return (
            <div className="ai-object-block">
                {Object.entries(value).map(([k, v]) => (
                    <div key={k} className="ai-object-row">
                        <span className="ai-object-key">{k}</span>
                        <span className="ai-object-val">{Array.isArray(v) ? v.join(', ') : String(v)}</span>
                    </div>
                ))}
            </div>
        );
    }
    return <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>{String(value)}</p>;
}

const POLICY_TYPE_COLORS = {
    health: '#059669', life: '#8b5cf6', auto: '#0284c7', home: '#d97706',
    travel: '#06b6d4', business: '#ec4899', other: '#64748b',
};

const TABS = [
    { key: 'simpleSummary', label: 'Summary', icon: FileText },
    { key: 'cisHealth', label: 'CIS & Health Score', icon: Activity },
    { key: 'coverage', label: 'Coverage', icon: CheckCircle },
    { key: 'exclusions', label: 'Exclusions', icon: X },
    { key: 'clauses', label: 'Clause Citations', icon: Search },
    { key: 'claimProcedure', label: 'Claims', icon: ClipboardList },
    { key: 'requiredDocuments', label: 'Documents', icon: FileCheck },
    { key: 'fraudIndicators', label: 'Fraud Score', icon: AlertTriangle },
    { key: 'renewalAgent', label: 'Renewal & Agent', icon: GitCompare },
];

export default function PolicyPage() {
    const navigate = useNavigate();
    const [policies, setPolicies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedPolicy, setSelectedPolicy] = useState(null);
    const [policyInsights, setPolicyInsights] = useState(null);
    const [clauseQuery, setClauseQuery] = useState('');
    const [activeTab, setActiveTab] = useState('simpleSummary');
    const [dragOver, setDragOver] = useState(false);
    const [uploadStep, setUploadStep] = useState(0);
    const [policyToDelete, setPolicyToDelete] = useState(null);

    // Renewal Diff & Agent Mis-selling state
    const [renewalLoading, setRenewalLoading] = useState(false);
    const [agentForm, setAgentForm] = useState({ agentName: '', intermediaryCode: '', zeroWaitingPeriod: false, zeroDepPromised: false, noRoomCapPromised: false, promisedSumInsured: '' });

    const fileRef = useRef(null);
    const renewalRef = useRef(null);

    useEffect(() => { loadPolicies(); }, []);

    const loadPolicies = async () => {
        try {
            const { data } = await api.get('/policy');
            setPolicies(data.policies || []);
        } catch {
            toast.error('Failed to load policies');
        } finally {
            setLoading(false);
        }
    };

    const openPolicyModal = async (policy) => {
        setSelectedPolicy(policy);
        setActiveTab('simpleSummary');
        setClauseQuery('');
        setPolicyInsights(null);
        try {
            const { data } = await api.get(`/policy/${policy._id || policy.id}/insights`);
            setPolicyInsights(data);
        } catch {}
    };

    const searchClauses = async () => {
        if (!selectedPolicy) return;
        try {
            const { data } = await api.get(`/policy/${selectedPolicy._id}/insights?q=${encodeURIComponent(clauseQuery)}`);
            setPolicyInsights(data);
        } catch {
            toast.error('Clause search failed');
        }
    };

    const handleUpload = async (file) => {
        if (!file) return;
        const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.type)) return toast.error('Upload a PDF or policy/card photo (JPG, PNG, WEBP)');
        if (file.size > 10 * 1024 * 1024) return toast.error('File size must be under 10MB');

        setUploading(true);
        setUploadStep(1);
        try {
            let res;
            // Use signed direct Supabase upload automatically for >3.8 MB files (Vercel safe!)
            if (file.size > 3.8 * 1024 * 1024) {
                setUploadStep(2);
                const uploaded = await uploadDirectToSignedStorage(file, 'policies');
                res = await api.post('/policy/upload', {
                    storagePath: uploaded.storagePath,
                    fileName: uploaded.fileName,
                    mimeType: uploaded.mimeType,
                });
            } else {
                const formData = new FormData();
                formData.append('file', file);
                setUploadStep(2);
                res = await api.post('/policy/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            }
            setUploadStep(3);
            toast.success('Policy uploaded & indexed!');
            setPolicies([res.data.policy, ...policies]);
            openPolicyModal(res.data.policy);
        } catch (err) {
            toast.error(err.response?.data?.error || err.message || 'Upload failed');
        } finally {
            setUploading(false);
            setUploadStep(0);
        }
    };

    const handleRenewalCompare = async (file) => {
        if (!file || !selectedPolicy) return;
        setRenewalLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const { data } = await api.post(`/policy/${selectedPolicy._id}/renewal-diff`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setPolicyInsights((prev) => ({ ...(prev || {}), renewalDiff: data.renewalDiff }));
            toast.success('Renewal diff completed!');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Renewal comparison failed');
        } finally {
            setRenewalLoading(false);
        }
    };

    const handleAgentAudit = async (e) => {
        e.preventDefault();
        if (!selectedPolicy) return;
        try {
            const { data } = await api.post(`/policy/${selectedPolicy._id}/agent-audit`, {
                agentName: agentForm.agentName,
                intermediaryCode: agentForm.intermediaryCode,
                promisedTerms: {
                    zeroWaitingPeriod: agentForm.zeroWaitingPeriod,
                    zeroDepPromised: agentForm.zeroDepPromised,
                    noRoomCapPromised: agentForm.noRoomCapPromised,
                    promisedSumInsured: Number(agentForm.promisedSumInsured) || 0,
                },
            });
            setPolicyInsights((prev) => ({
                ...(prev || {}),
                agentFollowups: [data.followup, ...(prev?.agentFollowups || [])],
            }));
            toast.success(data.audit.status === 'mis_selling_risk' ? 'Mis-selling discrepancy flagged!' : 'Promised terms match policy!');
        } catch {
            toast.error('Failed to audit agent promise');
        }
    };

    const downloadEmergencyCard = async (policyId) => {
        try {
            const resp = await api.get(`/policy/${policyId}/emergency-card.pdf`, { responseType: 'blob' });
            const url = URL.createObjectURL(resp.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `PolicyGuard_Emergency_Card_${policyId.slice(0, 8)}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Failed to generate Emergency Card PDF');
        }
    };

    const executeDelete = async (id) => {
        try {
            await api.delete(`/policy/${id}`);
            setPolicies(policies.filter((p) => p._id !== id));
            toast.success('Policy deleted successfully');
            if (selectedPolicy?._id === id) setSelectedPolicy(null);
        } catch {
            toast.error('Failed to delete policy');
        } finally {
            setPolicyToDelete(null);
        }
    };

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

    const healthEval = policyInsights?.healthEvaluation || selectedPolicy?.healthEvaluation;
    const cisCard = policyInsights?.cisCard || selectedPolicy?.cisSummary;

    return (
        <div>
            <div className="page-header">
                <h1>My Policies</h1>
                <p>Table-aware PDF parsing, IRDAI CIS Cards, 60-Month Moratorium tracking, and cited clauses</p>
            </div>

            {/* Upload Zone */}
            <div
                className={`upload-zone ${dragOver ? 'dragover' : ''} ${uploading ? 'uploading' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files[0]); }}
                onClick={() => !uploading && fileRef.current?.click()}
                style={{ marginBottom: 32 }}
            >
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => handleUpload(e.target.files[0])} style={{ display: 'none' }} />
                {uploading ? (
                    <div className="upload-progress-container">
                        <h3 className="gradient-text">Parsing Tables & Indexing Clauses...</h3>
                        <div className="upload-steps">
                            {['Parse Pages', 'Extract Terms', 'Index & Score'].map((s, i) => (
                                <div key={s} className={`upload-step ${uploadStep > i ? 'done' : uploadStep === i ? 'active' : ''}`}>
                                    <div className="upload-step-dot" />
                                    <span>{s}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="upload-icon"><Upload size={48} /></div>
                        <h3>Drop your Policy PDF or E-Card Photo here</h3>
                        <p>Supports digital PDFs, scanned docs & card photos — max 10MB</p>
                        <div className="upload-formats">
                            {['Health', 'Life', 'Auto', 'Home', 'Travel', 'Business', 'E-Card Photo'].map((t) => (
                                <span key={t} className="upload-format-tag">{t}</span>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Policy Grid */}
            {policies.length > 0 ? (
                <div className="policy-list">
                    {policies.map((policy) => {
                        const typeColor = POLICY_TYPE_COLORS[policy.policyType] || '#64748b';
                        const expired = policy.endDate && new Date(policy.endDate) < new Date();
                        const daysLeft = policy.endDate
                            ? Math.ceil((new Date(policy.endDate) - new Date()) / (1000 * 60 * 60 * 24))
                            : null;
                        return (
                            <div key={policy._id} className="policy-card" style={{ '--type-color': typeColor }}
                                onClick={() => openPolicyModal(policy)}>
                                <div className="policy-card-top">
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                        <span className="badge" style={{ background: typeColor + '22', color: typeColor, border: `1px solid ${typeColor}44` }}>
                                            {policy.policyType}
                                        </span>
                                        {policy.healthScore > 0 && (
                                            <span className="badge badge-success">Health {policy.healthScore}/100</span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                                        <button className="btn btn-secondary btn-sm" onClick={() => openPolicyModal(policy)}>
                                            <Eye size={13} /> View
                                        </button>
                                        <button className="btn btn-danger btn-sm" onClick={() => setPolicyToDelete(policy)}>
                                            <Bot size={13} /> Delete
                                        </button>
                                    </div>
                                </div>
                                <h3 className="policy-provider">{policy.providerName}</h3>
                                <div className="policy-number">#{policy.policyNumber}</div>
                                <div className="policy-card-mid">
                                    <div className="policy-meta-row">
                                        <span className="label">Sum Insured</span>
                                        <span className="value">₹{policy.coverageAmount?.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="policy-meta-row">
                                        <span className="label">Status</span>
                                        <span className={`badge badge-${policy.status === 'active' ? 'success' : 'warning'}`}>{policy.status}</span>
                                    </div>
                                    {daysLeft !== null && (
                                        <div className="policy-meta-row">
                                            <span className="label">Expires</span>
                                            <span className={`value ${expired ? 'text-danger' : daysLeft < 30 ? 'text-warning' : ''}`}>
                                                {expired ? 'Expired' : `${daysLeft}d left`}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="policy-card-bottom">
                                    <div className="score-bar">
                                        <div className="score-bar-fill" style={{ width: `${policy.verificationScore}%`, background: `linear-gradient(90deg, ${typeColor}, ${typeColor}99)` }} />
                                    </div>
                                    <span className="score-label">Verification: {policy.verificationScore}%</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="empty-state">
                    <FileText size={64} />
                    <h3>No Policies Uploaded</h3>
                    <p>Upload your first insurance policy PDF to get started with AI analysis</p>
                </div>
            )}

            {/* Policy Detail Modal */}
            {selectedPolicy && (
                <div className="modal-overlay" onClick={() => setSelectedPolicy(null)}>
                    <div className="modal policy-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 960, width: '95%' }}>
                        <div className="modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <ScoreRing score={selectedPolicy.verificationScore} />
                                <div>
                                    <h2 style={{ fontSize: 20, fontWeight: 700 }}>{selectedPolicy.providerName}</h2>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                                        <span className="badge badge-purple">{selectedPolicy.policyType}</span>
                                        <span className={`badge badge-${selectedPolicy.status === 'active' ? 'success' : 'warning'}`}>
                                            {selectedPolicy.status}
                                        </span>
                                        {selectedPolicy.aiSummary?.partialDocument && (
                                            <span className="badge badge-warning">Partial / Scanned Doc</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button className="modal-close" onClick={() => setSelectedPolicy(null)}><X size={18} /></button>
                        </div>

                        <div className="policy-meta-grid">
                            {[
                                ['Policy #', selectedPolicy.policyNumber],
                                ['Sum Insured', `₹${selectedPolicy.coverageAmount?.toLocaleString('en-IN')}`],
                                ['Start', selectedPolicy.startDate ? new Date(selectedPolicy.startDate).toLocaleDateString('en-IN') : '—'],
                                ['End', selectedPolicy.endDate ? new Date(selectedPolicy.endDate).toLocaleDateString('en-IN') : '—'],
                            ].map(([label, value]) => (
                                <div key={label} className="policy-meta-cell">
                                    <div className="meta-label">{label}</div>
                                    <div className="meta-value">{value}</div>
                                </div>
                            ))}
                        </div>

                        <div className="ai-analysis-section">
                            <div className="ai-section-header">
                                <Zap size={16} style={{ color: 'var(--accent-primary)' }} />
                                <span>PolicyGuard Intelligence Tabs</span>
                            </div>
                            <div className="ai-tabs" style={{ flexWrap: 'wrap' }}>
                                {TABS.map(({ key, label, icon: Icon }) => (
                                    <button key={key} className={`ai-tab ${activeTab === key ? 'active' : ''}`} onClick={() => setActiveTab(key)}>
                                        <Icon size={14} /> {label}
                                    </button>
                                ))}
                            </div>

                            <div className="ai-tab-content">
                                {activeTab === 'cisHealth' && healthEval && (
                                    <div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 16 }}>
                                            <div style={{ background: 'var(--bg-secondary)', padding: 14, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                                                <h4 style={{ marginBottom: 8 }}>IRDAI Customer Information Sheet (CIS)</h4>
                                                <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                                                    <div><strong>Room Rent Limit:</strong> {cisCard?.roomRentLimit}</div>
                                                    <div><strong>Co-Pay / Deductible:</strong> {cisCard?.coPay} / {cisCard?.deductible}</div>
                                                    <div><strong>Waiting Periods:</strong> {cisCard?.initialWaitingPeriod} · {cisCard?.pedWaitingPeriod}</div>
                                                    <div><strong>Cashless SLA:</strong> {cisCard?.irdaiDischargeSla}</div>
                                                    <div><strong>24x7 Helpline:</strong> {cisCard?.helplineNumber}</div>
                                                </div>
                                                <div style={{ marginTop: 10, padding: 8, borderRadius: 8, background: healthEval.moratorium?.active ? 'rgba(5,150,105,0.12)' : 'rgba(217,119,6,0.1)', fontSize: 12 }}>
                                                    <strong>60-Month Moratorium:</strong> {healthEval.moratorium?.note}
                                                </div>
                                            </div>
                                            <div style={{ height: 220 }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <RadarChart data={healthEval.radar || []}>
                                                        <PolarGrid stroke="rgba(236,72,153,0.2)" />
                                                        <PolarAngleAxis dataKey="axis" tick={{ fill: '#334155', fontSize: 11 }} />
                                                        <PolarRadiusAxis domain={[0, 100]} tick={false} />
                                                        <Radar name="Policy Score" dataKey="score" stroke="#ec4899" fill="#ec4899" fillOpacity={0.28} />
                                                        <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #f472b6', borderRadius: 8, color: '#0f172a' }} />
                                                    </RadarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                        {healthEval.gaps?.length > 0 && (
                                            <div style={{ background: 'rgba(217,119,6,0.08)', borderLeft: '4px solid var(--warning)', padding: 12, borderRadius: 8, marginBottom: 14 }}>
                                                <strong>Coverage Gap Finder ({healthEval.healthScore}/100):</strong>
                                                <ul style={{ margin: '6px 0 0 18px', fontSize: 13 }}>
                                                    {healthEval.gaps.map((g, gi) => <li key={gi}>{g}</li>)}
                                                </ul>
                                            </div>
                                        )}

                                        {(selectedPolicy.structuredTerms?.insuredMembers || []).length > 0 && (
                                            <div style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: 10, padding: 12 }}>
                                                <strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Insured Members & Declared PEDs</strong>
                                                <div className="table-wrapper">
                                                    <table className="table">
                                                        <thead><tr><th>Member</th><th>Relation</th><th>DOB</th><th>Declared PED</th></tr></thead>
                                                        <tbody>
                                                            {selectedPolicy.structuredTerms.insuredMembers.map((rawMember, mi) => {
                                                                const m = typeof rawMember === 'string'
                                                                    ? { name: rawMember, relationship: 'Insured', dob: '—', ped: 'Refer Schedule' }
                                                                    : rawMember;
                                                                return (
                                                                    <tr key={mi}>
                                                                        <td style={{ fontWeight: 600 }}>{m.name}</td>
                                                                        <td>{m.relationship || 'Insured'}</td>
                                                                        <td>{m.dob || '—'}</td>
                                                                        <td style={{ color: /no ped/i.test(m.ped || '') ? 'var(--success)' : 'var(--warning)' }}>{m.ped || 'None'}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'clauses' && (
                                    <div>
                                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                            <input className="form-input" placeholder="Search indexed PDF clauses (e.g. room rent, cataract, 24 hours, co-pay)..."
                                                value={clauseQuery} onChange={(e) => setClauseQuery(e.target.value)} />
                                            <button className="btn btn-primary" onClick={searchClauses}><Search size={15} /> Search</button>
                                        </div>
                                        {(policyInsights?.clauses || []).length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                {policyInsights.clauses.map((c) => (
                                                    <div key={c.id} style={{ padding: 12, borderRadius: 10, border: '1px solid var(--border-color)', background: '#fff' }}>
                                                        <span className="badge badge-purple" style={{ marginBottom: 6 }}>Page {c.page_number} · {c.section_title}</span>
                                                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>{c.clause_text}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p style={{ color: 'var(--text-muted)' }}>No indexed clauses match that keyword yet.</p>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'renewalAgent' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                                        <div>
                                            <h4 style={{ marginBottom: 8 }}><GitCompare size={15} /> Renewal PDF Diff Checker</h4>
                                            <input ref={renewalRef} type="file" accept=".pdf" onChange={(e) => handleRenewalCompare(e.target.files[0])} style={{ display: 'none' }} />
                                            <button className="btn btn-secondary btn-sm" onClick={() => renewalRef.current?.click()} disabled={renewalLoading}>
                                                {renewalLoading ? 'Comparing...' : 'Upload Renewal PDF to Compare'}
                                            </button>
                                            {(policyInsights?.renewalDiff?.diffs || []).map((d, di) => (
                                                <div key={di} style={{ marginTop: 10, padding: 10, borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12 }}>
                                                    <strong>{d.field}</strong> ({d.severity})<br />
                                                    Old: {d.oldValue} → <strong>New: {d.newValue}</strong>
                                                </div>
                                            ))}
                                        </div>

                                        <form onSubmit={handleAgentAudit}>
                                            <h4 style={{ marginBottom: 8 }}><UserCheck size={15} /> Agent Mis-Selling Audit (30d Free-Look)</h4>
                                            <input className="form-input" placeholder="Agent / Intermediary Name" style={{ marginBottom: 6 }}
                                                value={agentForm.agentName} onChange={(e) => setAgentForm({ ...agentForm, agentName: e.target.value })} />
                                            <input className="form-input" placeholder="Promised Cover (₹)" type="number" style={{ marginBottom: 6 }}
                                                value={agentForm.promisedSumInsured} onChange={(e) => setAgentForm({ ...agentForm, promisedSumInsured: e.target.value })} />
                                            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
                                                <input type="checkbox" checked={agentForm.zeroWaitingPeriod} onChange={(e) => setAgentForm({ ...agentForm, zeroWaitingPeriod: e.target.checked })} /> Promised Zero Waiting Period
                                            </label>
                                            <label style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
                                                <input type="checkbox" checked={agentForm.noRoomCapPromised} onChange={(e) => setAgentForm({ ...agentForm, noRoomCapPromised: e.target.checked })} /> Promised Single Room / No Cap
                                            </label>
                                            <button className="btn btn-primary btn-sm" type="submit">Audit vs Actual Policy</button>
                                            {(policyInsights?.agentFollowups || []).slice(0, 2).map((f) => (
                                                <div key={f.id} style={{ marginTop: 8, fontSize: 12, padding: 8, borderRadius: 8, background: f.status === 'mis_selling_risk' ? 'rgba(220,38,38,0.08)' : 'rgba(5,150,105,0.08)' }}>
                                                    <strong>{f.status}</strong> — {(f.discrepancy_report || []).map((d) => d.actual).join('; ') || 'No mismatch detected'}
                                                </div>
                                            ))}
                                        </form>
                                    </div>
                                )}

                                {!['cisHealth', 'clauses', 'renewalAgent'].includes(activeTab) && (
                                    <AiValue value={selectedPolicy.aiSummary?.[activeTab]} />
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
                            <a href={resolveAssetUrl(selectedPolicy.pdfUrl)} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ flex: 1, textAlign: 'center' }}>
                                <FileText size={15} /> View Source File
                            </a>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate(`/claims?policyId=${selectedPolicy._id}`)}>
                                Estimate / File Claim
                            </button>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate(`/terminal?policyId=${selectedPolicy._id}`)}>
                                Ask Parinidhi AI
                            </button>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => downloadEmergencyCard(selectedPolicy._id)}>
                                <Download size={15} /> Emergency Card PDF
                            </button>
                            <button className="btn btn-danger" onClick={() => { setPolicyToDelete(selectedPolicy); setSelectedPolicy(null); }}>
                                <Bot size={15} /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            {policyToDelete && (
                <div className="modal-overlay" onClick={() => setPolicyToDelete(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, textAlign: 'center' }}>
                        <div style={{ padding: 24, background: 'var(--bg-glass)' }}>
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <AlertCircle size={32} />
                            </div>
                            <h2 style={{ marginBottom: 8 }}>Delete Policy?</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>
                                Delete <strong>{policyToDelete.providerName}</strong> ({policyToDelete.policyNumber})?
                            </p>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <button className="btn btn-secondary" onClick={() => setPolicyToDelete(null)} style={{ flex: 1 }}>Cancel</button>
                                <button className="btn btn-danger" onClick={() => executeDelete(policyToDelete._id)} style={{ flex: 1 }}>Confirm Delete</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
