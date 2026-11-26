import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Users, Plus, Trash2, PhoneCall, AlertCircle, Shield, Download } from 'lucide-react';
import toast from 'react-hot-toast';

const SOS_SCENARIOS = [
    {
        id: 'hospital',
        title: 'Medical Hospitalization',
        numbers: 'Ambulance: 108 · Emergency: 112 · IRDAI Helpline: 155255',
        steps: [
            'Present the Insured E-Card / Policy Number & Aadhaar at the TPA Cashless Desk.',
            'Ensure Pre-Auth intimation is sent within 24 hours of emergency admission.',
            'Watch the 3-Hour IRDAI Cashless Discharge SLA once final bill is submitted.',
        ],
    },
    {
        id: 'accident',
        title: 'Road Accident & Motor',
        numbers: 'Police: 112 · Highway Helpline: 1033 · Ambulance: 108',
        steps: [
            'Take clear wide + close-up exterior photos & record third-party RC/insurance if involved.',
            'Call insurer toll-free helpline before towing to generate claim intimation number.',
            'File FIR/GD entry immediately if third-party injury, theft, or major damage occurred.',
        ],
    },
    {
        id: 'scam',
        title: 'Online Renewal / UPI Scam',
        numbers: 'National Cybercrime Helpline: 1930 · cybercrime.gov.in',
        steps: [
            'Dial 1930 within 2 hours (Golden Hour) to freeze fraudulent UPI/bank rails.',
            'Uninstall any .apk file received via WhatsApp/Gmail immediately and freeze netbanking.',
            'Report phishing URL inside PolicyGuard Browser Shield for verification.',
        ],
    },
];

