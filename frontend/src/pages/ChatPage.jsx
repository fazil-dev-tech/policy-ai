import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { Send, Bot, User, Plus, MessageSquare, Clock, Copy, Check, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Simple markdown renderer ──────────────────────────────────────────────
function MarkdownText({ content }) {
    if (!content) return null;
    const lines = content.split('\n');
    const elements = [];
    let listItems = [];
    let key = 0;

    const flushList = () => {
        if (listItems.length) {
            elements.push(<ul key={key++} className="md-list">{listItems}</ul>);
            listItems = [];
        }
    };

    const renderInline = (text) => {
        const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
        return parts.map((p, i) => {
            if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
            if (p.startsWith('*') && p.endsWith('*')) return <em key={i}>{p.slice(1, -1)}</em>;
            if (p.startsWith('`') && p.endsWith('`')) return <code key={i} className="md-code">{p.slice(1, -1)}</code>;
            return p;
        });
    };

    lines.forEach((line, i) => {
        if (line.match(/^#{1,3} /)) {
            flushList();
            const level = line.match(/^(#+)/)[1].length;
            const text = line.replace(/^#+\s/, '');
            const Tag = `h${Math.min(level + 2, 6)}`;
            elements.push(<Tag key={key++} className={`md-h${level}`}>{renderInline(text)}</Tag>);
        } else if (line.match(/^[-*] /)) {
            listItems.push(<li key={key++}>{renderInline(line.replace(/^[-*] /, ''))}</li>);
        } else if (line.match(/^\d+\. /)) {
            flushList();
            elements.push(<p key={key++} className="md-numbered">{renderInline(line)}</p>);
        } else if (line.trim() === '') {
            flushList();
            elements.push(<br key={key++} />);
        } else {
            flushList();
            elements.push(<p key={key++} className="md-p">{renderInline(line)}</p>);
        }
    });
    flushList();
    return <div className="markdown-content">{elements}</div>;
}

// ─── Copy Button ────────────────────────────────────────────────────────────
function CopyBtn({ text }) {
    const [copied, setCopied] = useState(false);
    const handle = () => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <button className="msg-copy-btn" onClick={handle} title="Copy response">
            {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
    );
}

const QUICK_PROMPTS = [
    'What does my policy cover?',
    'How do I file a claim?',
    'What are the main exclusions?',
    'What documents do I need?',
];

export default function ChatPage() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [policies, setPolicies] = useState([]);
    const [selectedPolicy, setSelectedPolicy] = useState('');
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);

    useEffect(() => { loadSessions(); loadPolicies(); }, []);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const loadSessions = async () => {
        try { const { data } = await api.get('/chat/sessions'); setSessions(data.sessions || []); } catch { }
    };
    const loadPolicies = async () => {
        try { const { data } = await api.get('/policy'); setPolicies(data.policies || []); } catch { }
    };
    const loadSessionHistory = async (sid) => {
        try {
            const { data } = await api.get(`/chat/history?sessionId=${sid}`);
            const formatted = (data.messages || []).flatMap(m => ([
                { role: 'user', content: m.message, timestamp: m.timestamp },
                { role: 'ai', content: m.aiResponse, timestamp: m.timestamp, model: m.model },
            ]));
            setMessages(formatted);
            setSessionId(sid);
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
            });
            setSessionId(data.sessionId);
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
                    <button className="btn btn-primary w-full" onClick={() => { setMessages([]); setSessionId(null); }}>
                        <Plus size={15} /> New Chat
                    </button>
                </div>

                <div className="chat-sidebar-section">
                    <label className="form-label">Policy Context</label>
                    <select className="form-input form-input-sm" value={selectedPolicy}
                        onChange={e => setSelectedPolicy(e.target.value)}>
                        <option value="">General (No Policy)</option>
                        {policies.map(p => (
                            <option key={p._id} value={p._id}>{p.providerName} · {p.policyNumber}</option>
                        ))}
                    </select>
                    {selectedPolicy && (
                        <div className="policy-context-badge">
                            <span className="dot active-dot" /> Policy context active
                        </div>
                    )}
                </div>

                <div className="chat-sidebar-history">
                    <div className="sidebar-section-label">Recent Chats</div>
                    {sessions.length === 0 ? (
                        <div className="empty-sessions">No conversations yet</div>
                    ) : sessions.map(s => (
                        <button key={s.sessionId}
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
                            <h3 style={{ fontSize: 16, fontWeight: 700 }}>PolicyAI Assistant</h3>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {selectedPolicy ? '📋 Policy context active' : '🌐 General insurance assistant'}
                            </span>
                        </div>
                    </div>
                    <div className="online-indicator"><span className="dot active-dot" /> Online</div>
                </div>

                <div className="chat-messages">
                    {messages.length === 0 && (
                        <div className="chat-welcome">
                            <div className="chat-welcome-avatar"><Bot size={36} /></div>
                            <h3>How can I help you today?</h3>
                            <p>Ask me about your insurance policies, coverage, claim procedures, or anything else.</p>
                            <div className="quick-prompts">
                                {QUICK_PROMPTS.map(q => (
                                    <button key={q} className="quick-prompt-chip"
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
                                    {msg.responseTime && <span className="msg-time">{msg.responseTime}ms</span>}
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

                <div className="chat-input-area" style={{ padding: '24px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'var(--bg-card)' }}>
                    <div className="chat-input-wrapper">
                        <textarea
                            ref={textareaRef}
                            className="chat-textarea"
                            placeholder="Ask about your insurance policy... (Shift+Enter for new line)"
                            value={input}
                            onChange={autoGrow}
                            onKeyDown={handleKeyDown}
                            disabled={loading}
                            rows={1}
                        />
                        <button className="chat-send-btn" onClick={handleSend} disabled={loading || !input.trim()}>
                            <Send size={18} />
                        </button>
                    </div>
                    <div className="chat-input-hint">AI can make mistakes. Verify important information.</div>
                </div>
            </div>
        </div>
    );
}
