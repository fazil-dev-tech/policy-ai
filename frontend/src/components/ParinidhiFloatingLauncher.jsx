import { useNavigate, useLocation } from 'react-router-dom';
import { Mic, Sparkles } from 'lucide-react';

export default function ParinidhiFloatingLauncher() {
    const navigate = useNavigate();
    const location = useLocation();

    if (['/terminal', '/chat'].includes(location.pathname)) return null;

    return (
        <button
            type="button"
            className="parinidhi-fab"
            onClick={() => navigate('/terminal')}
            title="Ask Parinidhi AI (3D Voice & Policy Research)"
            aria-label="Ask Parinidhi AI Voice Advisor"
        >
            <span className="parinidhi-fab-pulse" aria-hidden="true" />
            <Mic size={16} />
            <span className="parinidhi-fab-label">Ask Parinidhi</span>
            <Sparkles size={14} />
        </button>
    );
}
