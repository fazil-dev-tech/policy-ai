import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard, FileText, MessageSquare, Shield,
    BarChart3, Settings, LogOut, TrendingUp, Terminal
} from 'lucide-react';

const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/policies', label: 'Policies', icon: FileText },
    { path: '/analyzer', label: 'Content AI', icon: FileText },
    { path: '/chat', label: 'Policy Chat', icon: MessageSquare },
    { path: '/terminal', label: 'AI Terminal', icon: Terminal },
    { path: '/claims', label: 'Claims', icon: Shield },
    { path: '/market', label: 'Market', icon: TrendingUp },
];

const adminItems = [
    { path: '/admin', label: 'Admin Panel', icon: Settings },
];

export default function Sidebar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const initials = user?.name
        ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : '??';

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="logo-icon" style={{ padding: 0, overflow: 'hidden', background: 'transparent' }}>
                    <img src="/logo.png" alt="PolicyAI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div>
                    <h1>PolicyAI</h1>
                    <span>Insurance Intelligence</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                {navItems.map(({ path, label, icon: Icon }) => (
                    <NavLink
                        key={path}
                        to={path}
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
