import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { Send, Terminal, User, Plus, MessageSquare, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function GlobalChatPage() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [sessions, setSessions] = useState([]);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        loadSessions();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadSessions = async () => {
        try {
            const { data } = await api.get('/chat/sessions');
            // Filter out sessions that have a policy? Actually, we'll just show all sessions, or let them be mixed.
            // For a pure ChatGPT feel, maybe we just show history. 
            setSessions(data.sessions || []);
        } catch (err) { /* ignore */ }
    };

    const loadSessionHistory = async (sid) => {
        try {
            const { data } = await api.get(`/chat/history?sessionId=${sid}`);
            const formatted = (data.messages || []).map(m => ([
                { role: 'user', content: m.message, timestamp: m.timestamp },
                { role: 'ai', content: m.aiResponse, timestamp: m.timestamp },
            ])).flat();
            setMessages(formatted);
            setSessionId(sid);
        } catch (err) {
            toast.error('Failed to load chat history');
        }
    };

    const startNewSession = () => {
        setMessages([]);
        setSessionId(null);
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;
        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        try {
            const { data } = await api.post('/chat/message', {
                message: userMsg,
                policyId: undefined, // No policy context, pure global chat
                sessionId: sessionId || undefined,
                aiModel: 'puter',
            });

            setSessionId(data.sessionId);
            setMessages(prev => [...prev, {
                role: 'ai',
                content: data.aiResponse,
                model: data.model || 'Puter.js',
                responseTime: data.responseTimeMs,
            }]);

            // Refresh sessions
            loadSessions();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Chat failed');
            setMessages(prev => [...prev, {
                role: 'ai',
                content: 'Sorry, I encountered an error. Please try again.',
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div style={{ display: 'flex', gap: 24, height: 'calc(100vh - 64px)' }}>
            {/* Sessions Sidebar */}
            <div style={{
                width: 280, background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius-lg)', display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}>
                <div style={{ padding: 20, borderBottom: '1px solid var(--border-color)' }}>
                    <button className="btn btn-primary" style={{ width: '100%', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }} onClick={startNewSession}>
                        <Plus size={16} /> New Chat
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '8px 4px', letterSpacing: 0.5 }}>
                        Recent Chats
                    </div>
                    {sessions.map((s) => (
                        <button
                            key={s.sessionId}
                            className={`sidebar-link ${sessionId === s.sessionId ? 'active' : ''}`}
                            onClick={() => loadSessionHistory(s.sessionId)}
                            style={{ fontSize: 13, display: 'flex', alignItems: 'flex-start', padding: 12, borderRadius: 8, border: 'none', background: sessionId === s.sessionId ? 'rgba(99, 102, 241, 0.1)' : 'transparent', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', width: '100%', marginBottom: 4 }}
                        >
                            <MessageSquare size={16} style={{ marginTop: 2, marginRight: 8, color: sessionId === s.sessionId ? 'var(--primary-color)' : 'var(--text-muted)' }} />
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                                    {s.lastMessage}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                    <Clock size={10} /> {s.messageCount} messages
                                </div>
                            </div>
                        </button>
                    ))}
                    {sessions.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
                            No conversations yet
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className="chat-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-lg)', overflow: 'hidden' }}>
                <div className="chat-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="stat-icon purple" style={{ width: 40, height: 40, background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.2) 100%)', color: '#8b5cf6', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Terminal size={20} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Global AI Terminal</h3>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Powered by Puter.js
                            </span>
                        </div>
                    </div>
                </div>

                <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {messages.length === 0 && (
                        <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center', margin: 'auto' }}>
                            <Terminal size={48} style={{ color: 'var(--text-muted)', marginBottom: 16, opacity: 0.5 }} />
                            <h3 style={{ fontSize: 20, marginBottom: 8 }}>Global AI Terminal</h3>
                            <p style={{ color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto 24px', lineHeight: 1.6 }}>Ask me anything. I can write code, analyze data, answer global knowledge questions, and help you just like ChatGPT.</p>
                            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                                {[
                                    'Write a python script to fetch weather',
                                    'Explain quantum computing in simple terms',
                                    'Help me plan a 3-day trip to Tokyo',
                                ].map((q) => (
                                    <button
                                        key={q}
                                        className="btn btn-secondary btn-sm"
                                        style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-color)', padding: '8px 16px', borderRadius: 20, fontSize: 13 }}
                                        onClick={() => { setInput(q); }}
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div key={i} className={`chat-message ${msg.role}`} style={{ display: 'flex', gap: 16, flexDirection: msg.role === 'ai' ? 'row' : 'row-reverse' }}>
                            <div style={{
                                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: msg.role === 'ai' ? 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.2) 100%)' : 'rgba(255,255,255,0.1)',
                                color: msg.role === 'ai' ? '#8b5cf6' : 'var(--text-secondary)'
                            }}>
                                {msg.role === 'ai' ? <Terminal size={16} /> : <User size={16} />}
                            </div>
                            <div style={{ flex: 1, maxWidth: '85%', display: 'flex', flexDirection: 'column', alignItems: msg.role === 'ai' ? 'flex-start' : 'flex-end' }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    {msg.role === 'ai' ? 'AI Assistant' : 'You'}
                                </div>
                                <div style={{
                                    background: msg.role === 'ai' ? 'transparent' : 'var(--primary-color)',
                                    color: msg.role === 'ai' ? 'var(--text-primary)' : 'white',
                                    padding: msg.role === 'ai' ? '0' : '12px 16px',
                                    borderRadius: 12,
                                    whiteSpace: 'pre-wrap',
                                    lineHeight: 1.6,
                                    fontSize: 15
                                }}>
                                    {msg.content}
                                </div>
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div style={{ display: 'flex', gap: 16 }}>
                            <div style={{
                                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(139,92,246,0.2) 100%)',
                                color: '#8b5cf6'
                            }}>
                                <Terminal size={16} />
                            </div>
                            <div className="typing-indicator" style={{ background: 'transparent', padding: 0 }}>
                                <span style={{ background: 'var(--text-muted)' }} /><span style={{ background: 'var(--text-muted)' }} /><span style={{ background: 'var(--text-muted)' }} />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="chat-input-area" style={{ padding: '24px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'var(--bg-card)' }}>
                    <div className="chat-input-wrapper">
                        <textarea
                            className="chat-textarea"
                            placeholder="Message the Global AI Terminal... (Shift+Enter for new line)"
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value);
                                e.target.style.height = 'auto';
                                e.target.style.height = `${e.target.scrollHeight}px`;
                            }}
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
