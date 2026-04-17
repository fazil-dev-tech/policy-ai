import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import {
    Upload, FileText, Trash2, Eye, X, AlertTriangle,
    CheckCircle, Shield, ClipboardList, FileCheck, Zap, Bot,
    AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Circular Score Ring ────────────────────────────────────────────────────
function ScoreRing({ score }) {
    const r = 36, circ = 2 * Math.PI * r;
    const dash = ((score || 0) / 100) * circ;
    const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';
    return (
        <svg width="90" height="90" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="45" cy="45" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
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

// ─── Render AI value (string, array, object) ─────────────────────────────────
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
    health: '#10b981', life: '#8b5cf6', auto: '#3b82f6', home: '#f59e0b',
    travel: '#06b6d4', business: '#ec4899', other: '#64748b',
};

const TABS = [
    { key: 'simpleSummary', label: 'Summary', icon: FileText },
    { key: 'coverage', label: 'Coverage', icon: CheckCircle },
    { key: 'exclusions', label: 'Exclusions', icon: X },
    { key: 'claimProcedure', label: 'Claims', icon: ClipboardList },
    { key: 'requiredDocuments', label: 'Documents', icon: FileCheck },
    { key: 'fraudIndicators', label: 'Fraud Score', icon: AlertTriangle },
];

export default function PolicyPage() {
    const [policies, setPolicies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedPolicy, setSelectedPolicy] = useState(null);
    const [activeTab, setActiveTab] = useState('simpleSummary');
    const [dragOver, setDragOver] = useState(false);
    const [uploadStep, setUploadStep] = useState(0);
    const [policyToDelete, setPolicyToDelete] = useState(null);
    const fileRef = useRef(null);

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

    const handleUpload = async (file) => {
        if (!file) return;
        if (file.type !== 'application/pdf') return toast.error('Only PDF files are allowed');
        if (file.size > 10 * 1024 * 1024) return toast.error('File size must be under 10MB');

        setUploading(true);
        setUploadStep(1);
        const formData = new FormData();
        formData.append('file', file);

        try {
            setUploadStep(2);
            const { data } = await api.post('/policy/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setUploadStep(3);
            await new Promise(r => setTimeout(r, 600));
            toast.success('Policy uploaded and analyzed!');
            setPolicies([data.policy, ...policies]);
            setSelectedPolicy(data.policy);
            setActiveTab('simpleSummary');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Upload failed');
        } finally {
            setUploading(false);
            setUploadStep(0);
        }
    };

    const executeDelete = async (id) => {
        try {
            await api.delete(`/policy/${id}`);
            setPolicies(policies.filter(p => p._id !== id));
            toast.success('Policy deleted successfully');
            if (selectedPolicy?._id === id) setSelectedPolicy(null);
        } catch {
            toast.error('Failed to delete policy');
        } finally {
            setPolicyToDelete(null);
        }
    };

    const UPLOAD_STEPS = ['', 'Parsing PDF...', 'AI Analysing...', 'Done ✓'];

    if (loading) return (
        <div className="loading-spinner"><div className="spinner" /></div>
    );

    return (
        <div>
            <div className="page-header">
                <h1>My Policies</h1>
                <p>Upload and manage your insurance policies with AI-powered analysis</p>
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
                <input ref={fileRef} type="file" accept=".pdf"
                    onChange={(e) => handleUpload(e.target.files[0])} style={{ display: 'none' }} />
                {uploading ? (
                    <div className="upload-progress-container">
                        <div className="upload-progress-ring">
                            <svg width="80" height="80"><circle cx="40" cy="40" r="32" fill="none" stroke="rgba(139,92,246,0.2)" strokeWidth="6" /><circle cx="40" cy="40" r="32" fill="none" stroke="url(#pg)" strokeWidth="6" strokeDasharray="60 140" strokeLinecap="round"><animateTransform attributeName="transform" type="rotate" from="0 40 40" to="360 40 40" dur="1s" repeatCount="indefinite" /></circle><defs><linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#3b82f6" /></linearGradient></defs></svg>
                        </div>
                        <h3 className="gradient-text">Analyzing with AI...</h3>
                        <div className="upload-steps">
                            {['Parse PDF', 'Extract Text', 'AI Analysis', 'Save'].map((s, i) => (
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
                        <h3>Drop your policy PDF here</h3>
                        <p>or click to browse — PDF only, max 10MB</p>
                        <div className="upload-formats">
                            {['Health', 'Life', 'Auto', 'Home', 'Travel', 'Business'].map(t => (
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
                                onClick={() => { setSelectedPolicy(policy); setActiveTab('simpleSummary'); }}>
                                <div className="policy-card-top">
                                    <span className="badge" style={{ background: typeColor + '22', color: typeColor, border: `1px solid ${typeColor}44` }}>
                                        {policy.policyType}
                                    </span>
                                    <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                                        <button className="btn btn-secondary btn-sm"
                                            onClick={() => { setSelectedPolicy(policy); setActiveTab('simpleSummary'); }}>
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
                                        <span className="label">Coverage</span>
                                        <span className="value">₹{policy.coverageAmount?.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="policy-meta-row">
                                        <span className="label">Status</span>
                                        <span className={`badge badge-${policy.status === 'active' ? 'success' : 'warning'}`}>
                                            {policy.status}
                                        </span>
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
                                        <div className="score-bar-fill"
                                            style={{ width: `${policy.verificationScore}%`, background: `linear-gradient(90deg, ${typeColor}, ${typeColor}99)` }} />
                                    </div>
                                    <span className="score-label">Verification: {policy.verificationScore}%</span>
                                </div>
                                <div className="policy-card-glow" style={{ '--type-color': typeColor }} />
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
                    <div className="modal policy-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <ScoreRing score={selectedPolicy.verificationScore} />
                                <div>
                                    <h2 style={{ fontSize: 20, fontWeight: 700 }}>{selectedPolicy.providerName}</h2>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                                        <span className="badge badge-purple">{selectedPolicy.policyType}</span>
                                        <span className={`badge badge-${selectedPolicy.status === 'active' ? 'success' : 'warning'}`}>
                                            {selectedPolicy.status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button className="modal-close" onClick={() => setSelectedPolicy(null)}><X size={18} /></button>
                        </div>

                        {/* Policy Meta */}
                        <div className="policy-meta-grid">
                            {[
                                ['Policy #', selectedPolicy.policyNumber],
                                ['Coverage', `₹${selectedPolicy.coverageAmount?.toLocaleString('en-IN')}`],
                                ['Start', selectedPolicy.startDate ? new Date(selectedPolicy.startDate).toLocaleDateString('en-IN') : '—'],
                                ['End', selectedPolicy.endDate ? new Date(selectedPolicy.endDate).toLocaleDateString('en-IN') : '—'],
                            ].map(([label, value]) => (
                                <div key={label} className="policy-meta-cell">
                                    <div className="meta-label">{label}</div>
                                    <div className="meta-value">{value}</div>
                                </div>
                            ))}
                        </div>

                        {/* AI Analysis Tabs */}
                        {selectedPolicy.aiSummary && (
                            <div className="ai-analysis-section">
                                <div className="ai-section-header">
                                    <Zap size={16} style={{ color: 'var(--accent-primary)' }} />
                                    <span>AI Analysis</span>
                                </div>
                                <div className="ai-tabs">
                                    {TABS.map(({ key, label, icon: Icon }) => (
                                        <button
                                            key={key}
                                            className={`ai-tab ${activeTab === key ? 'active' : ''}`}
                                            onClick={() => setActiveTab(key)}
                                        >
                                            <Icon size={14} />
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                <div className="ai-tab-content">
                                    <AiValue value={selectedPolicy.aiSummary[activeTab]} />
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                            <a href={selectedPolicy.pdfUrl} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ flex: 1, textAlign: 'center' }}>
                                <FileText size={15} /> View PDF
                            </a>
                            <button className="btn btn-danger" onClick={() => { setPolicyToDelete(selectedPolicy); setSelectedPolicy(null); }}>
                                <Bot size={15} /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {policyToDelete && (
                <div className="modal-overlay" onClick={() => setPolicyToDelete(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, textAlign: 'center' }}>
                        <div style={{ padding: '24px', background: 'var(--bg-glass)' }}>
                            <div style={{
                                width: 64, height: 64, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)',
                                color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 16px'
                            }}>
                                <AlertCircle size={32} />
                            </div>
                            <h2 style={{ marginBottom: 8 }}>Delete Policy?</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
                                Are you sure you want to delete the policy <strong>{policyToDelete.providerName}</strong> ({policyToDelete.policyNumber})? This action cannot be undone.
                            </p>
                            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                                <button className="btn btn-secondary" onClick={() => setPolicyToDelete(null)} style={{ flex: 1 }}>
                                    Cancel
                                </button>
                                <button className="btn btn-danger" onClick={() => executeDelete(policyToDelete._id)} style={{ flex: 1 }}>
                                    Confirm Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
