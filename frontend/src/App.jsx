import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import PolicyPage from './pages/PolicyPage';
import ChatPage from './pages/ChatPage';
import ClaimsPage from './pages/ClaimsPage';
import AdminPage from './pages/AdminPage';
import MarketPage from './pages/MarketPage';
import GlobalChatPage from './pages/GlobalChatPage';
import AnalyzerPage from './pages/AnalyzerPage';

const ProtectedRoute = ({ children, adminOnly = false }) => {
    const { user, loading } = useAuth();
    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
    if (!user) return <Navigate to="/login" replace />;
    if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
    return children;
};

function App() {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="loading-spinner"><div className="spinner" /></div>;
    }

    return (
        <>
            {user ? (
                <div className="app-layout">
                    <Sidebar />
                    <main className="main-content">
                        <Routes>
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                            <Route path="/policies" element={<ProtectedRoute><PolicyPage /></ProtectedRoute>} />
                            <Route path="/analyzer" element={<ProtectedRoute><AnalyzerPage /></ProtectedRoute>} />
                            <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
                            <Route path="/terminal" element={<ProtectedRoute><GlobalChatPage /></ProtectedRoute>} />
                            <Route path="/claims" element={<ProtectedRoute><ClaimsPage /></ProtectedRoute>} />
                            <Route path="/market" element={<ProtectedRoute><MarketPage /></ProtectedRoute>} />
                            <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
                            <Route path="*" element={<Navigate to="/dashboard" replace />} />
                        </Routes>
                    </main>
                </div>
            ) : (
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            )}
        </>
    );
}

export default App;