export default function FamilyVaultPage() {
    const navigate = useNavigate();
    const [members, setMembers] = useState([]);
    const [unassignedPolicies, setUnassignedPolicies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeSos, setActiveSos] = useState('hospital');
    const [form, setForm] = useState({ fullName: '', relationship: 'parent', bloodGroup: '', emergencyContact: '', chronicConditions: '', linkPolicyId: '' });

    useEffect(() => {
        loadVault();
    }, []);

    const loadVault = async () => {
        try {
            const { data } = await api.get('/family');
            setMembers(data.members || []);
            setUnassignedPolicies(data.unassignedPolicies || []);
        } catch {
            toast.error('Failed to load family vault');
        } finally {
            setLoading(false);
        }
    };

    const handleAddMember = async (e) => {
        e.preventDefault();
        if (!form.fullName.trim()) return;
        try {
            await api.post('/family', form);
            toast.success('Family member added to Vault!');
            setForm({ fullName: '', relationship: 'parent', bloodGroup: '', emergencyContact: '', chronicConditions: '', linkPolicyId: '' });
            loadVault();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to add member');
        }
    };

    const handleDeleteMember = async (id) => {
        try {
            await api.delete(`/family/${id}`);
            toast.success('Member removed');
            loadVault();
        } catch {
            toast.error('Delete failed');
        }
    };

    const handleLinkPolicy = async (memberId, policyId) => {
        if (!policyId) return;
        try {
            await api.post(`/family/${memberId}/link-policy`, { policyId });
            toast.success('Policy linked to family member!');
            loadVault();
        } catch {
            toast.error('Failed to link policy');
        }
    };

    const downloadEmergencyCard = async (policyId) => {
        try {
            const resp = await api.get(`/policy/${policyId}/emergency-card.pdf`, { responseType: 'blob' });
            const url = URL.createObjectURL(resp.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Emergency_Card_${policyId.slice(0, 8)}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Failed to generate Emergency Card PDF');
        }
    };

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

    const currentSos = SOS_SCENARIOS.find((s) => s.id === activeSos) || SOS_SCENARIOS[0];

    return (
        <div>
            <div className="page-header">
                <h1>Family Insurance Vault & Emergency SOS</h1>
                <p>One-tap Emergency SOS playbook + organized family members, blood groups & linked policies</p>
            </div>

            {/* Emergency SOS Console */}
            <div className="card" style={{ padding: 22, marginBottom: 24, border: '1px solid rgba(220,38,38,0.28)', background: 'rgba(254,242,242,0.55)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                    <h3 style={{ margin: 0, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AlertCircle size={18} /> 1-Tap Emergency SOS Playbook
                    </h3>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {SOS_SCENARIOS.map((s) => (
                            <button key={s.id} className={`btn btn-sm ${activeSos === s.id ? 'btn-danger' : 'btn-secondary'}`} onClick={() => setActiveSos(s.id)}>
                                {s.title}
                            </button>
                        ))}
                    </div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8, color: '#7f1d1d' }}>
                    <PhoneCall size={15} /> {currentSos.numbers}
                </div>
                <ol style={{ margin: '0 0 0 18px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    {currentSos.steps.map((st, idx) => <li key={idx}>{st}</li>)}
                </ol>
            </div>

            <div className="grid-2">
                <form className="card" style={{ padding: 20 }} onSubmit={handleAddMember}>
                    <h3 style={{ marginBottom: 12 }}><Plus size={16} /> Add Family Member</h3>
                    <input className="form-input" placeholder="Full Name" style={{ marginBottom: 8 }}
                        value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                        <select className="form-input" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })}>
                            <option value="self">Self</option>
                            <option value="spouse">Spouse</option>
                            <option value="child">Child</option>
                            <option value="parent">Parent</option>
                            <option value="in_law">In-Law</option>
                            <option value="sibling">Sibling</option>
                        </select>
                        <input className="form-input" placeholder="Blood Group (e.g. O+)" value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })} />
                    </div>
                    <input className="form-input" placeholder="Emergency Phone" style={{ marginBottom: 8 }}
                        value={form.emergencyContact} onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })} />
                    <input className="form-input" placeholder="Declared PEDs / Allergies (comma-separated)" style={{ marginBottom: 8 }}
                        value={form.chronicConditions} onChange={(e) => setForm({ ...form, chronicConditions: e.target.value })} />
                    {unassignedPolicies.length > 0 && (
                        <select className="form-input" style={{ marginBottom: 10 }} value={form.linkPolicyId} onChange={(e) => setForm({ ...form, linkPolicyId: e.target.value })}>
                            <option value="">Link an existing policy (optional)</option>
                            {unassignedPolicies.map((p) => (
                                <option key={p.id} value={p.id}>{p.provider_name} — #{p.policy_number}</option>
                            ))}
                        </select>
                    )}
                    <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>Save to Family Vault</button>
                </form>

                <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ marginBottom: 12 }}><Users size={16} /> Vault Members ({members.length})</h3>
                    {members.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {members.map((m) => (
                                <div key={m.id} style={{ padding: 12, borderRadius: 10, border: '1px solid var(--border-color)', background: '#fff' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <strong>{m.full_name}</strong> <span className="badge badge-purple">{m.relationship}</span>
                                            {m.blood_group && <span className="badge badge-danger" style={{ marginLeft: 6 }}>{m.blood_group}</span>}
                                        </div>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteMember(m.id)}><Trash2 size={13} /></button>
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                                        Emergency: {m.emergency_contact || '—'} · PEDs: {(m.chronic_conditions || []).join(', ') || 'None recorded'}
                                    </div>
                                    {(m.policies || []).map((p) => (
                                        <div key={p.id} style={{ fontSize: 12, marginTop: 6, padding: 8, background: 'var(--bg-secondary)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                            <div>
                                                <Shield size={12} /> <strong>{p.provider_name}</strong> (#{p.policy_number}) · ₹{Number(p.coverage_amount || 0).toLocaleString('en-IN')} · {p.ai_summary?.helplineNumber || 'Refer card'}
                                            </div>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/claims?policyId=${p.id}`)}>Claims</button>
                                                <button className="btn btn-primary btn-sm" onClick={() => downloadEmergencyCard(p.id)}><Download size={12} /> Card</button>
                                            </div>
                                        </div>
                                    ))}
                                    {unassignedPolicies.length > 0 && (
                                        <select className="form-input" style={{ marginTop: 8, fontSize: 11, padding: '4px 8px' }}
                                            defaultValue="" onChange={(e) => handleLinkPolicy(m.id, e.target.value)}>
                                            <option value="">+ Link unassigned policy...</option>
                                            {unassignedPolicies.map((p) => (
                                                <option key={p.id} value={p.id}>{p.provider_name} — #{p.policy_number}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state" style={{ padding: 30 }}><p>No family members added yet.</p></div>
                    )}
                </div>
            </div>
        </div>
    );
}
