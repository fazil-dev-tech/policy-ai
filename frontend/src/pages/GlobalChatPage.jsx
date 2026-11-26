import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import ParinidhiAvatar3D from '../components/ParinidhiAvatar3D';
import {
    Send, Mic, MicOff, Volume2, VolumeX, User, Plus,
    MessageSquare, Clock, Globe, Sparkles, FileText, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function GlobalChatPage() {
    const [searchParams] = useSearchParams();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [policies, setPolicies] = useState([]);
    const [selectedPolicyId, setSelectedPolicyId] = useState(searchParams.get('policyId') || '');
    const [mode, setMode] = useState('auto');

    // Voice & 3D Avatar states
    const [avatarState, setAvatarState] = useState('idle');
    const [mouthLevel, setMouthLevel] = useState(0);
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [isListening, setIsListening] = useState(false);

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const pulseTimerRef = useRef(null);

    useEffect(() => {
        loadSessions();
        loadPolicies();
        const urlPolicy = searchParams.get('policyId');
        const urlPrompt = searchParams.get('q');
        if (urlPolicy) setSelectedPolicyId(urlPolicy);
        if (urlPrompt) setInput(urlPrompt);
        return () => {
            window.speechSynthesis?.cancel();
            recognitionRef.current?.stop();
            clearInterval(pulseTimerRef.current);
        };
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadSessions = async () => {
        try {
            const { data } = await api.get('/chat/sessions');
            setSessions(data.sessions || []);
        } catch {}
    };

    const loadPolicies = async () => {
        try {
            const { data } = await api.get('/policy');
            setPolicies(data.policies || []);
        } catch {}
    };

    const pickEnglishFemaleVoice = () => {
        const voices = window.speechSynthesis?.getVoices?.() || [];
        const preferred = voices.find((v) =>
            /en/i.test(v.lang) && /(zira|female|aria|jenny|samantha|neerja|heera|hazel|susan|google uk english female|google us english)/i.test(v.name)
        );
        return preferred || voices.find((v) => /^en/i.test(v.lang)) || null;
    };

    const speakResponse = (spokenText) => {
        if (!voiceEnabled || !spokenText || typeof window === 'undefined' || !window.speechSynthesis) {
            setAvatarState('idle');
            setMouthLevel(0);
            return;
        }
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(spokenText);
        utter.lang = 'en-IN';
        utter.pitch = 1.08;
        utter.rate = 1.02;
        const femaleVoice = pickEnglishFemaleVoice();
        if (femaleVoice) utter.voice = femaleVoice;

        utter.onstart = () => {
            setAvatarState('speaking');
            clearInterval(pulseTimerRef.current);
            pulseTimerRef.current = setInterval(() => {
                setMouthLevel(0.45 + Math.random() * 0.55);
            }, 95);
        };
        utter.onboundary = () => {
            setMouthLevel(0.85);
        };
        utter.onend = () => {
            clearInterval(pulseTimerRef.current);
            setMouthLevel(0);
            setAvatarState('idle');
        };
        utter.onerror = () => {
            clearInterval(pulseTimerRef.current);
            setMouthLevel(0);
            setAvatarState('idle');
        };

        window.speechSynthesis.speak(utter);
    };

    const loadSessionHistory = async (sid) => {
        try {
            const { data } = await api.get(`/chat/history?sessionId=${sid}`);
            const formatted = (data.messages || []).flatMap((m) => [
                { role: 'user', content: m.message, timestamp: m.timestamp },
                {
                    role: 'ai',
                    content: m.aiResponse,
                    timestamp: m.timestamp,
                    model: m.model,
                    mode: m.metadata?.mode,
                    comparisonCards: m.metadata?.comparisonCards || [],
                    bestVerdict: m.metadata?.bestVerdict || '',
                    citations: m.metadata?.citations || [],
                    sources: m.metadata?.sources || [],
                    searchEngine: m.metadata?.searchEngine || '',
                },
            ]);
            setMessages(formatted);
            setSessionId(sid);
        } catch {
            toast.error('Failed to load chat history');
        }
    };

    const startNewSession = () => {
        window.speechSynthesis?.cancel();
        setAvatarState('idle');
        setMessages([]);
        setSessionId(null);
    };

    const toggleVoiceInput = () => {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            toast.error('Browser voice mic is unavailable here — type your message below!');
            return;
        }
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            setAvatarState('idle');
            return;
        }

        const rec = new SpeechRec();
        rec.lang = 'en-IN';
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        recognitionRef.current = rec;

        rec.onstart = () => {
            setIsListening(true);
            setAvatarState('listening');
        };
        rec.onresult = (e) => {
            const transcript = e.results?.[0]?.[0]?.transcript || '';
            setIsListening(false);
            if (transcript.trim()) {
                handleSend(transcript.trim());
            } else {
                setAvatarState('idle');
            }
        };
        rec.onerror = () => {
            setIsListening(false);
            setAvatarState('idle');
            toast.error('Mic capture interrupted — try typing or speaking again.');
        };
        rec.onend = () => setIsListening(false);
        rec.start();
    };

    const handleSend = async (overrideText = null) => {
        const userMsg = (overrideText !== null ? overrideText : input).trim();
        if (!userMsg || loading) return;
        if (overrideText === null) setInput('');
        setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);
        setAvatarState('researching');

        try {
            const { data } = await api.post('/parinidhi/chat', {
                message: userMsg,
                policyId: selectedPolicyId || undefined,
                sessionId: sessionId || undefined,
                mode,
            });

            setSessionId(data.sessionId);
            setMessages((prev) => [
                ...prev,
                {
                    role: 'ai',
                    content: data.aiResponse,
                    model: data.model,
                    mode: data.mode,
                    comparisonCards: data.comparisonCards || [],
                    bestVerdict: data.bestVerdict || '',
                    sources: data.sources || [],
                    citations: data.citations || [],
                    searchEngine: data.searchEngine,
                    responseTime: data.responseTimeMs,
                },
            ]);
            speakResponse(data.spokenSummary || data.aiResponse);
            loadSessions();
        } catch (err) {
            setAvatarState('idle');
            toast.error(err.response?.data?.error || 'Parinidhi encountered an error');
            setMessages((prev) => [
                ...prev,
                { role: 'ai', content: 'Sorry, I encountered an error reaching the AI engine. Please try again.' },
            ]);
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
        <div className="parinidhi-layout">
            {/* Left Panel: 3D Parinidhi Avatar + Session History */}
            <div className="parinidhi-sidebar">
                <div style={{ padding: 14, borderBottom: '1px solid var(--border-color)' }}>
                    <ParinidhiAvatar3D state={avatarState} mouthLevel={mouthLevel} height={210} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button
                            className={`btn btn-sm ${isListening ? 'btn-danger' : 'btn-primary'}`}
                            style={{ flex: 1 }}
                            onClick={toggleVoiceInput}
                            disabled={loading}
                        >
                            {isListening ? <><MicOff size={14} /> Stop Mic</> : <><Mic size={14} /> Speak</>}
                        </button>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                                if (voiceEnabled) window.speechSynthesis?.cancel();
                                setVoiceEnabled(!voiceEnabled);
                            }}
                            title={voiceEnabled ? 'Mute Voice Output' : 'Enable Voice Output'}
                        >
                            {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={startNewSession} title="New Chat">
                            <Plus size={14} />
                        </button>
                    </div>
                </div>

                {/* Context Selector */}
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                        Optional Policy Context
                    </label>
                    <select
                        className="form-input"
                        style={{ padding: '6px 10px', fontSize: 12, marginBottom: 8 }}
                        value={selectedPolicyId}
                        onChange={(e) => setSelectedPolicyId(e.target.value)}
                    >
                        <option value="">General + Live Research Mode</option>
                        {policies.map((p) => (
                            <option key={p._id} value={p._id}>
                                {p.providerName} (#{p.policyNumber})
                            </option>
                        ))}
                    </select>
                    <div style={{ display: 'flex', gap: 4 }}>
                        {[
                            { key: 'auto', label: 'Auto' },
                            { key: 'research', label: 'Live Compare' },
                            { key: 'general', label: 'General' },
                        ].map((m) => (
                            <button
                                key={m.key}
                                className={`btn btn-sm ${mode === m.key ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ flex: 1, fontSize: 11, padding: '4px 6px' }}
                                onClick={() => setMode(m.key)}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* History */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '4px 6px' }}>
                        Recent Sessions
                    </div>
                    {sessions.map((s) => (
                        <button
                            key={s.sessionId}
                            onClick={() => loadSessionHistory(s.sessionId)}
                            style={{
                                fontSize: 12, display: 'flex', alignItems: 'flex-start', padding: 10, borderRadius: 10,
                                border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 4,
                                background: sessionId === s.sessionId ? 'rgba(236,72,153,0.12)' : 'transparent',
                                color: 'var(--text-primary)',
                            }}
                        >
                            <MessageSquare size={14} style={{ marginTop: 2, marginRight: 8, color: 'var(--accent-primary)' }} />
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                                    {s.lastMessage}
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Clock size={10} /> {s.messageCount} msgs
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Right Panel: Conversation + Live Policy Research Cards */}
            <div className="chat-container" style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius-lg)', overflow: 'hidden',
            }}>
                <div className="chat-header" style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="stat-icon purple" style={{ width: 38, height: 38 }}>
                            <Sparkles size={18} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Parinidhi AI — Voice & Live Research Agent</h3>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Context Q&A · General Chat · Live Tavily + Serper Policy Comparison
                            </span>
                        </div>
                    </div>
                </div>

                <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {messages.length === 0 && (
                        <div className="empty-state" style={{ margin: 'auto', textAlign: 'center', maxWidth: 560 }}>
                            <Sparkles size={42} style={{ color: 'var(--accent-primary)', marginBottom: 12 }} />
                            <h3>Hello, I am Parinidhi</h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 18 }}>
                                Talk with me via voice or text! Ask about your uploaded policy clauses, general questions, or ask me to research & compare live health/motor insurance plans.
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                                {[
                                    'List top family health insurance policies in India and compare best coverage',
                                    'Compare Star Health Assure vs HDFC ERGO Optima Secure for room rent and restoration',
                                    'Explain the IRDAI 60-month PED moratorium and 3-hour cashless discharge rule',
                                ].map((q) => (
                                    <button key={q} className="btn btn-secondary btn-sm" onClick={() => handleSend(q)}>
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div key={i} style={{ display: 'flex', gap: 14, flexDirection: msg.role === 'ai' ? 'row' : 'row-reverse' }}>
                            <div style={{
                                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: msg.role === 'ai' ? 'var(--accent-gradient)' : 'rgba(15,23,42,0.08)',
                                color: msg.role === 'ai' ? '#fff' : 'var(--text-primary)',
                            }}>
                                {msg.role === 'ai' ? <Sparkles size={16} /> : <User size={16} />}
                            </div>
                            <div style={{ flex: 1, maxWidth: '88%', display: 'flex', flexDirection: 'column', alignItems: msg.role === 'ai' ? 'flex-start' : 'flex-end' }}>
                                <div style={{
                                    background: msg.role === 'ai' ? 'rgba(255,255,255,0.85)' : 'var(--accent-gradient)',
                                    color: msg.role === 'ai' ? 'var(--text-primary)' : '#fff',
                                    border: msg.role === 'ai' ? '1px solid var(--border-color)' : 'none',
                                    padding: '12px 16px',
                                    borderRadius: 14,
                                    whiteSpace: 'pre-wrap',
                                    lineHeight: 1.65,
                                    fontSize: 14,
                                    width: msg.comparisonCards?.length ? '100%' : 'auto',
                                }}>
                                    {msg.content}

                                    {/* Policy Comparison Cards from Live Search */}
                                    {msg.comparisonCards?.length > 0 && (
                                        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                                            {msg.comparisonCards.map((card, cIdx) => (
                                                <div key={cIdx} style={{ background: '#fff5fa', border: '1px solid var(--border-color)', borderRadius: 12, padding: 12 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                        <strong style={{ fontSize: 13 }}>{card.planName}</strong>
                                                        <span className="badge badge-success" style={{ fontSize: 10 }}>{card.fitRating || 'Match'}</span>
                                                    </div>
                                                    <div style={{ fontSize: 11, color: 'var(--accent-primary)', fontWeight: 700, marginBottom: 6 }}>{card.insurer}</div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{card.coverageHighlights}</div>
                                                    {card.waitingPeriodNote && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Waiting: {card.waitingPeriodNote}</div>}
                                                    {card.sourceUrl && (
                                                        <a href={card.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                                                            Source <ExternalLink size={10} />
                                                        </a>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {msg.bestVerdict && (
                                        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(5,150,105,0.08)', borderLeft: '4px solid var(--success)', fontSize: 13 }}>
                                            <strong>Best-Fit Verdict:</strong> {msg.bestVerdict}
                                        </div>
                                    )}

                                    {/* Policy Clause Citations */}
                                    {msg.citations?.length > 0 && (
                                        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                            {msg.citations.map((cit, ci) => (
                                                <span key={ci} className="badge" style={{ background: 'rgba(236,72,153,0.1)', color: 'var(--accent-primary)', fontSize: 11 }}>
                                                    <FileText size={10} /> Page {cit.pageNumber} · {cit.sectionTitle.slice(0, 28)}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {msg.sources?.length > 0 && (
                                        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                            <Globe size={12} /> Sources ({msg.searchEngine}):
                                            {msg.sources.slice(0, 3).map((s, si) => (
                                                <a key={si} href={s.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)' }}>
                                                    [{si + 1}] {s.title?.slice(0, 28)}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                <div className="chat-input-area" style={{ padding: '16px 22px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                    <div className="chat-input-wrapper">
                        <textarea
                            className="chat-textarea"
                            placeholder="Ask Parinidhi about your policy, live insurance plans, or press Speak..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={loading}
                            rows={1}
                        />
                        <button className="chat-send-btn" onClick={() => handleSend()} disabled={loading || !input.trim()}>
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
