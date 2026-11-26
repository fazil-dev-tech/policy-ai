import { useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ParinidhiFloatingLauncher from './components/ParinidhiFloatingLauncher';

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
    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!user) return <Navigate to="/login" replace />;
    if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
    return children;
};

function App() {
    const { user, loading } = useAuth();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    if (loading) {
        return <div className="loading-spinner"><div className="spinner" /></div>;
    }

    return (
        <>
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
                            <img src="/logo.png" alt="PolicyGuard AI" />
                            <span>PolicyGuard AI</span>
                        </div>
                    </header>
                    {mobileNavOpen && (
                        <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />
                    )}
                    <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
                    <main className="main-content">
                        <Suspense fallback={<div className="loading-spinner"><div className="spinner" /></div>}>
                            <Routes>
                                <Route path="/" element={<Navigate to="/dashboard" replace />} />
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
                    </main>
                    <ParinidhiFloatingLauncher />
                </div>
            ) : (
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            )}
        </>
    );
}

export default App;
