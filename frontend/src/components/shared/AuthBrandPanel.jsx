import { Canvas } from '@react-three/fiber';
import { FileCheck2, Lock, Shield } from 'lucide-react';
import CanvasErrorBoundary from './CanvasErrorBoundary';
import CyberCore from './CyberCore';
import DataStreamField from './DataStreamField';
import GridFloor from './GridFloor';

const BRAND_FEATURES = [
    {
        icon: FileCheck2,
        color: '#fb7185',
        label: 'PDF & E-Card Decoder',
    },
    {
        icon: Shield,
        color: '#22d3ee',
        label: 'Health, Car & 2W Claims',
    },
    {
        icon: Lock,
        color: '#10b981',
        label: 'Scam Shield & Vault',
    },
];

export default function AuthBrandPanel({
    active = false,
    badgeText = 'IRDAI · INDIA',
    tagline = 'Clause Clarity · Claim Math · Scam Defense',
    fallbackTitle = 'PolicyGuard Auth',
    streamColor = '#f472b6',
}) {
    const compactBadge = badgeText.includes('FREE') ? 'FREE VAULT · INDIA' : 'IRDAI · INDIA';

    return (
        <div className="auth-brand-panel auth-brand-dark">
            <div className="auth-panel-canvas" aria-hidden="true">
                <CanvasErrorBoundary fallbackTitle={fallbackTitle}>
                    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.15, 9.8], fov: 44 }} gl={{ alpha: true, antialias: true }}>
                        <ambientLight intensity={1.15} />
                        <directionalLight position={[8, 9, 8]} intensity={1.65} color="#ffffff" />
                        <directionalLight position={[-6, 6, 4]} intensity={1.45} color={active ? '#06b6d4' : '#fb7185'} />
                        <pointLight position={[-8, -6, 4]} intensity={1.2} color="#22d3ee" />
                        <CyberCore position={[0, 2.08, -0.5]} scale={0.58} active={active} />
                        <DataStreamField active={active} color={streamColor} />
                        <GridFloor colorPrimary={active ? '#22d3ee' : '#e11d48'} colorSecondary="#1e293b" opacity={0.26} y={-3.6} />
                        <fog attach="fog" args={['#050814', 9, 24]} />
                    </Canvas>
                </CanvasErrorBoundary>
            </div>

            <div className="auth-brand-inner auth-brand-dark-inner">
                <div className="auth-brand-logo-row">
                    <div className="auth-brand-head-left">
                        <span className="brand-emblem-dark auth-logo-mark-wrap">
                            <img src="/logo.png" alt="PolicyGuard AI" className="auth-logo-mark" />
                        </span>
                        <div>
                            <h1 className="auth-brand-name-obsidian">PolicyGuard AI</h1>
                            <p className="auth-brand-tagline-obsidian">{tagline}</p>
                        </div>
                    </div>
                    <div className="auth-brand-badge">
                        <span className="hero-live-dot" aria-hidden="true" />
                        <span>{compactBadge}</span>
                    </div>
                </div>

                <div className="auth-brand-features-obsidian">
                    {BRAND_FEATURES.map((item) => {
                        const Icon = item.icon;
                        return (
                            <div key={item.label} className="auth-brand-feature-obsidian">
                                <span className="auth-feature-icon-wrap" style={{ color: item.color }}>
                                    <Icon size={14} />
                                </span>
                                <span className="auth-feature-inline">
                                    <strong>{item.label}</strong>
                                </span>
                            </div>
                        );
                    })}
                </div>

                <div className="auth-brand-helpline-bar">
                    <span><b>60m</b> PED · <b>3h</b> SLA · <b>30d</b> Exit</span>
                    <span>SOS <strong>112</strong> · <strong>1930</strong> · <strong>155255</strong></span>
                </div>
            </div>
        </div>
    );
}
