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
            title="Talk with Parinidhi AI (3D Voice & Policy Research)"
            aria-label="Open Parinidhi AI Voice Advisor"
        >
            <Mic size={16} />
            <span className="parinidhi-fab-label">Ask Parinidhi</span>
            <Sparkles size={14} />
        </button>
    );
}
