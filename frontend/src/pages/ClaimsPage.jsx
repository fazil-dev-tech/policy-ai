import { useState, useEffect } from 'react';
import api from '../services/api';
import { Shield, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ClaimsPage() {
    const [policies, setPolicies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPolicyId, setSelectedPolicyId] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const policiesRes = await api.get('/policy');
            setPolicies(policiesRes.data.policies || []);
        } catch (err) {
            toast.error('Failed to load policies');
        } finally {
            setLoading(false);
        }
    };

    const formatAiGuidance = (content) => {
        if (!content) return 'Data not available';
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) return content.join(', ');
        if (typeof content === 'object') {
            return Object.entries(content).map(([k, v]) => `${k}: ${v}`).join(' | ');
        }
        return String(content);
    };

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

    const activePolicy = policies.find(p => p._id === selectedPolicyId);

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <div>
                    <h1>Policy Claim Guidelines</h1>
                    <p>Select your uploaded policy to view extracted AI claim rules and exclusions.</p>
                </div>
            </div>

            <div className="card" style={{ padding: 24, marginBottom: 24 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Select Policy</label>
                    <select
                        className="form-input"
                        value={selectedPolicyId}
                        onChange={(e) => setSelectedPolicyId(e.target.value)}
                        style={{ maxWidth: 500 }}
                    >
                        <option value="">Choose a policy to view guidelines...</option>
                        {policies.filter(p => p.status === 'active').map(p => (
                            <option key={p._id} value={p._id}>
                                {p.providerName} - {p.policyNumber} (₹{p.coverageAmount?.toLocaleString()})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {selectedPolicyId && activePolicy && (
                <div className="card" style={{ border: '1px solid var(--accent-primary)', boxShadow: '0 8px 30px rgba(139, 92, 246, 0.1)' }}>
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Shield size={20} className="text-primary" style={{ color: 'var(--accent-primary)' }} />
                            <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Dynamic Policy Guidelines</h3>
                        </div>

                        {/* Contract & Helpline Badges */}
                        <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <FileText size={14} /> Req ID #{activePolicy.policyNumber}
                            </div>
                            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', color: 'var(--success)', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                                🤖 AI Helpline: {activePolicy.aiSummary?.helplineNumber || 'Re-upload PDF to Extract'}
                            </div>
                        </div>
                    </div>

                    <div style={{ padding: 24 }}>
                        {activePolicy.aiSummary?.claimProcedure ? (
                            <>
                                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
                                    Based on your uploaded policy document, the AI extracted the following crucial rules regarding filing a claim. <strong>We do not process claims on this platform; please use these guidelines when contacting your provider directly.</strong>
                                </p>

                                <div style={{ fontSize: 14, lineHeight: 1.7, padding: 16, background: 'rgba(139, 92, 246, 0.05)', borderRadius: 8, borderLeft: '4px solid var(--accent-primary)', marginBottom: 16 }}>
                                    <strong style={{ color: 'var(--accent-primary)', fontSize: 15 }}>How to Claim:</strong><br /><br />
                                    {formatAiGuidance(activePolicy.aiSummary.claimProcedure)}
                                </div>

                                {activePolicy.aiSummary.exclusions && (
                                    <div style={{ fontSize: 14, lineHeight: 1.7, padding: 16, background: 'rgba(239, 68, 68, 0.05)', borderRadius: 8, borderLeft: '4px solid var(--danger)', marginBottom: 16 }}>
                                        <strong style={{ color: 'var(--danger)', fontSize: 15 }}>Exclusions (What NOT To Claim):</strong><br /><br />
                                        {formatAiGuidance(activePolicy.aiSummary.exclusions)}
                                    </div>
                                )}

                                <div style={{ fontSize: 14, lineHeight: 1.7, padding: 16, background: 'rgba(16, 185, 129, 0.05)', borderRadius: 8, borderLeft: '4px solid var(--success)' }}>
                                    <strong style={{ color: 'var(--success)', fontSize: 15 }}>Required Documents:</strong><br /><br />
                                    {formatAiGuidance(activePolicy.aiSummary.requiredDocuments)}
                                </div>
                            </>
                        ) : (
                            <div className="empty-state" style={{ padding: 40 }}>
                                <Shield size={48} style={{ opacity: 0.5, marginBottom: 16 }} />
                                <h3>No AI Evaluation Found</h3>
                                <p>This policy has not been fully evaluated by the AI engine yet. Upload a valid PDF to extract claim procedures.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
