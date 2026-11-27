import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { resolveAssetUrl, uploadDirectToSignedStorage } from '../services/api';
import {
    Upload, FileText, Trash2, Eye, X, AlertTriangle,
    CheckCircle, ClipboardList, Zap, Bot,
    AlertCircle, MessageCircle, Send
} from 'lucide-react';
import toast from 'react-hot-toast';

function formatFieldLabel(rawKey) {
    return String(rawKey || '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .replace(/^./, (c) => c.toUpperCase());
}

function formatScalarOrNested(val) {
    if (val === null || val === undefined || val === '') return '—';
    if (Array.isArray(val)) return val.map((v) => formatScalarOrNested(v)).join(', ');
    if (typeof val === 'object') {
        return Object.entries(val)
            .map(([k, v]) => `${formatFieldLabel(k)}: ${formatScalarOrNested(v)}`)
            .join(' · ');
    }
    return String(val);
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
                                    <div key={k}><strong>{formatFieldLabel(k)}:</strong> {formatScalarOrNested(v)}</div>
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
                        <span className="ai-object-key">{formatFieldLabel(k)}</span>
                        <span className="ai-object-val">{formatScalarOrNested(v)}</span>
                    </div>
                ))}
            </div>
        );
    }
    return <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>{String(value)}</p>;
}

const DOC_TYPE_COLORS = {
    contract: '#1d4ed8',
    invoice: '#92400e',
    report: '#065f46',
    letter: '#4338ca',
    legal: '#b91c1c',
    general: '#5b21b6',
};

const TABS = [
    { key: 'simpleSummary', label: 'Summary', icon: FileText },
    { key: 'keyPoints', label: 'Key Points', icon: CheckCircle },
    { key: 'actionItems', label: 'Action Items', icon: ClipboardList },
    { key: 'riskFactors', label: 'Risk Factors', icon: AlertTriangle },
    { key: 'entities', label: 'Entities', icon: Zap },
];

