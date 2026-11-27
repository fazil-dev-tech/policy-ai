import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { Send, Bot, User, Plus, MessageSquare, Clock, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import MarkdownText from '../components/shared/MarkdownText';

// ─── Copy Button ────────────────────────────────────────────────────────────
function CopyBtn({ text }) {
    const [copied, setCopied] = useState(false);
    const handle = () => {
        navigator.clipboard?.writeText(text)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            })
            .catch(() => toast.error('Clipboard permission unavailable'));
    };
    return (
        <button type="button" className="msg-copy-btn" onClick={handle} title="Copy response" aria-label="Copy response">
            {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
    );
}

const QUICK_PROMPTS = [
    'What does my policy cover?',
    'How do I file a cashless claim?',
    'Explain IRDAI 60-month PED moratorium',
    'Draft a reimbursement appeal email',
];

const AI_MODEL_OPTIONS = [
    { value: '', label: 'Auto (NVIDIA Nemotron 3.5 / Ultra)' },
    { value: 'nvidia/nemotron-3.5-lightning-30b-a3b', label: 'NVIDIA Nemotron 3.5 Lightning (30B Fast)' },
    { value: 'nvidia/nemotron-3-ultra-550b-a55b', label: 'NVIDIA Nemotron 3 Ultra (550B 1M)' },
    { value: 'nvidia/nemotron-3.5-super-vl-120b-a12b', label: 'NVIDIA Nemotron 3.5 Super VL (120B)' },
    { value: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', label: 'NVIDIA Nemotron 3 Nano Omni (30B)' },
    { value: 'mistralai/mistral-large-4-1t-a52b', label: 'Mistral Large 4 (NIM)' },
];

export default function ChatPage() {
    const [searchParams] = useSearchParams();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState(() => sessionStorage.getItem('pg_standard_session') || null);
    const [sessions, setSessions] = useState([]);
    const [policies, setPolicies] = useState([]);
    const [selectedPolicy, setSelectedPolicy] = useState(searchParams.get('policyId') || '');
    const [selectedModel, setSelectedModel] = useState('');
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);

    useEffect(() => {
        loadSessions();
        loadPolicies();
        const urlPolicy = searchParams.get('policyId');
        if (urlPolicy) setSelectedPolicy(urlPolicy);
        const savedSid = sessionStorage.getItem('pg_standard_session');
        if (savedSid) loadSessionHistory(savedSid, { expectedPolicyId: urlPolicy || null });
    }, []);

    useEffect(() => {
        const urlPolicy = searchParams.get('policyId');
        if (urlPolicy && urlPolicy !== selectedPolicy) {
            setSelectedPolicy(urlPolicy);
        }
    }, [searchParams]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const loadSessions = async () => {
        try { const { data } = await api.get('/chat/sessions?agent=standard'); setSessions(data.sessions || []); } catch { }
    };
    const loadPolicies = async () => {
        try { const { data } = await api.get('/policy?limit=50'); setPolicies(data.policies || []); } catch { }
    };
    const loadSessionHistory = async (sid, { expectedPolicyId = null } = {}) => {
        try {
            const { data } = await api.get(`/chat/history?sessionId=${sid}`);
            const msgs = data.messages || [];
            const sessionPolicyId = msgs.find((m) => m.policyId)?.policyId || '';
            if (expectedPolicyId && sessionPolicyId !== expectedPolicyId) {
                setMessages([]);
                setSessionId(null);
                sessionStorage.removeItem('pg_standard_session');
                setSelectedPolicy(expectedPolicyId);
                return;
            }
            const formatted = msgs.flatMap(m => ([
                { role: 'user', content: m.message, timestamp: m.timestamp },
                { role: 'ai', content: m.aiResponse, timestamp: m.timestamp, model: m.model, responseTime: m.responseTimeMs },
            ]));
            setMessages(formatted);
            setSessionId(sid);
            sessionStorage.setItem('pg_standard_session', sid);
            if (!expectedPolicyId && !searchParams.get('policyId')) {
                setSelectedPolicy(sessionPolicyId);
            }
        } catch { toast.error('Failed to load chat history'); }
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;
        const userMsg = input.trim();
        setInput('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        setMessages(prev => [...prev, { role: 'user', content: userMsg, timestamp: new Date().toISOString() }]);
        setLoading(true);
        try {
            const { data } = await api.post('/chat/message', {
                message: userMsg,
                policyId: selectedPolicy || undefined,
                sessionId: sessionId || undefined,
                aiModel: selectedModel || undefined,
            });
            setSessionId(data.sessionId);
            if (data.sessionId) sessionStorage.setItem('pg_standard_session', data.sessionId);
            setMessages(prev => [...prev, {
                role: 'ai', content: data.aiResponse,
                model: data.model, responseTime: data.responseTimeMs,
                timestamp: new Date().toISOString(),
            }]);
            loadSessions();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Chat failed');
            setMessages(prev => [...prev, { role: 'ai', content: 'Sorry, I encountered an error. Please try again.', timestamp: new Date().toISOString() }]);
        } finally { setLoading(false); }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const autoGrow = (e) => {
        const ta = e.target;
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
        setInput(ta.value);
    };

    const fmtTime = (ts) => ts ? new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';

    return (
        <div className="chat-layout">
            {/* Sidebar */}
            <div className="chat-sidebar">
                <div className="chat-sidebar-top">
                    <button type="button" className="btn btn-primary w-full" onClick={() => { setMessages([]); setSessionId(null); sessionStorage.removeItem('pg_standard_session'); }}>
                        <Plus size={15} /> New Chat
                    </button>
                </div>

                <div className="chat-sidebar-section">
                    <label className="form-label" htmlFor="chat-policy-select">Policy Context</label>
                    <select id="chat-policy-select" name="policyId" className="form-input form-input-sm" value={selectedPolicy}
                        onChange={e => setSelectedPolicy(e.target.value)}>
                        <option value="">General AI + Live Web Mode</option>
                        {policies.map(p => (
                            <option key={p._id} value={p._id}>{p.providerName} · {p.policyNumber}</option>
                        ))}
                    </select>
                    <label className="form-label" htmlFor="chat-model-select" style={{ marginTop: 10 }}>AI Engine / Model</label>
                    <select id="chat-model-select" name="aiModel" className="form-input form-input-sm" value={selectedModel}
                        onChange={e => setSelectedModel(e.target.value)}>
                        {AI_MODEL_OPTIONS.map(opt => (
                            <option key={opt.value || 'auto'} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    {selectedPolicy && (
                        <div className="policy-context-badge">
                            <span className="dot active-dot" aria-hidden="true" /> Policy context active
                        </div>
                    )}
                </div>

                <div className="chat-sidebar-history">
                    <div className="sidebar-section-label">Recent Chats</div>
                    {sessions.length === 0 ? (
                        <div className="empty-sessions">No conversations yet</div>
                    ) : sessions.map(s => (
                        <button key={s.sessionId} type="button"
                            className={`session-item ${sessionId === s.sessionId ? 'active' : ''}`}
                            onClick={() => loadSessionHistory(s.sessionId)}>
                            <MessageSquare size={14} />
                            <div className="session-item-text">
                                <div className="session-preview">{s.lastMessage || 'Chat session'}</div>
                                <div className="session-meta"><Clock size={10} /> {s.messageCount} messages</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Chat */}
            <div className="chat-container" style={{ flex: 1 }}>
                <div className="chat-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="chat-bot-avatar"><Bot size={22} /></div>
                        <div>
                            <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>PolicyAI Assistant</h1>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {selectedPolicy ? '📋 Policy context active' : '🌐 General insurance assistant'}
                            </span>
                        </div>
                    </div>
                    <div className="online-indicator"><span className="dot active-dot" aria-hidden="true" /> Online</div>
                </div>

                <div className="chat-messages">
                    {messages.length === 0 && (
                        <div className="chat-welcome">
                            <div className="chat-welcome-avatar"><Bot size={36} /></div>
                            <h2>How can I help you today?</h2>
                            <p>Ask me about your insurance policies, coverage, claim procedures, or anything else.</p>
                            <div className="quick-prompts">
                                {QUICK_PROMPTS.map(q => (
                                    <button key={q} type="button" className="quick-prompt-chip"
                                        onClick={() => { setInput(q); textareaRef.current?.focus(); }}>
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div key={i} className={`chat-message ${msg.role}`}>
                            <div className="msg-avatar">
                                {msg.role === 'ai' ? <Bot size={14} /> : <User size={14} />}
                            </div>
                            <div className="msg-bubble-wrap">
                                <div className={`msg-bubble ${msg.role}`}>
                                    {msg.role === 'ai'
                                        ? <MarkdownText content={msg.content} />
                                        : <span>{msg.content}</span>
                                    }
                                </div>
                                <div className="msg-meta">
                                    <span className="msg-time">{fmtTime(msg.timestamp)}</span>
                                    {msg.model && <span className="msg-time" style={{ fontWeight: 600 }}>{msg.model}</span>}
                                    {msg.responseTime > 0 && <span className="msg-time">{msg.responseTime}ms</span>}
                                    {msg.role === 'ai' && <CopyBtn text={msg.content} />}
                                </div>
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="chat-message ai">
                            <div className="msg-avatar"><Bot size={14} /></div>
                            <div className="msg-bubble-wrap">
                                <div className="msg-bubble ai">
                                    <div className="typing-indicator"><span /><span /><span /></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="chat-input-area" style={{ padding: '20px 24px', borderTop: '1px solid rgba(255,255,255,0.65)', background: 'rgba(255,255,255,0.52)', backdropFilter: 'blur(18px) saturate(170%)' }}>
                    <div className="chat-input-wrapper">
                        <textarea
                            ref={textareaRef}
                            id="chat-message-input"
                            name="message"
                            className="chat-textarea"
                            aria-label="Ask PolicyAI Assistant a question"
                            placeholder="Ask a general question OR ask about your uploaded policy clauses... (Shift+Enter for new line)"
                            value={input}
                            onChange={autoGrow}
                            onKeyDown={handleKeyDown}
                            disabled={loading}
                            rows={1}
                        />
                        <button type="button" className="chat-send-btn" aria-label="Send message" onClick={handleSend} disabled={loading || !input.trim()}>
                            <Send size={18} />
                        </button>
                    </div>
                    <div className="chat-input-hint">AI can make mistakes. Verify important information.</div>
                </div>
            </div>
        </div>
    );
}
