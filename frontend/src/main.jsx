import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <App />
                <Toaster
                    position="top-right"
                    toastOptions={{
                        style: {
                            background: '#ffffff',
                            color: '#0f172a',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 10px 25px rgba(15, 23, 42, 0.08)',
                            borderRadius: '12px',
                            fontSize: '13.5px',
                            fontWeight: 500,
                        },
                        success: {
                            iconTheme: { primary: '#059669', secondary: '#ffffff' },
                        },
                        error: {
                            iconTheme: { primary: '#dc2626', secondary: '#ffffff' },
                        },
                    }}
                />
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>
);
