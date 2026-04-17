import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import {
    Upload, FileText, Trash2, Eye, X, AlertTriangle,
    CheckCircle, Shield, ClipboardList, FileCheck, Zap, Bot,
    AlertCircle, MessageCircle, Send
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
                strokeDasharray={`\${dash} \${circ}`} strokeLinecap="round"
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

const DOC_TYPE_COLORS = {
    contract: '#3b82f6',
    invoice: '#f59e0b',
    report: '#10b981',
    letter: '#6366f1',
    legal: '#ef4444',
    general: '#8b5cf6',
};

const TABS = [
    { key: 'simpleSummary', label: 'Summary', icon: FileText },
    { key: 'keyPoints', label: 'Key Points', icon: CheckCircle },
    { key: 'actionItems', label: 'Action Items', icon: ClipboardList },
    { key: 'riskFactors', label: 'Risk Factors', icon: AlertTriangle },
    { key: 'entities', label: 'Entities', icon: Zap },
];

export default function AnalyzerPage() {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [activeTab, setActiveTab] = useState('simpleSummary');
    const [dragOver, setDragOver] = useState(false);
    const [uploadStep, setUploadStep] = useState(0);
    const [docToDelete, setDocToDelete] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const fileRef = useRef(null);
    const chatEndRef = useRef(null);

    useEffect(() => { loadDocs(); }, []);
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

    const loadDocs = async () => {
        try {
            const { data } = await api.get('/documents');
            setDocs(data.documents || []);
        } catch (err) {
            console.error(err);
            if (err.response?.status === 401) {
                toast.error('Session expired — please login again');
            } else {
                toast.error('Failed to load documents');
            }
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
        formData.append('pdf', file);

        try {
            setUploadStep(2);
            const { data } = await api.post('/documents/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setUploadStep(3);
            await new Promise(r => setTimeout(r, 600));
            toast.success('Document uploaded and analyzed!');

            // Check nested response vs direct response depending on how axios handles it
            const newDoc = data.document || data;

            setDocs([newDoc, ...docs]);
            setSelectedDoc(newDoc);
            setActiveTab('simpleSummary');
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || 'Upload failed');
        } finally {
            setUploading(false);
            setUploadStep(0);
        }
    };

    const executeDelete = async (id) => {
        try {
            await api.delete('/documents/' + id);
            setDocs(prev => prev.filter(p => p._id !== id));
            toast.success('Document deleted successfully');
            if (selectedDoc?._id === id) setSelectedDoc(null);
        } catch (err) {
            console.error('Delete failed:', err);
            toast.error('Failed to delete document');
        } finally {
            setDocToDelete(null);
        }
    };

    const UPLOAD_STEPS = ['', 'Parsing PDF...', 'AI Analysing...', 'Done ✓'];

    const sendMessage = async () => {
        if (!chatInput.trim() || !selectedDoc || chatLoading) return;
        const userMsg = chatInput.trim();
        setChatInput('');
        setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setChatLoading(true);
        try {
            const history = chatMessages.map(m => ({
                message: m.role === 'user' ? m.text : '',
                response: m.role === 'ai' ? m.text : '',
            })).filter(h => h.message || h.response);
            const { data } = await api.post('/documents/' + selectedDoc._id + '/chat', {
                message: userMsg, history
            });
            setChatMessages(prev => [...prev, { role: 'ai', text: data.response }]);
        } catch (err) {
            console.error(err);
            setChatMessages(prev => [...prev, { role: 'ai', text: 'Sorry, I could not process your question. Please try again.' }]);
        } finally {
            setChatLoading(false);
        }
    };

    if (loading) return (
        <div className="loading-spinner"><div className="spinner" /></div>
    );

    return (
        <div>
            <div className="page-header" style={{ marginBottom: 24 }}>
                <h1 style={{ background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 800 }}>General PDF Analyzer</h1>
                <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>Upload and analyze any document type (contracts, invoices, reports) with AI</p>
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
                        <h3>Drop your document PDF here</h3>
                        <p>or click to browse — PDF only, max 10MB</p>
                        <div className="upload-formats">
                            {['Contracts', 'Invoices', 'Reports', 'Letters', 'Legal', 'General'].map(t => (
                                <span key={t} className="upload-format-tag">{t}</span>
                            ))}
                        </div>
                    </>
                )
                }
            </div >

            {/* Document Grid */}
            {
                docs.length > 0 ? (
                    <div className="policy-list">
                        {docs.map((doc) => {
                            const typeColor = DOC_TYPE_COLORS[doc.documentType] || '#8b5cf6';
                            return (
                                <div key={doc._id} className="policy-card" style={{ '--type-color': typeColor }}
                                    onClick={() => { setSelectedDoc(doc); setActiveTab('simpleSummary'); }}>
                                    <div className="policy-card-top">
                                        <span className="badge" style={{ background: typeColor + '22', color: typeColor, border: `1px solid ${typeColor}44` }}>
                                            {doc.documentType}
                                        </span>
                                        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                                            <button className="btn btn-secondary btn-sm"
                                                onClick={() => { setSelectedDoc(doc); setActiveTab('simpleSummary'); }}>
                                                <Eye size={13} /> View
                                            </button>
                                            <button className="btn btn-danger btn-sm" onClick={() => setDocToDelete(doc)}>
                                                <Bot size={13} /> Delete
                                            </button>
                                        </div>
                                    </div>
                                    <h3 className="policy-provider" style={{ marginTop: '8px' }}>{doc.documentName}</h3>
                                    <div className="policy-card-bottom" style={{ marginTop: 24 }}>
                                        <div className="score-bar">
                                            <div className="score-bar-fill"
                                                style={{ width: '100%', background: `linear-gradient(90deg, ${typeColor}, ${typeColor}99)` }} />
                                        </div>
                                        <span className="score-label">Analyzed by Enterprise AI</span>
                                    </div>
                                    <div className="policy-card-glow" style={{ '--type-color': typeColor }} />
                                </div>
                            );
                        })}
                    </div >
                ) : (
                    <div className="empty-state" style={{ padding: '60px 20px' }}>
                        <FileText size={64} style={{ color: 'var(--accent-primary)', opacity: 0.5 }} />
                        <h3 style={{ marginTop: 20 }}>No Documents Uploaded</h3>
                        <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Upload your first general PDF to get started with AI analysis</p>
                    </div>
                )}

            {/* Document Detail Modal */}
            {
                selectedDoc && (
                    <div className="modal-overlay" onClick={() => setSelectedDoc(null)}>
                        <div className="modal policy-modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <div className="upload-icon" style={{ width: 50, height: 50, background: 'rgba(139, 92, 246, 0.1)' }}><FileText size={24} color="#8b5cf6" /></div>
                                    <div>
                                        <h2 style={{ fontSize: 20, fontWeight: 700 }}>{selectedDoc.documentName}</h2>
                                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                                            <span className="badge badge-purple">{selectedDoc.documentType}</span>
                                            <span className={`badge badge-success`}>Analyzed</span>
                                        </div>
                                    </div>
                                </div>
                                <button className="modal-close" onClick={() => setSelectedDoc(null)}><X size={18} /></button>
                            </div>

                            {/* Document Meta */}
                            <div className="policy-meta-grid">
                                {[
                                    ['Document ID', selectedDoc._id ? selectedDoc._id.slice(-6).toUpperCase() : 'UNKNOWN'],
                                    ['Size', selectedDoc.fileSize ? `${(selectedDoc.fileSize / 1024 / 1024).toFixed(2)} MB` : 'Unknown'],
                                    ['Uploaded', selectedDoc.createdAt ? new Date(selectedDoc.createdAt).toLocaleDateString() : '—'],
                                ].map(([label, value]) => (
                                    <div key={label} className="policy-meta-cell">
                                        <div className="meta-label">{label}</div>
                                        <div className="meta-value">{value}</div>
                                    </div>
                                ))}
                            </div>

                            {/* AI Analysis Tabs */}
                            {selectedDoc.aiSummary && (
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
                                        <AiValue value={selectedDoc.aiSummary[activeTab]} />
                                    </div>
                                </div>
                            )
                            }

                            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                                <a href={(import.meta.env.VITE_API_URL || '').replace('/api', '') + selectedDoc.pdfUrl} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ flex: 1, textAlign: 'center' }}>
                                    <FileText size={15} /> View PDF
                                </a>
                                <button className="btn btn-primary" onClick={() => setShowChat(!showChat)} style={{ flex: 1 }}>
                                    <MessageCircle size={15} /> {showChat ? 'Hide Chat' : 'Ask AI'}
                                </button>
                                <button className="btn btn-danger" onClick={() => { setDocToDelete(selectedDoc); setSelectedDoc(null); setChatMessages([]); setShowChat(false); }}>
                                    <Trash2 size={15} /> Delete
                                </button>
                            </div>

                            {/* Chat Panel */}
                            {showChat && (
                                <div style={{ marginTop: 16, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                                    <div style={{ padding: '12px 16px', background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Bot size={18} /> <span style={{ fontWeight: 700 }}>Ask about this document</span>
                                    </div>
                                    <div style={{ maxHeight: 280, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {chatMessages.length === 0 && (
                                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: 13, padding: 20 }}>
                                                Ask any question about this document. The AI will use the analysis context to answer.
                                            </p>
                                        )}
                                        {chatMessages.map((msg, i) => (
                                            <div key={i} style={{
                                                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                                background: msg.role === 'user' ? 'linear-gradient(135deg, #8b5cf6, #3b82f6)' : 'var(--bg-glass)',
                                                color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                                                padding: '10px 14px', borderRadius: 14, maxWidth: '80%', fontSize: 13.5, lineHeight: 1.6,
                                                whiteSpace: 'pre-wrap', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                                            }}>
                                                {msg.text}
                                            </div>
                                        ))}
                                        {chatLoading && (
                                            <div style={{ alignSelf: 'flex-start', padding: '10px 14px', background: 'var(--bg-glass)', borderRadius: 14, fontSize: 13 }}>
                                                <span style={{ animation: 'pulse 1.5s infinite' }}>Thinking...</span>
                                            </div>
                                        )}
                                        <div ref={chatEndRef} />
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Ask a question about this document..."
                                            value={chatInput}
                                            onChange={e => setChatInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && sendMessage()}
                                            style={{ flex: 1, margin: 0 }}
                                        />
                                        <button className="btn btn-primary" onClick={sendMessage} disabled={chatLoading || !chatInput.trim()} style={{ padding: '8px 16px' }}>
                                            <Send size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div >
                    </div >
                )}

            {/* Delete Confirmation Modal */}
            {
                docToDelete && (
                    <div className="modal-overlay" onClick={() => setDocToDelete(null)}>
                        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, textAlign: 'center' }}>
                            <div style={{ padding: '24px', background: 'var(--bg-glass)' }}>
                                <div style={{
                                    width: 64, height: 64, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)',
                                    color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    margin: '0 auto 16px'
                                }}>
                                    <AlertCircle size={32} />
                                </div>
                                <h2 style={{ marginBottom: 8 }}>Delete Document?</h2>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
                                    Are you sure you want to delete the document <strong>{docToDelete.documentName}</strong>? This action cannot be undone.
                                </p>
                                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                                    <button className="btn btn-secondary" onClick={() => setDocToDelete(null)} style={{ flex: 1 }}>
                                        Cancel
                                    </button>
                                    <button className="btn btn-danger" onClick={() => executeDelete(docToDelete._id)} style={{ flex: 1 }}>
                                        Confirm Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
