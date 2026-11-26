import { useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { MotionConfig, motion } from 'framer-motion';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ParinidhiFloatingLauncher from './components/ParinidhiFloatingLauncher';
import { ScrollProgressBar } from './components/shared/MotionPrimitives';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const PolicyPage = lazy(() => import('./pages/PolicyPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const ClaimsPage = lazy(() => import('./pages/ClaimsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const MarketPage = lazy(() => import('./pages/MarketPage'));
const GlobalChatPage = lazy(() => import('./pages/GlobalChatPage'));
const AnalyzerPage = lazy(() => import('./pages/AnalyzerPage'));
const BrowserShieldPage = lazy(() => import('./pages/BrowserShieldPage'));
const FamilyVaultPage = lazy(() => import('./pages/FamilyVaultPage'));

const ProtectedRoute = ({ children, adminOnly = false }) => {
    const { user, loading } = useAuth();
    const location = useLocation();
    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!user) {
        const redirectTarget = `${location.pathname || ''}${location.search || ''}`;
        return <Navigate to="/login" state={{ from: redirectTarget }} replace />;
    }
    if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
    return children;
};

const UnauthRedirect = () => {
    const location = useLocation();
    const redirectTarget = `${location.pathname || ''}${location.search || ''}`;
    return <Navigate to="/login" state={{ from: redirectTarget }} replace />;
};

const AuthSuccessRedirect = () => {
    const location = useLocation();
    const rawFrom = location.state?.from;
    const target =
        typeof rawFrom === 'string' &&
        rawFrom.startsWith('/') &&
        !rawFrom.startsWith('//') &&
        rawFrom !== '/login' &&
        rawFrom !== '/register'
            ? rawFrom
            : '/dashboard';
    return <Navigate to={target} replace />;
};

function App() {
    const { user, loading } = useAuth();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const location = useLocation();

    if (loading) {
        return <div className="loading-spinner"><div className="spinner" /></div>;
    }

    return (
        <MotionConfig reducedMotion="user">
            <ScrollProgressBar />
            {user ? (
                <div className="app-layout">
                    <header className="mobile-topbar">
                        <button
                            type="button"
                            className="mobile-menu-btn"
                            aria-label="Toggle navigation menu"
                            onClick={() => setMobileNavOpen((prev) => !prev)}
                        >
                            <Menu size={20} />
                        </button>
                        <div className="mobile-brand">
                            <span className="mobile-brand-badge">
                                <img src="/logo.png" alt="PolicyGuard AI" />
                            </span>
                            <span>PolicyGuard AI</span>
                        </div>
                    </header>
                    {mobileNavOpen && (
                        <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />
                    )}
                    <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
                    <main className="main-content">
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <Suspense fallback={<div className="loading-spinner"><div className="spinner" /></div>}>
                                <Routes>
                                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                                    <Route path="/login" element={<AuthSuccessRedirect />} />
                                    <Route path="/register" element={<AuthSuccessRedirect />} />
                                    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                                    <Route path="/policies" element={<ProtectedRoute><PolicyPage /></ProtectedRoute>} />
                                    <Route path="/analyzer" element={<ProtectedRoute><AnalyzerPage /></ProtectedRoute>} />
                                    <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
                                    <Route path="/terminal" element={<ProtectedRoute><GlobalChatPage /></ProtectedRoute>} />
                                    <Route path="/claims" element={<ProtectedRoute><ClaimsPage /></ProtectedRoute>} />
                                    <Route path="/shield" element={<ProtectedRoute><BrowserShieldPage /></ProtectedRoute>} />
                                    <Route path="/family" element={<ProtectedRoute><FamilyVaultPage /></ProtectedRoute>} />
                                    <Route path="/market" element={<ProtectedRoute><MarketPage /></ProtectedRoute>} />
                                    <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
                                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                                </Routes>
                            </Suspense>
                        </motion.div>
                    </main>
                    <ParinidhiFloatingLauncher />
                </div>
            ) : (
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="*" element={<UnauthRedirect />} />
                </Routes>
            )}
        </MotionConfig>
    );
}

export default App;
