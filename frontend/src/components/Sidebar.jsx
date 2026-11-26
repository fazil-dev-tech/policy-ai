import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard, FileText, FileSearch, MessageSquare, Shield,
    Settings, LogOut, TrendingUp, Sparkles, ShieldAlert, Users, X
} from 'lucide-react';

const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/policies', label: 'Policies', icon: FileText },
    { path: '/analyzer', label: 'Document AI', icon: FileSearch },
    { path: '/chat', label: 'Policy Chat', icon: MessageSquare },
    { path: '/terminal', label: 'Parinidhi AI', icon: Sparkles },
    { path: '/claims', label: 'Claims', icon: Shield },
    { path: '/shield', label: 'Browser Shield', icon: ShieldAlert },
    { path: '/family', label: 'Family & SOS', icon: Users },
    { path: '/market', label: 'Market', icon: TrendingUp },
];

const adminItems = [
    { path: '/admin', label: 'Admin Panel', icon: Settings },
];

export default function Sidebar({ mobileOpen = false, onClose = () => {} }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        onClose();
        await logout();
        navigate('/login', { replace: true });
    };

    const initials = user?.name
        ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : '??';

    return (
        <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
            <div className="sidebar-logo">
                <div className="logo-icon" style={{ padding: 0, overflow: 'hidden', background: 'transparent' }}>
                    <img src="/logo.png" alt="PolicyGuard AI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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

            <nav className="sidebar-nav">
                {navItems.map(({ path, label, icon: Icon }) => (
                    <NavLink
                        key={path}
                        to={path}
                        onClick={onClose}
                        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    >
                        <Icon />
                        {label}
                    </NavLink>
                ))}

                {user?.role === 'admin' && (
                    <>
                        <div style={{ height: 1, background: 'var(--border-color)', margin: '12px 0' }} />
                        {adminItems.map(({ path, label, icon: Icon }) => (
                            <NavLink
                                key={path}
                                to={path}
                                onClick={onClose}
                                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                            >
                                <Icon />
                                {label}
                            </NavLink>
                        ))}
                    </>
                )}
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-user">
                    <div className="sidebar-avatar">{initials}</div>
                    <div className="sidebar-user-info">
                        <div className="name">{user?.name}</div>
                        <div className="role">{user?.role}</div>
                    </div>
                </div>
                <button
                    className="sidebar-link"
                    onClick={handleLogout}
                    style={{ marginTop: 8, color: 'var(--danger)' }}
                >
                    <LogOut />
                    Logout
                </button>
            </div>
        </aside>
    );
}