export default function AnalyzerPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [activeTab, setActiveTab] = useState('simpleSummary');
    const [dragOver, setDragOver] = useState(false);
    const [uploadStep, setUploadStep] = useState(0);
    const [docToDelete, setDocToDelete] = useState(null);
    const [deletingDoc, setDeletingDoc] = useState(false);
    const deletingRef = useRef(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const fileRef = useRef(null);
    const chatEndRef = useRef(null);

    const openDocModal = (doc) => {
        setSelectedDoc(doc);
        setActiveTab('simpleSummary');
        setChatMessages([]);
        setShowChat(false);
    };

    const closeDocModal = () => {
        setSelectedDoc(null);
        setChatMessages([]);
        setShowChat(false);
        if (searchParams.get('docId')) {
            const next = new URLSearchParams(searchParams);
            next.delete('docId');
            setSearchParams(next, { replace: true });
        }
    };

    useEffect(() => { loadDocs(); }, []);
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') {
                closeDocModal();
                setDocToDelete(null);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
        const docId = searchParams.get('docId');
        if (!docId || docs.length === 0) return;
        const match = docs.find((d) => (d._id || d.id) === docId);
        if (match && selectedDoc?._id !== match._id) {
            openDocModal(match);
        }
    }, [searchParams, docs]);

    const loadDocs = async () => {
        try {
            const { data } = await api.get('/documents?limit=50');
            const list = data.documents || [];
            setDocs(list);
            const docId = searchParams.get('docId');
            if (docId) {
                const match = list.find((d) => (d._id || d.id) === docId);
                if (match) openDocModal(match);
            }
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
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
        if (!isPdf) {
            if (fileRef.current) fileRef.current.value = '';
            return toast.error('Only PDF files are allowed');
        }
        if (file.size > 10 * 1024 * 1024) {
            if (fileRef.current) fileRef.current.value = '';
            return toast.error('File size must be under 10MB');
        }

        setUploading(true);
        setUploadStep(1);
        try {
            let res;
            if (file.size > 3.8 * 1024 * 1024) {
                setUploadStep(2);
                const uploaded = await uploadDirectToSignedStorage(file, 'documents');
                setUploadStep(3);
                res = await api.post('/documents/upload', {
                    storagePath: uploaded.storagePath,
                    fileName: uploaded.fileName,
                    fileSize: uploaded.fileSize,
                }, { timeout: 120000 });
            } else {
                const formData = new FormData();
                formData.append('pdf', file);
                setUploadStep(2);
                res = await api.post('/documents/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    timeout: 120000,
                });
                setUploadStep(3);
            }
            const { data } = res;
            setUploadStep(4);
            await new Promise(r => setTimeout(r, 350));
            const newDoc = data.document || data;
            if (newDoc.status === 'failed' || newDoc.aiSummary?._aiFailed) {
                toast('PDF saved with offline text summary (AI rate-limited)');
            } else {
                toast.success('Document uploaded and analyzed!');
            }

            setDocs((prev) => [newDoc, ...prev]);
            openDocModal(newDoc);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || err.message || 'Upload failed');
        } finally {
            setUploading(false);
            setUploadStep(0);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const executeDelete = async (id) => {
        if (!id || deletingRef.current) return;
        deletingRef.current = true;
        setDeletingDoc(true);
        try {
            await api.delete('/documents/' + id);
            setDocs(prev => prev.filter(p => p._id !== id));
            toast.success('Document deleted successfully');
            if (selectedDoc?._id === id) closeDocModal();
        } catch (err) {
            if (err.response?.status === 404) {
                setDocs(prev => prev.filter(p => p._id !== id));
                if (selectedDoc?._id === id) closeDocModal();
                toast.success('Document deleted successfully');
            } else {
                console.error('Delete failed:', err);
                toast.error(err.response?.data?.error || 'Failed to delete document');
            }
        } finally {
            deletingRef.current = false;
            setDeletingDoc(false);
            setDocToDelete(null);
        }
    };

    const sendMessage = async () => {
        if (!chatInput.trim() || !selectedDoc || chatLoading) return;
        const userMsg = chatInput.trim();
        setChatInput('');
        setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setChatLoading(true);
        try {
            const history = [];
            for (const m of chatMessages) {
                if (m.role === 'user') {
                    history.push({ message: m.text, response: '' });
                } else if (m.role === 'ai') {
                    if (history.length > 0 && !history[history.length - 1].response) {
                        history[history.length - 1].response = m.text;
                    } else {
                        history.push({ message: '', response: m.text });
                    }
                }
            }
            const { data } = await api.post('/documents/' + selectedDoc._id + '/chat', {
                message: userMsg, history
            });
            setChatMessages(prev => [...prev, { role: 'ai', text: data.response }]);
        } catch (err) {
            console.error(err);
            const errMsg = err.response?.data?.error || 'Sorry, I could not process your question. Please try again.';
            setChatMessages(prev => [...prev, { role: 'ai', text: errMsg }]);
        } finally {
            setChatLoading(false);
        }
    };

    const viewDocumentPdf = async (doc) => {
        try {
            const resp = await api.get('/documents/' + doc._id + '/file', { responseType: 'blob' });
            const url = URL.createObjectURL(resp.data);
            window.open(url, '_blank', 'noopener,noreferrer');
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch {
            if (doc.pdfUrl) {
                window.open(resolveAssetUrl(doc.pdfUrl), '_blank', 'noopener,noreferrer');
            } else {
                toast.error('Original PDF file is unavailable');
            }
        }
    };

    if (loading) return (
        <div className="loading-spinner"><div className="spinner" /></div>
    );

    return (
        <div>
            <div className="page-header" style={{ marginBottom: 24 }}>
                <h1>General PDF Analyzer</h1>
                <p>Upload and analyze any document type (contracts, invoices, reports) with clause summaries and Q&amp;A</p>
            </div>

            {/* Upload Zone */}
            <div
                className={`upload-zone ${dragOver ? 'dragover' : ''} ${uploading ? 'uploading' : ''}`}
                role="button"
                tabIndex={0}
                aria-label="Drop your document PDF here"
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files[0]); }}
                onClick={() => !uploading && fileRef.current?.click()}
                onKeyDown={(e) => { if (!uploading && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileRef.current?.click(); } }}
                style={{ marginBottom: 32 }}
            >
                <input ref={fileRef} id="doc-pdf-upload" name="pdf" type="file" accept=".pdf" aria-label="Choose document PDF to upload"
                    onChange={(e) => handleUpload(e.target.files[0])} style={{ display: 'none' }} />
                {uploading ? (
                    <div className="upload-progress-container">
                        <div className="upload-progress-ring">
                            <svg width="80" height="80"><circle cx="40" cy="40" r="32" fill="none" stroke="rgba(225,29,72,0.2)" strokeWidth="6" /><circle cx="40" cy="40" r="32" fill="none" stroke="url(#pg)" strokeWidth="6" strokeDasharray="60 140" strokeLinecap="round"><animateTransform attributeName="transform" type="rotate" from="0 40 40" to="360 40 40" dur="1s" repeatCount="indefinite" /></circle><defs><linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#e11d48" /><stop offset="100%" stopColor="#ec4899" /></linearGradient></defs></svg>
                        </div>
                        <h2 className="gradient-text">Analyzing with AI...</h2>
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
                        <h2>Drop your document PDF here</h2>
                        <p>or click to browse — PDF only, max 10MB</p>
                        <div className="upload-formats">
                            {['Contracts', 'Invoices', 'Reports', 'Letters', 'Legal', 'General'].map(t => (
                                <span key={t} className="upload-format-tag">{t}</span>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Document Grid */}
            {docs.length > 0 ? (
                <div className="policy-list">
                    {docs.map((doc) => {
                        const typeColor = DOC_TYPE_COLORS[doc.documentType] || '#5b21b6';
                        const isFallback = doc.status === 'failed' || doc.aiSummary?._aiFailed;
                        return (
                            <article
                                key={doc._id}
                                className="policy-card"
                                style={{ '--type-color': typeColor }}
                                onClick={(e) => {
                                    if (!e.target.closest('button, a')) openDocModal(doc);
                                }}
                            >
                                <div className="policy-card-top">
                                    <span className="badge" style={{ background: typeColor + '22', color: typeColor, border: `1px solid ${typeColor}44` }}>
                                        {doc.documentType}
                                    </span>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openDocModal(doc)}>
                                            <Eye size={13} /> View
                                        </button>
                                        <button type="button" className="btn btn-danger btn-sm" onClick={() => setDocToDelete(doc)}>
                                            <Trash2 size={13} /> Delete
                                        </button>
                                    </div>
                                </div>
                                <h3 className="policy-provider" style={{ marginTop: 8 }}>
                                    <button type="button" className="policy-provider-btn" onClick={() => openDocModal(doc)}>
                                        {doc.documentName}
                                    </button>
                                </h3>
                                <div className="policy-card-bottom" style={{ marginTop: 24 }}>
                                    <div className="score-bar">
                                        <div
                                            className={`score-bar-fill ${isFallback ? 'medium' : 'high'}`}
                                            style={{ width: isFallback ? '60%' : '100%' }}
                                        />
                                    </div>
                                    <span className="score-label">
                                        {isFallback ? 'Offline Text Extract' : 'Analyzed by PolicyGuard AI'}
                                    </span>
                                </div>
                                <div className="policy-card-glow" style={{ '--type-color': typeColor }} />
                            </article>
                        );
                    })}
                </div>
            ) : (
                <div className="empty-state" style={{ padding: '60px 20px' }}>
                    <FileText size={64} style={{ color: 'var(--accent-primary)', opacity: 0.5 }} />
                    <h2 style={{ marginTop: 20 }}>No Documents Uploaded</h2>
                    <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Upload your first general PDF to get started with AI analysis</p>
                </div>
            )}

            {/* Document Detail Modal */}
            {selectedDoc && (
                <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={selectedDoc.documentName} onClick={closeDocModal}>
                    <div className="modal policy-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div className="upload-icon" style={{ width: 50, height: 50, background: 'rgba(225, 29, 72, 0.1)' }}><FileText size={24} color="var(--accent-primary)" /></div>
                                <div>
                                    <h2 style={{ fontSize: 20, fontWeight: 700 }}>{selectedDoc.documentName}</h2>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                                        <span className="badge badge-purple">{selectedDoc.documentType}</span>
                                        <span className={`badge ${selectedDoc.status === 'failed' || selectedDoc.aiSummary?._aiFailed ? 'badge-warning' : 'badge-success'}`}>
                                            {selectedDoc.status === 'failed' || selectedDoc.aiSummary?._aiFailed ? 'Offline Extract' : 'Analyzed'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button type="button" className="modal-close" aria-label="Close document details" onClick={closeDocModal}><X size={18} /></button>
                        </div>

                        {/* Document Meta */}
                        <div className="policy-meta-grid">
                            {[
                                ['Document ID', selectedDoc._id ? selectedDoc._id.slice(-6).toUpperCase() : 'UNKNOWN'],
                                ['Category', String(selectedDoc.documentType || 'general').toUpperCase()],
                                ['Size', selectedDoc.fileSize ? `${(selectedDoc.fileSize / 1024 / 1024).toFixed(2)} MB` : 'Unknown'],
                                ['Uploaded', selectedDoc.createdAt ? new Date(selectedDoc.createdAt).toLocaleDateString('en-IN') : '—'],
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
                                <div className="ai-tabs" role="tablist" aria-label="Document analysis tabs">
                                    {TABS.map(({ key, label, icon: Icon }) => (
                                        <button
                                            key={key}
                                            type="button"
                                            role="tab"
                                            aria-selected={activeTab === key}
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
                        )}

                        <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
                            <button type="button" onClick={() => viewDocumentPdf(selectedDoc)} className="btn btn-secondary" style={{ flex: 1, textAlign: 'center' }}>
                                <FileText size={15} /> View PDF
                            </button>
                            <button type="button" className="btn btn-primary" onClick={() => setShowChat(!showChat)} style={{ flex: 1 }}>
                                <MessageCircle size={15} /> {showChat ? 'Hide Chat' : 'Ask AI'}
                            </button>
                            <button type="button" className="btn btn-danger" onClick={() => { setDocToDelete(selectedDoc); closeDocModal(); }}>
                                <Trash2 size={15} /> Delete
                            </button>
                        </div>

                        {/* Chat Panel */}
                        {showChat && (
                            <div style={{ marginTop: 16, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                                <div style={{ padding: '12px 16px', background: 'var(--accent-gradient)', color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Bot size={18} /> <span style={{ fontWeight: 700 }}>Ask about this document</span>
                                </div>
                                <div style={{ maxHeight: 280, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {chatMessages.length === 0 && (
                                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: 13, padding: 20 }}>
                                            Ask any question about this document. The AI will use the extracted context to answer.
                                        </p>
                                    )}
                                    {chatMessages.map((msg, i) => (
                                        <div key={i} style={{
                                            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                            background: msg.role === 'user' ? 'var(--accent-gradient)' : 'var(--bg-glass)',
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
                                <form
                                    onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                                    style={{ display: 'flex', gap: 8, padding: '10px 16px', borderTop: '1px solid var(--border-color)' }}
                                >
                                    <input
                                        id="doc-chat-input"
                                        name="docQuestion"
                                        type="text"
                                        className="form-input"
                                        aria-label="Ask a question about this document"
                                        placeholder="Ask a question about this document..."
                                        value={chatInput}
                                        onChange={e => setChatInput(e.target.value)}
                                        style={{ flex: 1, margin: 0 }}
                                    />
                                    <button type="submit" className="btn btn-primary" aria-label="Send document question" disabled={chatLoading || !chatInput.trim()} style={{ padding: '8px 16px' }}>
                                        <Send size={16} />
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {docToDelete && (
                <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Confirm delete document" onClick={() => !deletingDoc && setDocToDelete(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, textAlign: 'center' }}>
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
                                <button type="button" className="btn btn-secondary" disabled={deletingDoc} onClick={() => setDocToDelete(null)} style={{ flex: 1 }}>
                                    Cancel
                                </button>
                                <button type="button" className="btn btn-danger" disabled={deletingDoc} onClick={() => executeDelete(docToDelete._id)} style={{ flex: 1 }}>
                                    {deletingDoc ? 'Deleting...' : 'Confirm Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
