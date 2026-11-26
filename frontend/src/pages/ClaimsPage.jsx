import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api, { uploadDirectToSignedStorage } from '../services/api';
import {
    Shield, FileText, Upload, Car, Calculator, Scale, Download,
    AlertTriangle, Clock, Sliders, Plus, Trash2, Sparkles, CheckSquare, Square, PhoneCall
} from 'lucide-react';
import toast from 'react-hot-toast';

const SCENARIOS = [
    { value: 'medical_claim', label: 'Medical / Hospitalization Packet (Policy + Script + X-Ray + Estimate)' },
    { value: 'motor_accident', label: 'Motor Accident Packet (Motor Policy + Damage Photos + Garage Quote)' },
    { value: 'card_only', label: 'Insurance E-Card Only (Fast Emergency Check)' },
    { value: 'settlement_audit', label: 'Settlement Shortfall / Rejection Packet' },
    { value: 'full_policy', label: 'Full Policy Pre-Check Before Admission' },
    { value: 'agent_mis_selling', label: 'Sales Brochure vs Policy Audit' },
    { value: 'renewal_diff', label: 'Renewal Comparison Check' },
];

export default function ClaimsPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [policies, setPolicies] = useState([]);
    const [vehicleBenchmarks, setVehicleBenchmarks] = useState([]);
    const [medicalBenchmarks, setMedicalBenchmarks] = useState([]);
    const [incidentsHistory, setIncidentsHistory] = useState([]);
    const [damageHistory, setDamageHistory] = useState([]);
    const [settlementHistory, setSettlementHistory] = useState([]);

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('guidelines');
    const [selectedPolicyId, setSelectedPolicyId] = useState(searchParams.get('policyId') || '');

    // Incident 7-Scenario State
    const [scenarioType, setScenarioType] = useState('medical_claim');
    const [files, setFiles] = useState([]);
    const [estimatedBill, setEstimatedBill] = useState(85000);
    const [roomRentPerDay, setRoomRentPerDay] = useState(5000);
    const [policyRoomCapPerDay, setPolicyRoomCapPerDay] = useState(5000);
    const [copayPct, setCopayPct] = useState(0);
    const [deductible, setDeductible] = useState(0);
    const [isPedRelated, setIsPedRelated] = useState(false);
    const [submittingIncident, setSubmittingIncident] = useState(false);
    const [incidentResult, setIncidentResult] = useState(null);
    const [whatIfResult, setWhatIfResult] = useState(null);

    // 3h Cashless Discharge SLA Timer + Escalation Draft
    const [dischargeSeconds, setDischargeSeconds] = useState(null);
    const [slaDraft, setSlaDraft] = useState('');

    // Vehicle Damage AI State (strictly real uploads OR explicit benchmark parts picked by user)
    const [vehicleInfo, setVehicleInfo] = useState({ make: '', model: '', year: new Date().getFullYear() - 2, idv: 500000, zeroDep: false });
    const [garageQuoteTotal, setGarageQuoteTotal] = useState(0);
    const [motorPhotos, setMotorPhotos] = useState([]);
    const [selectedManualParts, setSelectedManualParts] = useState([]);
    const [motorLoading, setMotorLoading] = useState(false);
    const [motorResult, setMotorResult] = useState(null);

    // Settlement Decoder State (real sheet OCR OR multi-line items)
    const [settlementFile, setSettlementFile] = useState(null);
    const [settlementEditedManually, setSettlementEditedManually] = useState(false);
    const [claimedAmount, setClaimedAmount] = useState(100000);
    const [approvedAmount, setApprovedAmount] = useState(82000);
    const [lineItems, setLineItems] = useState([
        { itemName: 'Room & Nursing / Consumables', claimed: 40000, approved: 30000, reason: 'Excess room/non-payable deduction' },
    ]);
    const [settlementLoading, setSettlementLoading] = useState(false);
    const [settlementResult, setSettlementResult] = useState(null);
    const [emergencyScenario, setEmergencyScenario] = useState('road_accident');

    const incidentFilesRef = useRef(null);
    const motorPhotosRef = useRef(null);
    const settlementFileRef = useRef(null);
    const whatIfTimerRef = useRef(null);

    useEffect(() => {
        loadAllData();
    }, []);

    useEffect(() => {
        const pol = policies.find((p) => p._id === selectedPolicyId);
        if (pol?.structuredTerms) {
            if (pol.structuredTerms.coPayPct !== undefined) setCopayPct(Number(pol.structuredTerms.coPayPct) || 0);
            if (pol.structuredTerms.deductible !== undefined) setDeductible(Number(pol.structuredTerms.deductible) || 0);
            if (pol.structuredTerms.roomRentPerDayCap > 0) {
                setPolicyRoomCapPerDay(Number(pol.structuredTerms.roomRentPerDayCap));
            } else if (pol.coverageAmount > 0 && pol.policyType === 'health') {
                setPolicyRoomCapPerDay(Math.round(pol.coverageAmount * 0.01));
            }
            if (pol.coverageAmount > 0 && pol.policyType === 'auto') {
                setVehicleInfo((v) => ({ ...v, idv: pol.coverageAmount, zeroDep: Boolean(pol.structuredTerms.zeroDep) }));
            }
        }
    }, [selectedPolicyId, policies]);

    useEffect(() => {
        if (dischargeSeconds === null) return;
        const id = setInterval(() => setDischargeSeconds((s) => (s !== null ? s + 1 : null)), 1000);
        return () => clearInterval(id);
    }, [dischargeSeconds !== null]);

    useEffect(() => () => clearTimeout(whatIfTimerRef.current), []);

    const loadAllData = async () => {
        try {
            const [policiesRes, benchRes, incRes, dmgRes, setRes] = await Promise.all([
                api.get('/policy?limit=50'),
                api.get('/research/benchmarks').catch(() => ({ data: { vehicleBenchmarks: [], medicalBenchmarks: [] } })),
                api.get('/incidents').catch(() => ({ data: { incidents: [] } })),
                api.get('/damage').catch(() => ({ data: { reports: [] } })),
                api.get('/settlements').catch(() => ({ data: { settlements: [] } })),
            ]);
            const list = policiesRes.data.policies || [];
            setPolicies(list);
            setVehicleBenchmarks(benchRes.data.vehicleBenchmarks || []);
            setMedicalBenchmarks(benchRes.data.medicalBenchmarks || []);
            setIncidentsHistory(incRes.data.incidents || []);
            setDamageHistory(dmgRes.data.reports || []);
            setSettlementHistory(setRes.data.settlements || []);

            const urlPolicy = searchParams.get('policyId');
            if (urlPolicy) setSelectedPolicyId(urlPolicy);
            else if (list.length > 0 && !selectedPolicyId) setSelectedPolicyId(list[0]._id);
        } catch {
            toast.error('Failed to load claims data');
        } finally {
            setLoading(false);
        }
    };

    const runWhatIf = async (overrides = {}) => {
        try {
            const payload = {
                estimatedBill: overrides.estimatedBill ?? estimatedBill,
                selectedRoomRent: overrides.roomRentPerDay ?? roomRentPerDay,
                policyRoomCap: overrides.policyRoomCapPerDay ?? policyRoomCapPerDay,
                copayPct: overrides.copayPct ?? copayPct,
                deductible: overrides.deductible ?? deductible,
                sumInsured: policies.find((p) => p._id === selectedPolicyId)?.coverageAmount || 1000000,
            };
            const { data } = await api.post('/incidents/what-if', payload);
            setWhatIfResult(data);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Live simulation failed');
        }
    };

    const debouncedWhatIf = (overrides = {}) => {
        clearTimeout(whatIfTimerRef.current);
        whatIfTimerRef.current = setTimeout(() => runWhatIf(overrides), 220);
    };

    const handleAnalyzeIncident = async (e) => {
        e.preventDefault();
        if (files.length > 8) {
            return toast.error('Maximum 8 evidence files allowed per packet');
        }
        setSubmittingIncident(true);
        try {
            const totalSize = files.reduce((s, f) => s + f.size, 0);
            let res;
            if (totalSize > 3.8 * 1024 * 1024 && files.length > 0) {
                const signedFiles = [];
                for (const f of files) signedFiles.push(await uploadDirectToSignedStorage(f, 'incidents'));
                res = await api.post('/incidents/analyze', {
                    policyId: selectedPolicyId || undefined,
                    scenarioType,
                    estimatedAmount: estimatedBill,
                    roomRentPerDay,
                    policyRoomCapPerDay,
                    copayPct,
                    deductible,
                    isPedRelated,
                    vehicleInfo,
                    signedFiles,
                });
            } else {
                const fd = new FormData();
                if (selectedPolicyId) fd.append('policyId', selectedPolicyId);
                fd.append('scenarioType', scenarioType);
                fd.append('estimatedAmount', String(estimatedBill));
                fd.append('roomRentPerDay', String(roomRentPerDay));
                fd.append('policyRoomCapPerDay', String(policyRoomCapPerDay));
                fd.append('copayPct', String(copayPct));
                fd.append('deductible', String(deductible));
                fd.append('isPedRelated', String(isPedRelated));
                fd.append('vehicleInfo', JSON.stringify(vehicleInfo));
                files.forEach((f) => fd.append('files', f));
                res = await api.post('/incidents/analyze', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            }
            setWhatIfResult(null);
            setIncidentResult(res.data);
            setIncidentsHistory((prev) => [res.data.incident, ...prev]);
            setFiles([]);
            if (incidentFilesRef.current) incidentFilesRef.current.value = '';
            toast.success('Incident packet analyzed & saved!');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to analyze incident');
        } finally {
            setSubmittingIncident(false);
        }
    };

    const handleToggleChecklist = async (incidentId, key) => {
        try {
            const { data } = await api.patch(`/incidents/${incidentId}/checklist`, { key });
            setIncidentResult((prev) => (prev ? { ...prev, incident: data.incident, readiness: data.readiness } : prev));
            setIncidentsHistory((prev) => prev.map((inc) => (inc.id === incidentId ? data.incident : inc)));
        } catch {
            toast.error('Failed to update checklist item');
        }
    };

    const handleGenerateSlaDraft = async () => {
        try {
            const elapsedMinutes = dischargeSeconds !== null ? Math.round(dischargeSeconds / 60) : 0;
            const { data } = await api.post('/incidents/sla-escalation', {
                policyId: selectedPolicyId || undefined,
                elapsedMinutes,
            });
            setSlaDraft(data.draft);
            toast.success(data.isBreached ? 'IRDAI 3h Cashless Discharge SLA escalation drafted!' : 'SLA monitoring draft generated (180m window active)');
        } catch {
            toast.error('Failed to draft SLA escalation');
        }
    };

    const downloadBlobFile = async (url, filename) => {
        try {
            const resp = await api.get(url, { responseType: 'blob' });
            const blobUrl = URL.createObjectURL(resp.data);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        } catch {
            toast.error(`Failed to download ${filename}`);
        }
    };

    const toggleManualPart = (part) => {
        setSelectedManualParts((prev) => {
            const exists = prev.find((p) => p.partKey === part.part_key);
            if (exists) return prev.filter((p) => p.partKey !== part.part_key);
            return [...prev, { partKey: part.part_key, partLabel: part.part_label, severity: 'moderate' }];
        });
    };

    const updateManualPartSeverity = (partKey, severity) => {
        setSelectedManualParts((prev) => prev.map((p) => (p.partKey === partKey ? { ...p, severity } : p)));
    };

    const handleMotorAnalyze = async (e) => {
        e.preventDefault();
        if (motorPhotos.length === 0 && selectedManualParts.length === 0) {
            return toast.error('Upload accident photo(s) OR select damaged parts from the repair list.');
        }
        if (motorPhotos.length > 6) {
            return toast.error('Maximum 6 accident photos allowed per analysis.');
        }
        setMotorLoading(true);
        try {
            const totalSize = motorPhotos.reduce((s, f) => s + f.size, 0);
            let res;
            if (totalSize > 3.8 * 1024 * 1024 && motorPhotos.length > 0) {
                const signedFiles = [];
                for (const f of motorPhotos) signedFiles.push(await uploadDirectToSignedStorage(f, 'incidents'));
                res = await api.post('/damage/analyze', {
                    policyId: selectedPolicyId || undefined,
                    vehicleInfo,
                    garageQuoteTotal: Number(garageQuoteTotal || 0),
                    manualParts: selectedManualParts,
                    signedFiles,
                });
            } else {
                const fd = new FormData();
                if (selectedPolicyId) fd.append('policyId', selectedPolicyId);
                fd.append('vehicleInfo', JSON.stringify(vehicleInfo));
                fd.append('garageQuoteTotal', String(garageQuoteTotal || 0));
                if (selectedManualParts.length > 0) fd.append('manualParts', JSON.stringify(selectedManualParts));
                motorPhotos.forEach((f) => fd.append('photos', f));
                res = await api.post('/damage/analyze', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            }
            setMotorResult(res.data);
            setDamageHistory((prev) => [res.data.report, ...prev]);
            setMotorPhotos([]);
            if (motorPhotosRef.current) motorPhotosRef.current.value = '';
            toast.success(`Damage analyzed via ${res.data.detectionSource}`);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Vehicle analysis failed');
        } finally {
            setMotorLoading(false);
        }
    };

    const handleSettlementDecode = async (e) => {
        e.preventDefault();
        if (settlementFile && settlementFile.size > 10 * 1024 * 1024) {
            return toast.error('Settlement file size must be under 10MB');
        }
        setSettlementLoading(true);
        try {
            let res;
            const useOcr = Boolean(settlementFile && !settlementEditedManually);
            if (settlementFile && settlementFile.size > 3.8 * 1024 * 1024) {
                const uploaded = await uploadDirectToSignedStorage(settlementFile, 'incidents');
                res = await api.post('/settlements/decode', {
                    policyId: selectedPolicyId || undefined,
                    storagePath: uploaded.storagePath,
                    fileName: uploaded.fileName,
                    mimeType: uploaded.mimeType,
                    preferOcr: useOcr,
                    claimedAmount: useOcr ? undefined : Number(claimedAmount),
                    approvedAmount: useOcr ? undefined : Number(approvedAmount),
                    lineItems,
                });
            } else if (settlementFile) {
                const fd = new FormData();
                if (selectedPolicyId) fd.append('policyId', selectedPolicyId);
                fd.append('preferOcr', String(useOcr));
                if (!useOcr) {
                    fd.append('claimedAmount', String(claimedAmount));
                    fd.append('approvedAmount', String(approvedAmount));
                }
                fd.append('lineItems', JSON.stringify(lineItems));
                fd.append('file', settlementFile);
                res = await api.post('/settlements/decode', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            } else {
                res = await api.post('/settlements/decode', {
                    policyId: selectedPolicyId || undefined,
                    claimedAmount: Number(claimedAmount),
                    approvedAmount: Number(approvedAmount),
                    lineItems,
                });
            }
            setSettlementResult(res.data);
            if (res.data.claimedAmount !== undefined) setClaimedAmount(res.data.claimedAmount);
            if (res.data.approvedAmount !== undefined) setApprovedAmount(res.data.approvedAmount);
            if (res.data.settlement) setSettlementHistory((prev) => [res.data.settlement, ...prev]);
            setSettlementFile(null);
            setSettlementEditedManually(false);
            if (settlementFileRef.current) settlementFileRef.current.value = '';
            toast.success('Shortfall decoded & GRO grievance generated!');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Settlement decode failed');
        } finally {
            setSettlementLoading(false);
        }
    };

    const formatAiGuidance = (content) => {
        if (!content) return 'Data not available';
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) return content.join(', ');
        if (typeof content === 'object') return Object.entries(content).map(([k, v]) => `${k}: ${v}`).join(' | ');
        return String(content);
    };

    if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;

    const activePolicy = policies.find((p) => p._id === selectedPolicyId);

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1>Claims & Deterministic Payout Estimator</h1>
                    <p>IRDAI Claim Guidelines, 7-Scenario Multi-File Intake, What-If Simulator, Vehicle Damage AI & Settlement Decoder</p>
                </div>
                {selectedPolicyId && (
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/terminal?policyId=${selectedPolicyId}`)}>
                        <Sparkles size={14} /> Ask Parinidhi About This Policy
                    </button>
                )}
            </div>

            <div className="card" style={{ padding: 18, marginBottom: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                    <div style={{ flex: '1 1 300px' }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>Active Policy</label>
                        <select className="form-input" value={selectedPolicyId} onChange={(e) => setSelectedPolicyId(e.target.value)}>
                            <option value="">Choose a policy...</option>
                            {policies.map((p) => (
                                <option key={p._id} value={p._id}>
                                    {p.providerName} - {p.policyNumber} (₹{p.coverageAmount?.toLocaleString('en-IN')})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {[
                            { key: 'guidelines', label: 'Claim Guidelines', icon: Shield },
                            { key: 'estimator', label: '7-Scenario & What-If', icon: Calculator },
                            { key: 'vehicle', label: 'Vehicle Damage AI', icon: Car },
                            { key: 'settlement', label: 'Settlement Decoder', icon: Scale },
                            { key: 'emergency', label: 'Emergency Mode', icon: AlertTriangle },
                        ].map(({ key, label, icon: Icon }) => (
                            <button key={key} className={`btn btn-sm ${activeTab === key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab(key)}>
                                <Icon size={14} /> {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* TAB 1: Preserved Guidelines + Saved Incidents Overview */}
            {activeTab === 'guidelines' && (
                <div>
                    {selectedPolicyId && activePolicy ? (
                        <div className="card" style={{ border: '1px solid var(--border-glow)', marginBottom: 24 }}>
                            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Shield size={20} style={{ color: 'var(--accent-primary)' }} />
                                    <h3 style={{ margin: 0 }}>Dynamic Policy Guidelines</h3>
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <div style={{ background: 'rgba(236,72,153,0.1)', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <FileText size={14} /> Req ID #{activePolicy.policyNumber}
                                    </div>
                                    <div style={{ background: 'rgba(5,150,105,0.1)', border: '1px solid var(--success)', color: 'var(--success)', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                                        AI Helpline: {activePolicy.aiSummary?.helplineNumber || 'Re-upload PDF to Extract'}
                                    </div>
                                </div>
                            </div>
                            <div style={{ padding: 24 }}>
                                {activePolicy.aiSummary?.claimProcedure ? (
                                    <>
                                        <div style={{ fontSize: 14, lineHeight: 1.7, padding: 16, background: 'rgba(236,72,153,0.05)', borderRadius: 8, borderLeft: '4px solid var(--accent-primary)', marginBottom: 16 }}>
                                            <strong style={{ color: 'var(--accent-primary)' }}>How to Claim:</strong><br />
                                            {formatAiGuidance(activePolicy.aiSummary.claimProcedure)}
                                        </div>
                                        {activePolicy.aiSummary.exclusions && (
                                            <div style={{ fontSize: 14, lineHeight: 1.7, padding: 16, background: 'rgba(220,38,38,0.05)', borderRadius: 8, borderLeft: '4px solid var(--danger)', marginBottom: 16 }}>
                                                <strong style={{ color: 'var(--danger)' }}>Exclusions (What NOT To Claim):</strong><br />
                                                {formatAiGuidance(activePolicy.aiSummary.exclusions)}
                                            </div>
                                        )}
                                        <div style={{ fontSize: 14, lineHeight: 1.7, padding: 16, background: 'rgba(5,150,105,0.05)', borderRadius: 8, borderLeft: '4px solid var(--success)' }}>
                                            <strong style={{ color: 'var(--success)' }}>Required Documents:</strong><br />
                                            {formatAiGuidance(activePolicy.aiSummary.requiredDocuments)}
                                        </div>
                                    </>
                                ) : (
                                    <div className="empty-state"><p>Upload a digital PDF policy to view extracted claim guidelines.</p></div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="empty-state card" style={{ padding: 40, marginBottom: 24 }}><h3>Select a policy above to inspect claim rules</h3></div>
                    )}

                    {incidentsHistory.length > 0 && (
                        <div className="card" style={{ padding: 20 }}>
                            <h3 style={{ marginBottom: 12 }}>Saved Claim Assessments ({incidentsHistory.length})</h3>
                            <div className="table-wrapper">
                                <table className="table">
                                    <thead><tr><th>Scenario</th><th>Verdict</th><th>Estimate</th><th>Insurer Share</th><th>Readiness</th><th>Guide PDF</th></tr></thead>
                                    <tbody>
                                        {incidentsHistory.map((inc) => {
                                            const openSavedIncident = () => {
                                                const checks = Array.isArray(inc.readiness_checklist) ? inc.readiness_checklist : [];
                                                const doneCount = checks.filter((c) => c.completed).length;
                                                setIncidentResult({
                                                    incident: inc,
                                                    payoutCalculation: inc.payout_calculation,
                                                    readiness: {
                                                        readinessScore: Number(inc.readiness_score ?? (checks.length ? Math.round((doneCount / checks.length) * 100) : 0)),
                                                        doneCount,
                                                        totalCount: checks.length,
                                                        checks,
                                                    },
                                                });
                                                setWhatIfResult(null);
                                                setActiveTab('estimator');
                                            };
                                            return (
                                            <tr key={inc.id} tabIndex={0} style={{ cursor: 'pointer' }}
                                                onClick={openSavedIncident}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSavedIncident(); } }}>
                                                <td><strong>{inc.scenario_type}</strong></td>
                                                <td><span className="badge badge-purple">{inc.payout_calculation?.verdict || inc.status}</span></td>
                                                <td>₹{Number(inc.estimated_amount || 0).toLocaleString('en-IN')}</td>
                                                <td style={{ color: 'var(--success)', fontWeight: 700 }}>₹{Number(inc.payout_calculation?.insurerShare || 0).toLocaleString('en-IN')}</td>
                                                <td>{inc.readiness_score}%</td>
                                                <td onClick={(e) => e.stopPropagation()}>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => downloadBlobFile(`/incidents/${inc.id}/claim-guide.pdf`, `Claim_Guide_${inc.id.slice(0, 8)}.pdf`)}>
                                                        <Download size={13} /> PDF
                                                    </button>
                                                </td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: 7-Scenario Multi-Upload + Payout Waterfall + What-If + 3h SLA */}
            {activeTab === 'estimator' && (
                <div className="grid-2">
                    <form className="card" style={{ padding: 22 }} onSubmit={handleAnalyzeIncident}>
                        <h3 style={{ marginBottom: 14 }}><Upload size={17} /> 7-Scenario Evidence Intake</h3>
                        <label className="form-label">Scenario Type</label>
                        <select className="form-input" style={{ marginBottom: 12 }} value={scenarioType} onChange={(e) => setScenarioType(e.target.value)}>
                            {SCENARIOS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>

                        {medicalBenchmarks.length > 0 && scenarioType === 'medical_claim' && (
                            <div style={{ marginBottom: 12 }}>
                                <label className="form-label">Quick-Fill Indian Procedure Cost (from Supabase Benchmarks)</label>
                                <select className="form-input" onChange={(e) => {
                                    const m = medicalBenchmarks.find((x) => x.procedure_key === e.target.value);
                                    if (m) setEstimatedBill(Number(m.avg_cost_tier1));
                                }}>
                                    <option value="">Optional benchmark procedure...</option>
                                    {medicalBenchmarks.map((m) => (
                                        <option key={m.procedure_key} value={m.procedure_key}>
                                            {m.procedure_name} — Tier1 Avg ₹{Number(m.avg_cost_tier1).toLocaleString('en-IN')} ({m.standard_waiting_months}m wait)
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <label className="form-label">Upload Mixed Evidence (up to 8 PDFs / JPG / PNG / WEBP)</label>
                        <input ref={incidentFilesRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" className="form-input" style={{ marginBottom: 12 }}
                            onChange={(e) => {
                                const selected = Array.from(e.target.files || []);
                                if (selected.length > 8) {
                                    toast.error('Maximum 8 files supported — keeping first 8.');
                                    setFiles(selected.slice(0, 8));
                                } else {
                                    setFiles(selected);
                                }
                            }} />

                        {scenarioType === 'motor_accident' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12, padding: 10, borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                                <input className="form-input" placeholder="Vehicle Make (e.g. Hyundai)" value={vehicleInfo.make} onChange={(e) => setVehicleInfo({ ...vehicleInfo, make: e.target.value })} />
                                <input className="form-input" placeholder="Model (e.g. i20)" value={vehicleInfo.model} onChange={(e) => setVehicleInfo({ ...vehicleInfo, model: e.target.value })} />
                                <input className="form-input" type="number" placeholder="Year" value={vehicleInfo.year} onChange={(e) => setVehicleInfo({ ...vehicleInfo, year: Number(e.target.value) })} />
                                <input className="form-input" type="number" placeholder="IDV (₹)" value={vehicleInfo.idv} onChange={(e) => setVehicleInfo({ ...vehicleInfo, idv: Number(e.target.value) })} />
                            </div>
                        )}

                        <div className="claims-two-col">
                            <div>
                                <label className="form-label">Hospital Estimate (₹)</label>
                                <input type="number" className="form-input" value={estimatedBill} onChange={(e) => setEstimatedBill(Number(e.target.value))} />
                            </div>
                            <div>
                                <label className="form-label">Chosen Room / Day (₹)</label>
                                <input type="number" className="form-input" value={roomRentPerDay} onChange={(e) => setRoomRentPerDay(Number(e.target.value))} />
                            </div>
                            <div>
                                <label className="form-label">Policy Room Cap / Day (₹)</label>
                                <input type="number" className="form-input" value={policyRoomCapPerDay} onChange={(e) => setPolicyRoomCapPerDay(Number(e.target.value))} />
                            </div>
                            <div>
                                <label className="form-label">Co-Pay (%)</label>
                                <input type="number" min={0} max={100} className="form-input" value={copayPct} onChange={(e) => setCopayPct(Number(e.target.value))} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label className="form-label">Policy Deductible (₹)</label>
                                <input type="number" min={0} className="form-input" value={deductible} onChange={(e) => setDeductible(Number(e.target.value))} />
                            </div>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0 14px', fontSize: 13 }}>
                            <input type="checkbox" checked={isPedRelated} onChange={(e) => setIsPedRelated(e.target.checked)} />
                            Treatment relates to a Pre-Existing Disease (checks 60-Month IRDAI Moratorium)
                        </label>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button type="submit" className="btn btn-primary" disabled={submittingIncident} style={{ flex: 1 }}>
                                {submittingIncident ? 'Analyzing Packet...' : 'Analyze Packet & Calculate Payout'}
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={() => runWhatIf()}>
                                <Sliders size={15} /> Live What-If
                            </button>
                        </div>
                    </form>

                    <div className="card" style={{ padding: 22 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                            <h3 style={{ margin: 0 }}>Payout Waterfall & Readiness</h3>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => setDischargeSeconds(dischargeSeconds === null ? 0 : null)}>
                                    <Clock size={14} /> {dischargeSeconds === null ? 'Start 3h SLA Timer' : `${Math.floor(dischargeSeconds / 60)}m ${dischargeSeconds % 60}s / 180m`}
                                </button>
                                <button className="btn btn-secondary btn-sm" onClick={handleGenerateSlaDraft}>SLA Breach Draft</button>
                            </div>
                        </div>

                        {slaDraft && (
                            <div style={{ marginBottom: 14, padding: 10, background: 'rgba(220,38,38,0.06)', borderRadius: 10, border: '1px solid rgba(220,38,38,0.25)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <strong style={{ fontSize: 12, color: 'var(--danger)' }}>IRDAI 3h Cashless Discharge SLA Escalation Draft</strong>
                                    <button className="btn btn-secondary btn-sm" onClick={() => {
                                        navigator.clipboard?.writeText(slaDraft)
                                            .then(() => toast.success('SLA draft copied'))
                                            .catch(() => toast.error('Copy failed'));
                                    }}>Copy</button>
                                </div>
                                <textarea className="form-input" rows={5} readOnly value={slaDraft} style={{ fontSize: 11 }} />
                            </div>
                        )}

                        {(incidentResult?.payoutCalculation || whatIfResult) ? (
                            (() => {
                                const calc = incidentResult?.payoutCalculation || whatIfResult;
                                const readiness = incidentResult?.readiness;
                                return (
                                    <div>
                                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                                            <span className={`badge ${calc.verdict === 'Covered' ? 'badge-success' : calc.verdict === 'Not Covered' ? 'badge-danger' : 'badge-warning'}`}>
                                                {calc.verdict}
                                            </span>
                                            {readiness && <span className="badge badge-purple">Readiness: {readiness.readinessScore}% ({readiness.doneCount}/{readiness.totalCount})</span>}
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                                            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)' }}>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Insurer Share</div>
                                                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--success)' }}>₹{Number(calc.insurerShare || 0).toLocaleString('en-IN')}</div>
                                            </div>
                                            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Your Out-of-Pocket</div>
                                                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--danger)' }}>₹{Number(calc.outOfPocket || 0).toLocaleString('en-IN')}</div>
                                            </div>
                                        </div>

                                        <div style={{ marginBottom: 14, padding: 10, background: 'var(--bg-secondary)', borderRadius: 10 }}>
                                            <label style={{ fontSize: 12, fontWeight: 700 }}>
                                                What-If Room Rent Slider: ₹{roomRentPerDay.toLocaleString('en-IN')}/day (Cap ₹{policyRoomCapPerDay.toLocaleString('en-IN')})
                                            </label>
                                            <input type="range" min={2000} max={20000} step={500} value={roomRentPerDay} style={{ width: '100%' }}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value);
                                                    setRoomRentPerDay(val);
                                                    debouncedWhatIf({ roomRentPerDay: val });
                                                }} />
                                        </div>

                                        {(calc.waterfall || []).map((w, idx) => (
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border-color)', fontSize: 13 }}>
                                                <span>{w.label}</span>
                                                <strong style={{ color: w.type === 'deduction' || w.type === 'oop' ? 'var(--danger)' : w.type === 'payout' ? 'var(--success)' : 'var(--text-primary)' }}>
                                                    ₹{Number(w.amount || 0).toLocaleString('en-IN')}
                                                </strong>
                                            </div>
                                        ))}

                                        {readiness?.checks?.length > 0 && incidentResult?.incident?.id && (
                                            <div style={{ marginTop: 14 }}>
                                                <strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Interactive Claim Readiness Checklist (click to toggle)</strong>
                                                {readiness.checks.map((c) => (
                                                    <button key={c.key} type="button" onClick={() => handleToggleChecklist(incidentResult.incident.id, c.key)}
                                                        style={{ width: '100%', border: 'none', textAlign: 'left', color: 'inherit', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '5px 8px', cursor: 'pointer', borderRadius: 6, background: c.completed ? 'rgba(5,150,105,0.06)' : 'transparent', marginBottom: 4 }}>
                                                        {c.completed ? <CheckSquare size={14} color="#059669" /> : <Square size={14} color="#64748b" />}
                                                        <span>{c.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {calc.alerts?.map((al, ai) => (
                                            <div key={ai} style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(217,119,6,0.1)', fontSize: 12 }}>
                                                <AlertTriangle size={12} /> {al}
                                            </div>
                                        ))}

                                        {incidentResult?.incident?.id && (
                                            <button className="btn btn-primary" style={{ width: '100%', marginTop: 14 }}
                                                onClick={() => downloadBlobFile(`/incidents/${incidentResult.incident.id}/claim-guide.pdf`, `PolicyGuard_Claim_Guide_${incidentResult.incident.id.slice(0, 8)}.pdf`)}>
                                                <Download size={15} /> Download Claim Preparation Guide PDF
                                            </button>
                                        )}
                                    </div>
                                );
                            })()
                        ) : (
                            <div className="empty-state" style={{ padding: 36 }}>
                                <Calculator size={40} />
                                <p>Submit an incident packet or click Live What-If to preview the deterministic payout breakdown.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 3: Vehicle Damage AI (Zero Mock Parts + Real Supabase Benchmarks + History) */}
            {activeTab === 'vehicle' && (
                <div>
                    <div className="grid-2" style={{ marginBottom: 24 }}>
                        <form className="card" style={{ padding: 22 }} onSubmit={handleMotorAnalyze}>
                            <h3 style={{ marginBottom: 14 }}><Car size={17} /> Motor Accident Photo & Benchmark Estimator</h3>
                            <div className="claims-two-col" style={{ marginBottom: 10 }}>
                                <input className="form-input" placeholder="Make (e.g. Hyundai)" value={vehicleInfo.make} onChange={(e) => setVehicleInfo({ ...vehicleInfo, make: e.target.value })} />
                                <input className="form-input" placeholder="Model (e.g. i20)" value={vehicleInfo.model} onChange={(e) => setVehicleInfo({ ...vehicleInfo, model: e.target.value })} />
                                <input className="form-input" type="number" placeholder="Year" value={vehicleInfo.year} onChange={(e) => setVehicleInfo({ ...vehicleInfo, year: Number(e.target.value) })} />
                                <input className="form-input" type="number" placeholder="Policy IDV (₹)" value={vehicleInfo.idv} onChange={(e) => setVehicleInfo({ ...vehicleInfo, idv: Number(e.target.value) })} />
                            </div>
                            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 10 }}>
                                <input type="checkbox" checked={vehicleInfo.zeroDep} onChange={(e) => setVehicleInfo({ ...vehicleInfo, zeroDep: e.target.checked })} />
                                Zero-Depreciation (Bumper-to-Bumper) Add-on Active
                            </label>
                            <label className="form-label">Garage Quote Total (Optional ₹ — detects overcharge)</label>
                            <input className="form-input" type="number" value={garageQuoteTotal} onChange={(e) => setGarageQuoteTotal(Number(e.target.value))} style={{ marginBottom: 10 }} />

                            <label className="form-label">Accident Damage Photos (max 6 — Vision → Local YOLOv8 Fallback)</label>
                            <input ref={motorPhotosRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp" className="form-input" style={{ marginBottom: 12 }}
                                onChange={(e) => {
                                    const selected = Array.from(e.target.files || []);
                                    if (selected.length > 6) {
                                        toast.error('Maximum 6 vehicle photos supported — keeping first 6.');
                                        setMotorPhotos(selected.slice(0, 6));
                                    } else {
                                        setMotorPhotos(selected);
                                    }
                                }} />

                            <label className="form-label">Or Select Specific Damaged Parts Manually (from Supabase Repair Matrix)</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, maxHeight: 130, overflowY: 'auto' }}>
                                {vehicleBenchmarks.map((b) => {
                                    const active = selectedManualParts.find((p) => p.partKey === b.part_key);
                                    return (
                                        <button type="button" key={b.part_key}
                                            className={`btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
                                            style={{ fontSize: 11, padding: '4px 8px' }}
                                            onClick={() => toggleManualPart(b)}>
                                            {b.part_label}
                                        </button>
                                    );
                                })}
                            </div>
                            {selectedManualParts.length > 0 && (
                                <div style={{ marginBottom: 12 }}>
                                    {selectedManualParts.map((sp) => (
                                        <div key={sp.partKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 12 }}>
                                            <span>{sp.partLabel}</span>
                                            <select className="form-input" style={{ width: 120, padding: '3px 6px', fontSize: 11 }}
                                                value={sp.severity} onChange={(e) => updateManualPartSeverity(sp.partKey, e.target.value)}>
                                                <option value="minor">Minor</option>
                                                <option value="moderate">Moderate</option>
                                                <option value="severe">Severe</option>
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button className="btn btn-primary" type="submit" disabled={motorLoading} style={{ width: '100%' }}>
                                {motorLoading ? 'Running Vision + Fallback Analysis...' : 'Analyze Vehicle Damage & Payout'}
                            </button>
                        </form>

                        <div className="card" style={{ padding: 22 }}>
                            <h3 style={{ marginBottom: 14 }}>Repair Cost vs Motor Payout</h3>
                            {motorResult ? (
                                <div>
                                    <span className="badge badge-purple" style={{ marginBottom: 12 }}>Source: {motorResult.detectionSource}</span>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                                        <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Garage Repair Range</div>
                                            <div style={{ fontSize: 18, fontWeight: 800 }}>
                                                ₹{motorResult.repairEstimate.min.toLocaleString('en-IN')} – ₹{motorResult.repairEstimate.max.toLocaleString('en-IN')}
                                            </div>
                                        </div>
                                        <div style={{ padding: 12, borderRadius: 10, background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)' }}>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Est. Insurance Payout</div>
                                            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)' }}>
                                                ₹{motorResult.insurancePayout.estimatedPayout.toLocaleString('en-IN')}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--danger)' }}>Out-of-pocket: ₹{motorResult.insurancePayout.outOfPocket.toLocaleString('en-IN')}</div>
                                        </div>
                                    </div>
                                    {motorResult.repairEstimate.quoteOverchargeWarning && (
                                        <div style={{ padding: 10, background: 'rgba(220,38,38,0.08)', borderRadius: 8, fontSize: 12, marginBottom: 10, color: 'var(--danger)' }}>
                                            {motorResult.repairEstimate.quoteOverchargeWarning}
                                        </div>
                                    )}
                                    {(motorResult.itemizedParts || []).map((p, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--border-color)', fontSize: 13 }}>
                                            <span><strong>{p.partLabel}</strong> ({p.severity} · {p.action})</span>
                                            <span>₹{p.repairMin.toLocaleString('en-IN')}–₹{p.repairMax.toLocaleString('en-IN')} (-{p.depreciationPct}% dep)</span>
                                        </div>
                                    ))}
                                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>{motorResult.disclaimer}</p>
                                </div>
                            ) : (
                                <div className="empty-state" style={{ padding: 36 }}><Car size={40} /><p>Upload car damage photos or pick damaged parts to compare OEM repair cost vs net motor payout.</p></div>
                            )}
                        </div>
                    </div>

                    {damageHistory.length > 0 && (
                        <div className="card" style={{ padding: 20 }}>
                            <h3 style={{ marginBottom: 12 }}>Saved Vehicle Damage Reports ({damageHistory.length})</h3>
                            <div className="table-wrapper">
                                <table className="table">
                                    <thead><tr><th>Vehicle</th><th>Detection Source</th><th>Repair Range</th><th>Payout</th><th>Out-of-Pocket</th></tr></thead>
                                    <tbody>
                                        {damageHistory.map((d) => (
                                            <tr key={d.id}>
                                                <td>{[d.vehicle_info?.make, d.vehicle_info?.model, d.vehicle_info?.year].filter(Boolean).join(' ') || 'Vehicle'}</td>
                                                <td><span className="badge badge-purple">{d.detection_source}</span></td>
                                                <td>₹{Number(d.estimated_repair_min || 0).toLocaleString('en-IN')} – ₹{Number(d.estimated_repair_max || 0).toLocaleString('en-IN')}</td>
                                                <td style={{ color: 'var(--success)', fontWeight: 700 }}>₹{Number(d.estimated_payout || 0).toLocaleString('en-IN')}</td>
                                                <td style={{ color: 'var(--danger)' }}>₹{Number(d.out_of_pocket || 0).toLocaleString('en-IN')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 4: Settlement Shortfall Decoder (OCR Upload + Multi-Line + PDF Download + History) */}
            {activeTab === 'settlement' && (
                <div>
                    <div className="grid-2" style={{ marginBottom: 24 }}>
                        <form className="card" style={{ padding: 22 }} onSubmit={handleSettlementDecode}>
                            <h3 style={{ marginBottom: 14 }}><Scale size={17} /> Settlement Shortfall & Rejection Decoder</h3>
                            <label className="form-label">Optional: Upload Settlement Sheet / Rejection Letter (PDF or Photo — auto-extracts billed/paid)</label>
                            <input ref={settlementFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="form-input" style={{ marginBottom: 10 }}
                                onChange={(e) => {
                                    setSettlementFile(e.target.files?.[0] || null);
                                    setSettlementEditedManually(false);
                                }} />

                            <div className="claims-two-col" style={{ marginBottom: 12 }}>
                                <div>
                                    <label className="form-label">Claimed Bill (₹)</label>
                                    <input className="form-input" type="number" value={claimedAmount} onChange={(e) => { setClaimedAmount(e.target.value); setSettlementEditedManually(true); }} />
                                </div>
                                <div>
                                    <label className="form-label">Approved / Settled (₹)</label>
                                    <input className="form-input" type="number" value={approvedAmount} onChange={(e) => { setApprovedAmount(e.target.value); setSettlementEditedManually(true); }} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <label className="form-label" style={{ margin: 0 }}>Disputed Deduction Line Items</label>
                                <button type="button" className="btn btn-secondary btn-sm"
                                    onClick={() => setLineItems((prev) => [...prev, { itemName: '', claimed: 0, approved: 0, reason: '' }])}>
                                    <Plus size={12} /> Add Row
                                </button>
                            </div>
                            {lineItems.map((li, idx) => (
                                <div key={idx} className="settlement-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr auto', gap: 6, marginBottom: 6 }}>
                                    <input className="form-input" placeholder="Item" value={li.itemName}
                                        onChange={(e) => setLineItems((p) => p.map((r, i) => (i === idx ? { ...r, itemName: e.target.value } : r)))} />
                                    <input className="form-input" type="number" placeholder="Billed" value={li.claimed}
                                        onChange={(e) => setLineItems((p) => p.map((r, i) => (i === idx ? { ...r, claimed: Number(e.target.value) } : r)))} />
                                    <input className="form-input" type="number" placeholder="Paid" value={li.approved}
                                        onChange={(e) => setLineItems((p) => p.map((r, i) => (i === idx ? { ...r, approved: Number(e.target.value) } : r)))} />
                                    <input className="form-input" placeholder="TPA Reason" value={li.reason}
                                        onChange={(e) => setLineItems((p) => p.map((r, i) => (i === idx ? { ...r, reason: e.target.value } : r)))} />
                                    <button type="button" className="btn btn-danger btn-sm" onClick={() => setLineItems((p) => p.filter((_, i) => i !== idx))}>
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}

                            <button className="btn btn-primary" type="submit" disabled={settlementLoading} style={{ width: '100%', marginTop: 10 }}>
                                {settlementLoading ? 'Auditing Settlement...' : 'Audit Shortfall & Draft GRO Grievance'}
                            </button>
                        </form>

                        <div className="card" style={{ padding: 22 }}>
                            <h3 style={{ marginBottom: 12 }}>Grievance Escalation Draft</h3>
                            {settlementResult ? (
                                <div>
                                    <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                                        <span className="badge badge-danger">Shortfall: ₹{settlementResult.shortfallAmount.toLocaleString('en-IN')}</span>
                                        <span className="badge badge-success">Recovery Ratio: {settlementResult.recoveryRatioPct}%</span>
                                    </div>
                                    <textarea className="form-input" rows={9} readOnly value={settlementResult.grievanceLetter} style={{ fontSize: 12, marginBottom: 10 }} />
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-secondary btn-sm" onClick={() => {
                                            navigator.clipboard?.writeText(settlementResult.grievanceLetter)
                                                .then(() => toast.success('Letter copied!'))
                                                .catch(() => toast.error('Copy failed'));
                                        }}>
                                            Copy Letter
                                        </button>
                                        {settlementResult.settlement?.id && (
                                            <button className="btn btn-primary btn-sm"
                                                onClick={() => downloadBlobFile(`/settlements/${settlementResult.settlement.id}/grievance.pdf`, `GRO_Grievance_${settlementResult.settlement.id.slice(0, 8)}.pdf`)}>
                                                <Download size={13} /> Download Grievance PDF
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="empty-state" style={{ padding: 36 }}><Scale size={40} /><p>Upload a settlement sheet or enter billed vs paid items to generate an IRDAI GRO appeal.</p></div>
                            )}
                        </div>
                    </div>

                    {settlementHistory.length > 0 && (
                        <div className="card" style={{ padding: 20 }}>
                            <h3 style={{ marginBottom: 12 }}>Saved Settlement Audits ({settlementHistory.length})</h3>
                            <div className="table-wrapper">
                                <table className="table">
                                    <thead><tr><th>Claimed</th><th>Approved</th><th>Shortfall</th><th>Grievance PDF</th></tr></thead>
                                    <tbody>
                                        {settlementHistory.map((s) => (
                                            <tr key={s.id}>
                                                <td>₹{Number(s.claimed_amount || 0).toLocaleString('en-IN')}</td>
                                                <td>₹{Number(s.approved_amount || 0).toLocaleString('en-IN')}</td>
                                                <td style={{ color: 'var(--danger)', fontWeight: 700 }}>₹{Number(s.shortfall_amount || 0).toLocaleString('en-IN')}</td>
                                                <td>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => downloadBlobFile(`/settlements/${s.id}/grievance.pdf`, `GRO_Grievance_${s.id.slice(0, 8)}.pdf`)}>
                                                        <Download size={13} /> PDF
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 5: Emergency Assistance Mode */}
            {activeTab === 'emergency' && (() => {
                const EMERGENCY_CASES = [
                    {
                        key: 'road_accident',
                        title: 'Road Accident',
                        helplines: 'Police & Emergency: 112 · Highway Patrol: 1033 · Ambulance: 108',
                        docs: ['Driving Licence, RC & Active Motor Policy', 'Timestamped wide & close-up scene/damage photos', 'Police FIR / GD Entry (mandatory for third-party injury/theft)'],
                        steps: [
                            'Move passengers to safety and dial 108/112 if anyone is injured.',
                            'Call your insurer toll-free helpline before towing to generate a Claim Intimation ID.',
                            'Choose a cashless network garage and verify Zero-Dep/towing sub-limits before approving repairs.',
                        ],
                    },
                    {
                        key: 'hospitalization',
                        title: 'Medical Hospitalization',
                        helplines: 'Ambulance: 108 · Emergency: 112 · IRDAI Helpline: 155255',
                        docs: ['Health Insurance E-Card / Policy Number', 'Policyholder Aadhaar / PAN & Attending Doctor Note', 'Diagnostic reports & initial admission estimate'],
                        steps: [
                            'Visit the hospital TPA Cashless Desk immediately with your E-Card and KYC.',
                            'Intimate insurer/TPA within 24 hours of emergency hospitalization (48h prior for planned surgery).',
                            'Pick a room strictly within your single private / 1% cap to avoid proportionate deductions.',
                            'Track the IRDAI 3-Hour Cashless Final Discharge SLA once billing closes.',
                        ],
                    },
                    {
                        key: 'vehicle_theft',
                        title: 'Vehicle Theft',
                        helplines: 'Police: 112 · RTO Intimation · IRDAI Helpline: 155255',
                        docs: ['Original RC, All Original Ignition Keys, Purchase Invoice', 'Immediate Police e-FIR & Final Non-Traceable Report (NTR)', 'Form 28/29/30 & RTO Theft Intimation Receipt'],
                        steps: [
                            'File a Police FIR immediately (same day) and retain stamped copies.',
                            'Inform insurer and financed bank/hypothecation lender within 24–48 hours.',
                            'Notify your local RTO in writing so the stolen vehicle cannot be fraudulently transferred.',
                        ],
                    },
                    {
                        key: 'property_damage',
                        title: 'Property / Home Damage',
                        helplines: 'Fire & Rescue: 101 · Emergency: 112 · IRDAI: 155255',
                        docs: ['Fire Brigade / Municipal Incident Report', 'Before/After damage photos & repair quotation', 'Property deed / inventory bills for high-value contents'],
                        steps: [
                            'Contain active hazards (power/gas shutoff) and call Fire Brigade 101 if needed.',
                            'Do not dispose of damaged debris/fixtures before the insurer surveyor inspects the site.',
                            'Submit itemized repair/reconstruction bills aligned with your sum-insured structure.',
                        ],
                    },
                    {
                        key: 'online_fraud',
                        title: 'Online Renewal / UPI Fraud',
                        helplines: 'National Cybercrime Helpline: 1930 · cybercrime.gov.in · RBI Ombudsman',
                        docs: ['UPI Transaction ID / UTR & Bank Statement Screenshot', 'Fake APK / Phishing WhatsApp/Gmail Screenshots', 'Official Insurer Grievance Confirmation'],
                        steps: [
                            'Dial 1930 IMMEDIATELY (within 2 hours Golden Hour) to place a bank lien on defrauded funds.',
                            'Force-uninstall any suspicious .apk installed from WhatsApp/SMS/Gmail and revoke banking permissions.',
                            'Never enter your UPI PIN to receive refunds — verify every renewal portal inside PolicyGuard Browser Shield.',
                        ],
                    },
                ];
                const currentCase = EMERGENCY_CASES.find((c) => c.key === emergencyScenario) || EMERGENCY_CASES[0];
                return (
                    <div className="card" style={{ padding: 22 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                            <div>
                                <h3 style={{ margin: 0, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <PhoneCall size={18} /> 1-Tap Emergency Assistance Playbook
                                </h3>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                                    Active Policy: {activePolicy ? `${activePolicy.providerName} (#${activePolicy.policyNumber})` : 'None selected'}
                                </p>
                            </div>
                            {activePolicy && (
                                <button className="btn btn-primary btn-sm" onClick={() => downloadBlobFile(`/policy/${activePolicy._id}/emergency-card.pdf`, `Emergency_Card_${activePolicy._id.slice(0, 8)}.pdf`)}>
                                    <Download size={14} /> Download Emergency Card PDF
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                            {EMERGENCY_CASES.map((c) => (
                                <button key={c.key} type="button"
                                    className={`btn btn-sm ${emergencyScenario === c.key ? 'btn-danger' : 'btn-secondary'}`}
                                    onClick={() => setEmergencyScenario(c.key)}>
                                    {c.title}
                                </button>
                            ))}
                        </div>
                        <div style={{ padding: 14, borderRadius: 12, background: 'rgba(254,242,242,0.75)', border: '1px solid rgba(220,38,38,0.28)', marginBottom: 16 }}>
                            <strong style={{ color: '#991b1b', fontSize: 15 }}>{currentCase.helplines}</strong>
                            {activePolicy?.aiSummary?.helplineNumber && (
                                <div style={{ fontSize: 13, marginTop: 4, color: 'var(--text-primary)' }}>
                                    <strong>Insurer Helpline ({activePolicy.providerName}):</strong> {activePolicy.aiSummary.helplineNumber}
                                </div>
                            )}
                        </div>
                        <div className="grid-2">
                            <div style={{ padding: 14, borderRadius: 10, border: '1px solid var(--border-color)', background: '#fff' }}>
                                <strong style={{ display: 'block', marginBottom: 8 }}>Immediate Action Steps</strong>
                                <ol style={{ margin: '0 0 0 18px', fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                                    {currentCase.steps.map((s, idx) => <li key={idx}>{s}</li>)}
                                </ol>
                            </div>
                            <div style={{ padding: 14, borderRadius: 10, border: '1px solid var(--border-color)', background: '#fff' }}>
                                <strong style={{ display: 'block', marginBottom: 8 }}>Essential Checklist Documents</strong>
                                <ul style={{ margin: '0 0 0 18px', fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                                    {currentCase.docs.map((d, idx) => <li key={idx}>{d}</li>)}
                                </ul>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
