import { useNavigate, useLocation } from 'react-router-dom';
import { Mic, Sparkles } from 'lucide-react';

export default function ParinidhiFloatingLauncher() {
    const navigate = useNavigate();
    const location = useLocation();

    if (location.pathname === '/terminal') return null;

    return (
        <button
            onClick={() => navigate('/terminal')}
            title="Talk with Parinidhi AI (3D Voice & Policy Research)"
            style={{
                position: 'fixed',
                bottom: 22,
                right: 22,
                zIndex: 90,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 999,
                border: '1px solid var(--border-glow)',
                background: 'var(--accent-gradient)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: 'var(--accent-glow)',
            }}
        >
            <Mic size={16} />
            <span>Ask Parinidhi</span>
            <Sparkles size={14} />
        </button>
    );
}
