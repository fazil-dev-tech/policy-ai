import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import ParinidhiAvatar3D from '../components/ParinidhiAvatar3D';
import {
    Send, Mic, MicOff, Volume2, VolumeX, User, Plus,
    MessageSquare, Clock, Globe, Sparkles, FileText, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';

const LANGUAGE_OPTIONS = [
    { label: 'English', langCode: 'en-IN' },
    { label: 'Hindi', langCode: 'hi-IN' },
    { label: 'Tamil', langCode: 'ta-IN' },
    { label: 'Telugu', langCode: 'te-IN' },
    { label: 'Kannada', langCode: 'kn-IN' },
    { label: 'Malayalam', langCode: 'ml-IN' },
    { label: 'Bengali', langCode: 'bn-IN' },
    { label: 'Marathi', langCode: 'mr-IN' },
];

function MarkdownText({ content }) {
    if (!content) return null;
    const lines = String(content).split('\n');
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

    lines.forEach((line) => {
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

export default function GlobalChatPage() {
    const [searchParams] = useSearchParams();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState(() => sessionStorage.getItem('pg_parinidhi_session') || null);
    const [sessions, setSessions] = useState([]);
    const [policies, setPolicies] = useState([]);
    const [selectedPolicyId, setSelectedPolicyId] = useState(searchParams.get('policyId') || '');
    const [mode, setMode] = useState('auto');
    const [language, setLanguage] = useState('English');

    // Voice & 3D Avatar states
    const [avatarState, setAvatarState] = useState('idle');
    const [mouthLevel, setMouthLevel] = useState(0);
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [isListening, setIsListening] = useState(false);

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const pulseTimerRef = useRef(null);
    const textareaRef = useRef(null);
    const mountedRef = useRef(true);
    const handleSendRef = useRef(null);

    useEffect(() => {
        mountedRef.current = true;
        loadSessions();
        loadPolicies();
        const urlPolicy = searchParams.get('policyId');
        const urlPrompt = searchParams.get('q');
        if (urlPolicy) setSelectedPolicyId(urlPolicy);
        if (urlPrompt) setInput(urlPrompt);
        const savedSid = sessionStorage.getItem('pg_parinidhi_session');
        if (savedSid) loadSessionHistory(savedSid);

        const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
        const onVoicesChanged = () => { synth?.getVoices?.(); };
        synth?.addEventListener?.('voiceschanged', onVoicesChanged);

        return () => {
            mountedRef.current = false;
            synth?.removeEventListener?.('voiceschanged', onVoicesChanged);
            synth?.cancel();
            try { recognitionRef.current?.stop(); } catch {}
            clearInterval(pulseTimerRef.current);
        };
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadSessions = async () => {
        try {
            const { data } = await api.get('/chat/sessions?agent=parinidhi');
            if (mountedRef.current) setSessions(data.sessions || []);
        } catch {}
    };

    const loadPolicies = async () => {
        try {
            const { data } = await api.get('/policy?limit=50');
            if (mountedRef.current) setPolicies(data.policies || []);
        } catch {}
    };

    const pickEnglishFemaleVoice = (langCode = 'en-IN') => {
        const voices = window.speechSynthesis?.getVoices?.() || [];
        const baseLang = langCode.split('-')[0];
        if (baseLang !== 'en') {
            const localVoice = voices.find((v) => v.lang?.toLowerCase().startsWith(baseLang));
            if (localVoice) return localVoice;
        }
        const preferred = voices.find((v) =>
            /en/i.test(v.lang) && /(zira|female|aria|jenny|samantha|neerja|heera|hazel|susan|google uk english female|google us english)/i.test(v.name)
        );
        return preferred || voices.find((v) => /^en/i.test(v.lang)) || null;
    };

    const speakResponse = (spokenText) => {
        if (!voiceEnabled || !spokenText || typeof window === 'undefined' || !window.speechSynthesis) {
            if (mountedRef.current) {
                setAvatarState('idle');
                setMouthLevel(0);
            }
            return;
        }
        const langMeta = LANGUAGE_OPTIONS.find((l) => l.label === language) || LANGUAGE_OPTIONS[0];
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(spokenText);
        utter.lang = langMeta.langCode;
        utter.pitch = 1.08;
        utter.rate = 1.02;
        const chosenVoice = pickEnglishFemaleVoice(langMeta.langCode);
        if (chosenVoice) utter.voice = chosenVoice;

        utter.onstart = () => {
            if (!mountedRef.current) return;
            setAvatarState('speaking');
            clearInterval(pulseTimerRef.current);
            pulseTimerRef.current = setInterval(() => {
                if (mountedRef.current) setMouthLevel(0.45 + Math.random() * 0.55);
            }, 95);
        };
        utter.onboundary = () => {
            if (mountedRef.current) setMouthLevel(0.85);
        };
        utter.onend = () => {
            clearInterval(pulseTimerRef.current);
            if (!mountedRef.current) return;
            setMouthLevel(0);
            setAvatarState('idle');
        };
        utter.onerror = () => {
            clearInterval(pulseTimerRef.current);
            if (!mountedRef.current) return;
            setMouthLevel(0);
            setAvatarState('idle');
        };

        window.speechSynthesis.speak(utter);
    };

    const loadSessionHistory = async (sid) => {
        try {
            const { data } = await api.get(`/chat/history?sessionId=${sid}`);
            const msgs = data.messages || [];
            const formatted = msgs.flatMap((m) => [
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
            sessionStorage.setItem('pg_parinidhi_session', sid);
            if (!searchParams.get('policyId')) {
                const sessionPolicyId = msgs.find((m) => m.policyId)?.policyId || '';
                setSelectedPolicyId(sessionPolicyId);
            }
        } catch {
            toast.error('Failed to load chat history');
        }
    };

    const startNewSession = () => {
        window.speechSynthesis?.cancel();
        clearInterval(pulseTimerRef.current);
        setMouthLevel(0);
        setAvatarState('idle');
        setMessages([]);
        setSessionId(null);
        sessionStorage.removeItem('pg_parinidhi_session');
    };

    const toggleVoiceInput = () => {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            toast.error('Browser voice mic is unavailable here — type your message below!');
            return;
        }
        if (isListening) {
            try { recognitionRef.current?.stop(); } catch {}
            setIsListening(false);
            setAvatarState('idle');
            return;
        }

        const langMeta = LANGUAGE_OPTIONS.find((l) => l.label === language) || LANGUAGE_OPTIONS[0];
        const rec = new SpeechRec();
        rec.lang = langMeta.langCode;
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        recognitionRef.current = rec;

        rec.onstart = () => {
            if (!mountedRef.current) return;
            setIsListening(true);
            setAvatarState('listening');
        };
        rec.onresult = (e) => {
            const transcript = e.results?.[0]?.[0]?.transcript || '';
            if (!mountedRef.current) return;
            setIsListening(false);
            if (transcript.trim()) {
                handleSendRef.current?.(transcript.trim());
            } else {
                setAvatarState('idle');
            }
        };
        rec.onerror = () => {
            if (!mountedRef.current) return;
            setIsListening(false);
            setAvatarState('idle');
            toast.error('Mic capture interrupted — try typing or speaking again.');
        };
        rec.onend = () => {
            if (mountedRef.current) setIsListening(false);
        };
        try {
            rec.start();
        } catch {
            setIsListening(false);
            setAvatarState('idle');
            toast.error('Unable to start microphone capture.');
        }
    };

    const handleSend = async (overrideText = null) => {
        const userMsg = (overrideText !== null ? overrideText : input).trim();
        if (!userMsg || loading) return;
        if (overrideText === null) {
            setInput('');
            if (textareaRef.current) textareaRef.current.style.height = 'auto';
        }
        setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);
        setAvatarState('researching');

        try {
            const { data } = await api.post('/parinidhi/chat', {
                message: userMsg,
                policyId: selectedPolicyId || undefined,
                sessionId: sessionId || undefined,
                mode,
                language,
            });

            if (!mountedRef.current) return;
            setSessionId(data.sessionId);
            if (data.sessionId) sessionStorage.setItem('pg_parinidhi_session', data.sessionId);
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
            if (!mountedRef.current) return;
            setAvatarState('idle');
            toast.error(err.response?.data?.error || 'Parinidhi encountered an error');
            setMessages((prev) => [
                ...prev,
                { role: 'ai', content: 'Sorry, I encountered an error reaching the AI engine. Please try again.' },
            ]);
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    };

    handleSendRef.current = handleSend;

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const autoGrow = (e) => {
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 140) + 'px';
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
                                if (voiceEnabled) {
                                    window.speechSynthesis?.cancel();
                                    clearInterval(pulseTimerRef.current);
                                    setMouthLevel(0);
                                    setAvatarState('idle');
                                }
                                setVoiceEnabled(!voiceEnabled);
                            }}
                            title={voiceEnabled ? 'Mute Voice Output' : 'Enable Voice Output'}
                            aria-label={voiceEnabled ? 'Mute Voice Output' : 'Enable Voice Output'}
                        >
                            {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={startNewSession} title="New Chat" aria-label="New Chat">
                            <Plus size={14} />
                        </button>
                    </div>
                </div>

                {/* Context & Language Selector */}
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                        Optional Policy Context &amp; Language
                    </label>
                    <select
                        className="form-input"
                        style={{ padding: '6px 10px', fontSize: 12, marginBottom: 6 }}
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
                    <select
                        className="form-input"
                        style={{ padding: '6px 10px', fontSize: 12, marginBottom: 8 }}
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        aria-label="Response language"
                    >
                        {LANGUAGE_OPTIONS.map((l) => (
                            <option key={l.label} value={l.label}>Language: {l.label}</option>
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
                                    whiteSpace: msg.role === 'ai' ? 'normal' : 'pre-wrap',
                                    lineHeight: 1.65,
                                    fontSize: 14,
                                    width: msg.comparisonCards?.length ? '100%' : 'auto',
                                }}>
                                    {msg.role === 'ai' ? <MarkdownText content={msg.content} /> : msg.content}

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
                                                    {card.sourceUrl && /^https?:\/\//i.test(String(card.sourceUrl)) && (
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
                                                    <FileText size={10} /> Page {cit.pageNumber || 1} · {(cit.sectionTitle || 'Policy Clause').slice(0, 28)}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {msg.sources?.length > 0 && (
                                        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                            <Globe size={12} /> Sources ({msg.searchEngine}):
                                            {msg.sources.slice(0, 3).map((s, si) => {
                                                const safeHref = /^https?:\/\//i.test(String(s.url || '')) ? s.url : null;
                                                return safeHref ? (
                                                    <a key={si} href={safeHref} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)' }}>
                                                        [{si + 1}] {s.title?.slice(0, 28)}
                                                    </a>
                                                ) : (
                                                    <span key={si}>[{si + 1}] {s.title?.slice(0, 28)}</span>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div style={{ display: 'flex', gap: 14 }}>
                            <div style={{
                                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'var(--accent-gradient)', color: '#fff',
                            }}>
                                <Sparkles size={16} />
                            </div>
                            <div className="msg-bubble ai" style={{ padding: '10px 14px', borderRadius: 14, border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.85)' }}>
                                <div className="typing-indicator"><span /><span /><span /></div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="chat-input-area" style={{ padding: '16px 22px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                    <div className="chat-input-wrapper">
                        <textarea
                            ref={textareaRef}
                            className="chat-textarea"
                            placeholder="Ask Parinidhi about your policy, live insurance plans, or press Speak..."
                            value={input}
                            onChange={(e) => { setInput(e.target.value); autoGrow(e); }}
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
