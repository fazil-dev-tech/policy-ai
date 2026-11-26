import { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard, FileText, FileSearch, MessageSquare, Shield,
    Settings, LogOut, TrendingUp, Sparkles, ShieldAlert, Users, X
} from 'lucide-react';

const navSections = [
    {
        label: 'Overview',
        items: [
            { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { path: '/policies', label: 'Policies', icon: FileText },
        ],
    },
    {
        label: 'AI & Claims',
        items: [
            { path: '/analyzer', label: 'Document AI', icon: FileSearch },
            { path: '/chat', label: 'Policy Chat', icon: MessageSquare },
            { path: '/terminal', label: 'Parinidhi AI', icon: Sparkles },
            { path: '/claims', label: 'Claims & Motor AI', icon: Shield },
        ],
    },
    {
        label: 'Protection & Market',
        items: [
            { path: '/shield', label: 'Browser Shield', icon: ShieldAlert },
            { path: '/family', label: 'Family & SOS', icon: Users },
            { path: '/market', label: 'Market & IRDAI', icon: TrendingUp },
        ],
    },
];

const adminItems = [
    { path: '/admin', label: 'Admin Panel', icon: Settings },
];

export default function Sidebar({ mobileOpen = false, onClose = () => {} }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!mobileOpen) return undefined;
        const onKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [mobileOpen, onClose]);

    const handleLogout = async () => {
        onClose();
        try {
            sessionStorage.removeItem('pg_standard_session');
            sessionStorage.removeItem('pg_parinidhi_session');
        } catch {}
        await logout();
        navigate('/login', { replace: true });
    };

    const initials = user?.name
        ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : '??';

    return (
        <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
            <div className="sidebar-logo">
                <div className="logo-icon logo-emblem-light">
                    <img src="/logo.png" alt="PolicyGuard AI" />
                </div>
                <div style={{ flex: 1 }}>
                    <h1>PolicyGuard AI</h1>
                    <span>IRDAI Intelligence</span>
                </div>
                {mobileOpen && (
                    <button type="button" className="btn btn-secondary btn-sm mobile-close-btn" aria-label="Close navigation menu" onClick={onClose}>
                        <X size={16} />
                    </button>
                )}
            </div>

            <nav className="sidebar-nav" aria-label="Main Navigation">
                {navSections.map((section, idx) => (
                    <div key={section.label} className={idx > 0 ? 'sidebar-group' : ''}>
                        <div className="sidebar-group-label">{section.label}</div>
                        {section.items.map(({ path, label, icon: Icon }) => (
                            <NavLink
                                key={path}
                                to={path}
                                onClick={onClose}
                                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                            >
                                {({ isActive }) => (
                                    <>
                                        {isActive && (
                                            <motion.span
                                                layoutId="sidebarActivePill"
                                                className="sidebar-active-pill"
                                                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                                            />
                                        )}
                                        <span className="sidebar-link-content">
                                            <Icon />
                                            <span>{label}</span>
                                        </span>
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </div>
                ))}

                {user?.role === 'admin' && (
                    <div className="sidebar-group">
                        <div className="sidebar-group-label">Administration</div>
                        {adminItems.map(({ path, label, icon: Icon }) => (
                            <NavLink
                                key={path}
                                to={path}
                                onClick={onClose}
                                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                            >
                                {({ isActive }) => (
                                    <>
                                        {isActive && (
                                            <motion.span
                                                layoutId="sidebarActivePill"
                                                className="sidebar-active-pill"
                                                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                                            />
                                        )}
                                        <span className="sidebar-link-content">
                                            <Icon />
                                            <span>{label}</span>
                                        </span>
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </div>
                )}
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-user">
                    <div className="sidebar-avatar" style={{ position: 'relative' }}>
                        {initials}
                        <span className="sidebar-status-dot" aria-hidden="true" />
                    </div>
                    <div className="sidebar-user-info">
                        <div className="name">{user?.name}</div>
                        <div className="role">{user?.role} · Protected</div>
                    </div>
                </div>
                <button
                    type="button"
                    className="sidebar-link sidebar-logout-btn"
                    onClick={handleLogout}
                >
                    <span className="sidebar-link-content">
                        <LogOut />
                        <span>Logout</span>
                    </span>
                </button>
            </div>
        </aside>
    );
}
