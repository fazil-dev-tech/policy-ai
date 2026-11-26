import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

function handleKeyActivate(e, fn) {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fn();
    }
}

const CLAUSE_ITEMS = [
    {
        id: 'cap',
        pdfY: 48,
        pdfW: 94,
        pdfColor: '#d1fae5',
        pdfActive: '#10b981',
        pdfNote: 'Pg 1 · Single AC Room Cap',
        label: 'Coverage Cap · Verified',
        sub: 'Zero proportionate cut',
        cardY: 16,
        dot: '#047857',
        fill: '#ffffff',
        activeFill: '#ecfdf5',
        stroke: '#e2e8f0',
        activeStroke: '#10b981',
        textFill: '#0f172a',
    },
    {
        id: 'wait',
        pdfY: 66,
        pdfW: 94,
        pdfColor: '#ffe4e6',
        pdfActive: '#e11d48',
        pdfNote: 'Pg 4 · 60-Month IRDAI Wait',
        label: 'Waiting Period · Cited Pg 4',
        sub: 'Moratorium rule verified',
        cardY: 57,
        dot: '#e11d48',
        fill: '#fff1f5',
        activeFill: '#ffe4e6',
        stroke: '#fecdd3',
        activeStroke: '#e11d48',
        textFill: '#9f1239',
    },
    {
        id: 'pii',
        pdfY: 84,
        pdfW: 76,
        pdfColor: '#e0f2fe',
        pdfActive: '#0284c7',
        pdfNote: 'IDs Masked before AI',
        label: 'PAN & Aadhaar Protected',
        sub: 'Auto-redacted vault upload',
        cardY: 98,
        dot: '#0284c7',
        fill: '#f0f9ff',
        activeFill: '#e0f2fe',
        stroke: '#bae6fd',
        activeStroke: '#0284c7',
        textFill: '#0369a1',
    },
];

export function SvgPolicyCisGraph() {
    const [selectedIdx, setSelectedIdx] = useState(1);
    const shouldReduceMotion = useReducedMotion();
    const active = CLAUSE_ITEMS[selectedIdx];
    const lineEndY = active.cardY + 17;
    const lineStartY = active.pdfY + 5;

    return (
        <svg viewBox="0 0 380 148" className="bento-svg-schematic" role="group" aria-label="Interactive Policy PDF decoder mapping document clauses to verified takeaways">
            {/* Left Source Document */}
            <rect x="14" y="16" width="122" height="116" rx="12" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.5" />
            <text x="26" y="36" fontSize="9.5" fontWeight="700" fill="#64748b" fontFamily="Inter, sans-serif">40-Page Policy PDF</text>

            {CLAUSE_ITEMS.map((item, idx) => {
                const isSelected = idx === selectedIdx;
                return (
                    <g
                        key={item.id}
                        className="svg-interactive-node"
                        role="button"
                        tabIndex={0}
                        aria-label={`Select ${item.label} source bar`}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedIdx(idx)}
                        onKeyDown={(e) => handleKeyActivate(e, () => setSelectedIdx(idx))}
                    >
                        <rect
                            x="26"
                            y={item.pdfY}
                            width={item.pdfW}
                            height="11"
                            rx="5.5"
                            fill={isSelected ? item.pdfActive : item.pdfColor}
                            opacity={isSelected ? 0.25 : 0.85}
                            stroke={isSelected ? item.dot : 'transparent'}
                            strokeWidth="1"
                        />
                        <circle cx="33" cy={item.pdfY + 5.5} r="2.2" fill={item.dot} opacity={isSelected ? 1 : 0.45} />
                    </g>
                );
            })}

            {/* Bottom source status pill showing matched citation */}
            <rect x="26" y="104" width="98" height="18" rx="5" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
            <text x="75" y="116" textAnchor="middle" fontSize="7.6" fontWeight="700" fill="#334155" fontFamily="Inter, sans-serif">
                {active.pdfNote}
            </text>

            {/* Laser Scan Beam */}
            {!shouldReduceMotion && (
                <motion.rect
                    x="15"
                    width="120"
                    height="3.5"
                    rx="1.75"
                    fill={active.dot}
                    initial={{ y: 20, opacity: 0.45 }}
                    animate={{ y: [20, 124, 20], opacity: 0.45 }}
                    transition={{ duration: 4.0, repeat: Infinity, ease: 'easeInOut' }}
                />
            )}

            {/* Dynamic Signal Connector from PDF bar to Active Card */}
            <path d="M 140 74 L 184 74" stroke="#e2e8f0" strokeWidth="1.5" strokeDasharray="3 3" />
            <motion.path
                d={`M 136 ${lineStartY} C 156 ${lineStartY}, 168 ${lineEndY}, 188 ${lineEndY}`}
                fill="none"
                stroke={active.dot}
                strokeWidth="1.8"
                strokeDasharray="4 4"
                initial={{ strokeDashoffset: 0 }}
                animate={shouldReduceMotion ? { strokeDashoffset: 0 } : { strokeDashoffset: [0, -16] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
            />
            {!shouldReduceMotion && (
                <motion.circle
                    key={`pulse-${active.id}`}
                    cx="162"
                    cy="74"
                    fill="none"
                    stroke={active.dot}
                    strokeWidth="1.4"
                    initial={{ r: 10, opacity: 0.7 }}
                    animate={{ r: [10, 17], opacity: [0.7, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                />
            )}
            <circle cx="162" cy="74" r="10" fill="#0f172a" />
            <path d="M 159.5 70 L 165 74 L 159.5 78" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

            {/* Interactive Extracted Result Cards */}
            {CLAUSE_ITEMS.map((item, idx) => {
                const isSelected = idx === selectedIdx;
                return (
                    <motion.g
                        key={item.id}
                        className="svg-interactive-node"
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedIdx(idx)}
                        onKeyDown={(e) => handleKeyActivate(e, () => setSelectedIdx(idx))}
                        initial={{ x: 0 }}
                        animate={shouldReduceMotion ? { x: 0 } : { x: isSelected ? -2 : 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <rect
                            x="188"
                            y={item.cardY}
                            width="178"
                            height="34"
                            rx="9"
                            fill={isSelected ? item.activeFill : item.fill}
                            stroke={isSelected ? item.activeStroke : item.stroke}
                            strokeWidth={isSelected ? 1.8 : 1.2}
                        />
                        <circle cx="204" cy={item.cardY + 17} r={isSelected ? 5.5 : 4.5} fill={item.dot} />
                        <text x="217" y={item.cardY + 15.5} fontSize="10.2" fontWeight="700" fill={item.textFill} fontFamily="Inter, sans-serif">
                            {item.label}
                        </text>
                        <text x="217" y={item.cardY + 26.5} fontSize="8" fontWeight="600" fill="#64748b" fontFamily="Inter, sans-serif">
                            {isSelected ? item.sub : 'Click to cite page'}
                        </text>
                    </motion.g>
                );
            })}
        </svg>
    );
}

const WATERFALL_MODES = {
    single: {
        label: 'Single AC (0% Cut)',
        nonPayableH: 14,
        nonPayableLabel: '−₹9,600',
        subY: 56,
        subH: 4,
        subLabel: '₹0 Cap Cut',
        payoutY: 60,
        payoutH: 60,
        payoutVal: '₹1,10,400',
        subColor: '#10b981',
    },
    deluxe: {
        label: 'Deluxe (Pro-Rata)',
        nonPayableH: 14,
        nonPayableLabel: '−₹9,600',
        subY: 56,
        subH: 26,
        subLabel: '−₹28k Room Cut',
        payoutY: 82,
        payoutH: 38,
        payoutVal: '₹82,400',
        subColor: '#e11d48',
    },
};

export function SvgPayoutWaterfall() {
    const [mode, setMode] = useState('deluxe');
    const [hoveredBar, setHoveredBar] = useState(null);
    const shouldReduceMotion = useReducedMotion();
    const cfg = WATERFALL_MODES[mode];
    const toggleMode = () => setMode((m) => (m === 'deluxe' ? 'single' : 'deluxe'));

    return (
        <svg viewBox="0 0 380 148" className="bento-svg-schematic" role="group" aria-label="Interactive claim payout waterfall simulator">
            <text x="16" y="17" fontSize="9.5" fontWeight="700" fill="#475569" fontFamily="Inter, sans-serif">
                Claim Simulator · Click room tier:
            </text>

            {/* Interactive Room Tier Switcher Pills */}
            {[
                { key: 'single', label: 'Single AC', x: 204, w: 68 },
                { key: 'deluxe', label: 'Deluxe Cut', x: 278, w: 86 },
            ].map((tab) => {
                const isActive = mode === tab.key;
                return (
                    <g
                        key={tab.key}
                        className="svg-interactive-node"
                        role="button"
                        tabIndex={0}
                        aria-pressed={isActive}
                        onClick={() => setMode(tab.key)}
                        onKeyDown={(e) => handleKeyActivate(e, () => setMode(tab.key))}
                    >
                        <rect
                            x={tab.x}
                            y="5"
                            width={tab.w}
                            height="18"
                            rx="9"
                            fill={isActive ? '#0f172a' : '#f1f5f9'}
                            stroke={isActive ? '#0f172a' : '#cbd5e1'}
                            strokeWidth="1"
                        />
                        <text
                            x={tab.x + tab.w / 2}
                            y="17"
                            textAnchor="middle"
                            fontSize="8.2"
                            fontWeight="700"
                            fill={isActive ? '#ffffff' : '#475569'}
                            fontFamily="Inter, sans-serif"
                        >
                            {tab.label}
                        </text>
                    </g>
                );
            })}

            <line x1="16" y1="120" x2="364" y2="120" stroke="#cbd5e1" strokeWidth="1.4" />

            {/* Hospital Bill */}
            <g
                className="svg-interactive-node"
                role="button"
                tabIndex={0}
                onMouseEnter={() => setHoveredBar('bill')}
                onMouseLeave={() => setHoveredBar(null)}
                onClick={toggleMode}
                onKeyDown={(e) => handleKeyActivate(e, toggleMode)}
            >
                <motion.rect
                    x="24"
                    width="64"
                    rx="7"
                    fill="#0f172a"
                    initial={shouldReduceMotion ? { height: 78, y: 42 } : { height: 0, y: 120 }}
                    animate={{ height: 78, y: 42 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                    opacity={hoveredBar && hoveredBar !== 'bill' ? 0.72 : 1}
                />
                <text x="56" y="36" textAnchor="middle" fontSize="10" fontWeight="700" fill="#0f172a" fontFamily="Inter, sans-serif">₹1,20,000</text>
                <text x="56" y="136" textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#475569" fontFamily="Inter, sans-serif">Total Bill</text>
            </g>

            {/* Step 1 connector */}
            <motion.line
                x1="88"
                y1="42"
                x2="118"
                y2="42"
                stroke="#94a3b8"
                strokeDasharray="3 3"
                initial={{ strokeDashoffset: 0 }}
                animate={shouldReduceMotion ? { strokeDashoffset: 0 } : { strokeDashoffset: [0, -12] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
            />

            {/* Non-Payables */}
            <g
                className="svg-interactive-node"
                role="button"
                tabIndex={0}
                onMouseEnter={() => setHoveredBar('np')}
                onMouseLeave={() => setHoveredBar(null)}
                onClick={toggleMode}
                onKeyDown={(e) => handleKeyActivate(e, toggleMode)}
            >
                <rect
                    x="118"
                    y="42"
                    width="62"
                    height={cfg.nonPayableH}
                    rx="5"
                    fill="#f59e0b"
                    opacity={hoveredBar && hoveredBar !== 'np' ? 0.72 : 1}
                />
                <text x="149" y="36" textAnchor="middle" fontSize="10" fontWeight="700" fill="#b45309" fontFamily="Inter, sans-serif">{cfg.nonPayableLabel}</text>
                <text x="149" y="136" textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#475569" fontFamily="Inter, sans-serif">Non-Payables</text>
            </g>

            {/* Step 2 connector */}
            <motion.line
                x1="180"
                y1="56"
                x2="208"
                y2="56"
                stroke="#94a3b8"
                strokeDasharray="3 3"
                initial={{ strokeDashoffset: 0 }}
                animate={shouldReduceMotion ? { strokeDashoffset: 0 } : { strokeDashoffset: [0, -12] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
            />

            {/* Room Cap Deduction */}
            <g
                className="svg-interactive-node"
                role="button"
                tabIndex={0}
                onMouseEnter={() => setHoveredBar('sub')}
                onMouseLeave={() => setHoveredBar(null)}
                onClick={toggleMode}
                onKeyDown={(e) => handleKeyActivate(e, toggleMode)}
            >
                <motion.rect
                    x="208"
                    width="64"
                    rx="5"
                    fill={cfg.subColor}
                    initial={{ y: cfg.subY, height: cfg.subH }}
                    animate={{ y: cfg.subY, height: cfg.subH }}
                    transition={{ duration: 0.42, ease: 'easeOut' }}
                    opacity={hoveredBar && hoveredBar !== 'sub' ? 0.72 : 1}
                />
                <text x="240" y="49" textAnchor="middle" fontSize="9.5" fontWeight="700" fill={cfg.subColor} fontFamily="Inter, sans-serif">{cfg.subLabel}</text>
                <text x="240" y="136" textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#475569" fontFamily="Inter, sans-serif">Sub-Limits</text>
            </g>

            {/* Step 3 connector */}
            <motion.line
                x1="272"
                x2="298"
                stroke="#94a3b8"
                strokeDasharray="3 3"
                initial={{ y1: cfg.payoutY, y2: cfg.payoutY }}
                animate={{ y1: cfg.payoutY, y2: cfg.payoutY }}
                transition={{ duration: 0.42, ease: 'easeOut' }}
            />

            {/* Estimated Insurer Payout */}
            <g
                className="svg-interactive-node"
                role="button"
                tabIndex={0}
                onMouseEnter={() => setHoveredBar('payout')}
                onMouseLeave={() => setHoveredBar(null)}
                onClick={toggleMode}
                onKeyDown={(e) => handleKeyActivate(e, toggleMode)}
            >
                <motion.rect
                    x="298"
                    width="64"
                    rx="7"
                    fill="#047857"
                    initial={{ y: cfg.payoutY, height: cfg.payoutH }}
                    animate={{ y: cfg.payoutY, height: cfg.payoutH }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                    opacity={hoveredBar && hoveredBar !== 'payout' ? 0.78 : 1}
                />
                <motion.text
                    x="330"
                    textAnchor="middle"
                    fontSize="10.2"
                    fontWeight="800"
                    fill="#047857"
                    fontFamily="Inter, sans-serif"
                    initial={{ y: cfg.payoutY - 8 }}
                    animate={{ y: cfg.payoutY - 8 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                >
                    {cfg.payoutVal}
                </motion.text>
                <text x="330" y="136" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#047857" fontFamily="Inter, sans-serif">Est. Payout</text>
            </g>
        </svg>
    );
}

const VEHICLE_ZONES = [
    {
        id: 'bumper',
        cx: 222,
        cy: 84,
        lx: 244,
        ly: 50,
        title: 'Front Bumper',
        range: '₹11k – ₹16k OEM',
        badge: '+25% Overcharge Audit',
        color: '#fb7185',
        pill: 'rgba(56, 189, 248, 0.14)',
        pillText: '#7dd3fc',
    },
    {
        id: 'windshield',
        cx: 136,
        cy: 56,
        lx: 244,
        ly: 50,
        title: 'Front Windshield',
        range: '₹7.5k – ₹11k Glass',
        badge: 'Zero-Dep 100% Claim',
        color: '#38bdf8',
        pill: 'rgba(16, 185, 129, 0.16)',
        pillText: '#6ee7b7',
    },
    {
        id: 'door',
        cx: 118,
        cy: 84,
        lx: 244,
        ly: 50,
        title: 'Side Door Panel',
        range: '₹14k – ₹21k Metal',
        badge: '0% Metal Dep Audit',
        color: '#fbbf24',
        pill: 'rgba(251, 191, 36, 0.15)',
        pillText: '#fde68a',
    },
];

export function SvgVehicleDamageBlueprint() {
    const [zoneIdx, setZoneIdx] = useState(0);
    const shouldReduceMotion = useReducedMotion();
    const active = VEHICLE_ZONES[zoneIdx];

    return (
        <svg viewBox="0 0 380 148" className="bento-svg-schematic" role="group" aria-label="Interactive vehicle exterior damage inspection HUD">
            <rect x="8" y="8" width="364" height="132" rx="12" fill="#0b1121" stroke="#1e293b" strokeWidth="1" />
            <line x1="20" y1="108" x2="360" y2="108" stroke="#1e293b" strokeWidth="1.5" />

            {/* Moving LiDAR Scanner Vertical Sweep */}
            {!shouldReduceMotion && (
                <motion.line
                    y1="38"
                    y2="106"
                    stroke="rgba(56, 189, 248, 0.45)"
                    strokeWidth="2"
                    initial={{ x1: 28, x2: 28 }}
                    animate={{ x1: [28, 228, 28], x2: [28, 228, 28] }}
                    transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut' }}
                />
            )}

            {/* Clean Vehicle Side Profile */}
            <path
                d="M 26 93 L 40 70 L 84 48 L 158 48 L 200 70 L 228 74 C 237 77, 239 93, 228 99 L 26 99 C 18 99, 20 93, 26 93 Z"
                fill="rgba(56, 189, 248, 0.09)"
                stroke="#38bdf8"
                strokeWidth="1.8"
            />
            <line x1="102" y1="50" x2="102" y2="98" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1" />
            <line x1="158" y1="49" x2="158" y2="98" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1" />

            {/* Wheels */}
            <circle cx="64" cy="100" r="14" fill="#090d16" stroke="#94a3b8" strokeWidth="2.2" />
            <circle cx="64" cy="100" r="5.5" fill="none" stroke="#cbd5e1" strokeWidth="1.4" />
            <circle cx="188" cy="100" r="14" fill="#090d16" stroke="#94a3b8" strokeWidth="2.2" />
            <circle cx="188" cy="100" r="5.5" fill="none" stroke="#cbd5e1" strokeWidth="1.4" />

            {/* Interactive Car Part Hotspots */}
            {VEHICLE_ZONES.map((z, idx) => {
                const isSelected = idx === zoneIdx;
                return (
                    <g
                        key={z.id}
                        className="svg-interactive-node"
                        role="button"
                        tabIndex={0}
                        aria-label={`Inspect ${z.title} estimate`}
                        aria-pressed={isSelected}
                        onClick={() => setZoneIdx(idx)}
                        onKeyDown={(e) => handleKeyActivate(e, () => setZoneIdx(idx))}
                    >
                        <circle cx={z.cx} cy={z.cy} r="14" fill="transparent" />
                        {isSelected && !shouldReduceMotion && (
                            <motion.circle
                                key={`hotspot-${z.id}`}
                                cx={z.cx}
                                cy={z.cy}
                                fill="none"
                                stroke={z.color}
                                strokeWidth="1.3"
                                initial={{ r: 9, opacity: 0.9 }}
                                animate={{ r: [9, 18], opacity: [0.9, 0] }}
                                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                            />
                        )}
                        <circle
                            cx={z.cx}
                            cy={z.cy}
                            r={isSelected ? 9 : 6}
                            fill={isSelected ? `${z.color}38` : 'rgba(148, 163, 184, 0.16)'}
                            stroke={isSelected ? z.color : '#64748b'}
                            strokeWidth={isSelected ? 1.8 : 1.2}
                        />
                        <circle cx={z.cx} cy={z.cy} r="2.6" fill={isSelected ? z.color : '#94a3b8'} />
                    </g>
                );
            })}

            {/* Callout Connector & Bounded Inspection Readout */}
            <line x1={active.cx + 7} y1={active.cy - 6} x2={active.lx} y2={active.ly} stroke={active.color} strokeWidth="1.4" strokeDasharray="3 2" />
            <circle cx={active.lx} cy={active.ly} r="2.4" fill={active.color} />

            <text x="250" y="45" fontSize="10" fontWeight="700" fill={active.color} fontFamily="Inter, sans-serif">{active.title}</text>
            <text x="250" y="59" fontSize="8.8" fill="#cbd5e1" fontFamily="Inter, sans-serif">{active.range}</text>
            <rect x="250" y="67" width="114" height="20" rx="5" fill={active.pill} stroke={active.pillText} strokeOpacity={0.35} />
            <text x="307" y="80" textAnchor="middle" fontSize="7.9" fontWeight="700" fill={active.pillText} fontFamily="Inter, sans-serif">{active.badge}</text>

            <text x="22" y="29" fontSize="10.5" fontWeight="700" fill="#38bdf8" fontFamily="Inter, sans-serif">
                Vision + CPU Audit · Tap Part
            </text>
            <text x="22" y="127" fontSize="9.3" fontWeight="600" fill="#34d399" fontFamily="Inter, sans-serif">
                Zero-Dep &amp; Statutory Part Tiers · Click hotspots
            </text>
        </svg>
    );
}

const THREAT_VECTORS = [
    {
        id: 'safe',
        y: 18,
        title: 'Official Insurer Verified',
        dot: '#047857',
        fill: '#ffffff',
        activeFill: '#ecfdf5',
        stroke: '#e2e8f0',
        activeStroke: '#10b981',
        text: '#0f172a',
        shieldBg: '#f0fdf4',
        shieldStroke: '#bbf7d0',
        shieldFill: '#047857',
        shieldLabel: 'Safe Domain · Verified',
        symbol: 'check',
    },
    {
        id: 'apk',
        y: 58,
        title: 'Fake .APK Link Blocked',
        dot: '#e11d48',
        fill: '#fff1f5',
        activeFill: '#ffe4e6',
        stroke: '#fecdd3',
        activeStroke: '#e11d48',
        text: '#9f1239',
        shieldBg: '#fff1f5',
        shieldStroke: '#fecdd3',
        shieldFill: '#e11d48',
        shieldLabel: 'Threat Halted · .APK',
        symbol: 'cross',
    },
    {
        id: 'upi',
        y: 98,
        title: 'Reverse-UPI Lure Flagged',
        dot: '#d97706',
        fill: '#fffbeb',
        activeFill: '#fef3c7',
        stroke: '#fde68a',
        activeStroke: '#d97706',
        text: '#92400e',
        shieldBg: '#fffbeb',
        shieldStroke: '#fde68a',
        shieldFill: '#d97706',
        shieldLabel: 'PIN Collect Trap Alert',
        symbol: 'alert',
    },
];

export function SvgBrowserShieldRadar() {
    const [activeIdx, setActiveIdx] = useState(0);
    const shouldReduceMotion = useReducedMotion();
    const active = THREAT_VECTORS[activeIdx];
    const rowMidY = active.y + 16;

    return (
        <svg viewBox="0 0 380 148" className="bento-svg-schematic" role="group" aria-label="Interactive scam shield scanner for URLs, APK downloads and UPI lures">
            {/* Clickable Detection Rows */}
            {THREAT_VECTORS.map((item, idx) => {
                const isSelected = idx === activeIdx;
                return (
                    <motion.g
                        key={item.id}
                        className="svg-interactive-node"
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        onClick={() => setActiveIdx(idx)}
                        onKeyDown={(e) => handleKeyActivate(e, () => setActiveIdx(idx))}
                        initial={{ x: 0 }}
                        animate={shouldReduceMotion ? { x: 0 } : { x: isSelected ? 4 : 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <rect
                            x="14"
                            y={item.y}
                            width="184"
                            height="32"
                            rx="9"
                            fill={isSelected ? item.activeFill : item.fill}
                            stroke={isSelected ? item.activeStroke : item.stroke}
                            strokeWidth={isSelected ? 1.8 : 1.2}
                        />
                        <circle cx="30" cy={item.y + 16} r={isSelected ? 5.5 : 4.5} fill={item.dot} />
                        <text x="44" y={item.y + 19.5} fontSize="10.2" fontWeight="700" fill={item.text} fontFamily="Inter, sans-serif">
                            {item.title}
                        </text>
                    </motion.g>
                );
            })}

            {/* Dynamic Flowing Pipe from Active Threat Row to Shield Emblem */}
            <motion.path
                d={`M 200 ${rowMidY} C 224 ${rowMidY}, 230 68, 252 68`}
                fill="none"
                stroke={active.shieldFill}
                strokeWidth="1.8"
                strokeDasharray="4 4"
                initial={{ strokeDashoffset: 0 }}
                animate={shouldReduceMotion ? { strokeDashoffset: 0 } : { strokeDashoffset: [0, -16] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            />

            {/* Radar Pulse Ring + Exact-Center Rotating Scan Arc */}
            {!shouldReduceMotion && (
                <>
                    <motion.circle
                        cx="296"
                        cy="68"
                        fill="none"
                        stroke={active.shieldStroke}
                        strokeWidth="1.3"
                        initial={{ r: 39, opacity: 0.78 }}
                        animate={{ r: [39, 47], opacity: [0.78, 0] }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
                    />
                    <g>
                        <path
                            d="M 296 24 A 44 44 0 0 1 334 46"
                            fill="none"
                            stroke={active.shieldFill}
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            opacity={0.78}
                        />
                        <animateTransform
                            attributeName="transform"
                            type="rotate"
                            from="0 296 68"
                            to="360 296 68"
                            dur="4.2s"
                            repeatCount="indefinite"
                        />
                    </g>
                </>
            )}

            {/* Shield Emblem Circle */}
            <circle cx="296" cy="68" r="38" fill={active.shieldBg} stroke={active.shieldStroke} strokeWidth="1.4" />
            <path
                d="M 296 44 L 316 52.5 L 316 69 C 316 81, 307.5 90.5, 296 95 C 284.5 90.5, 276 81, 276 69 L 276 52.5 Z"
                fill={active.shieldFill}
            />
            {active.symbol === 'check' && (
                <path d="M 287.5 68.5 L 293.5 74.5 L 305.5 62" fill="none" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            )}
            {active.symbol === 'cross' && (
                <path d="M 290 62 L 302 74 M 302 62 L 290 74" fill="none" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" />
            )}
            {active.symbol === 'alert' && (
                <>
                    <line x1="296" y1="59" x2="296" y2="70" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" />
                    <circle cx="296" cy="76.5" r="1.8" fill="#ffffff" />
                </>
            )}

            {/* Live Classification Status Caption */}
            <rect x="234" y="117" width="124" height="20" rx="10" fill={active.shieldBg} stroke={active.shieldStroke} strokeWidth="1" />
            <text x="296" y="130" textAnchor="middle" fontSize="8.8" fontWeight="700" fill={active.shieldFill} fontFamily="Inter, sans-serif">
                {active.shieldLabel}
            </text>
        </svg>
    );
}

const VOICE_LANGUAGES = [
    {
        code: 'EN',
        label: 'English',
        prompt: '"Single AC room-rent capped?"',
        badge: 'Grounded · Policy Pg 4 · Click bars',
        accent: '#e11d48',
        heights: [24, 46, 62, 36, 68, 52, 74, 44, 58, 30, 48, 26],
    },
    {
        code: 'HI',
        label: 'Hindi',
        prompt: 'Hindi: "Room-rent limit check"',
        badge: 'Bilingual Reply · Claim Page Cited',
        accent: '#0284c7',
        heights: [34, 58, 42, 68, 48, 72, 38, 64, 44, 52, 32, 46],
    },
    {
        code: 'REG',
        label: 'Regional',
        prompt: 'Regional: "30d free-look clause"',
        badge: 'IRDAI 3h Cashless & Voice Guide',
        accent: '#047857',
        heights: [28, 38, 66, 52, 34, 62, 56, 70, 36, 48, 60, 30],
    },
];

export function SvgParinidhiAcoustic() {
    const [langIdx, setLangIdx] = useState(0);
    const [listening, setListening] = useState(true);
    const shouldReduceMotion = useReducedMotion();
    const active = VOICE_LANGUAGES[langIdx];

    return (
        <svg viewBox="0 0 380 148" className="bento-svg-schematic" role="group" aria-label="Interactive multilingual voice policy assistant equalizer">
            <rect x="12" y="16" width="356" height="116" rx="12" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.2" />

            {/* Clickable Equalizer Zone */}
            <g
                className="svg-interactive-node"
                role="button"
                tabIndex={0}
                aria-label={listening ? 'Pause voice waveform' : 'Resume voice waveform'}
                aria-pressed={listening}
                onClick={() => setListening((prev) => !prev)}
                onKeyDown={(e) => handleKeyActivate(e, () => setListening((prev) => !prev))}
            >
                <rect x="22" y="28" width="144" height="92" rx="8" fill="#f8fafc" stroke="#f1f5f9" strokeWidth="1" />
                {active.heights.map((h, i) => {
                    const barColor = i % 3 === 0 ? active.accent : i % 2 === 0 ? '#0284c7' : '#94a3b8';
                    const barW = 6.5;
                    const barX = 28 + i * 11.2;
                    const minH = Math.max(12, Math.round(h * 0.45));
                    const maxH = Math.min(76, Math.round(h * 1.08));
                    return (
                        <motion.rect
                            key={`${active.code}-${i}`}
                            x={barX}
                            width={barW}
                            rx="3.2"
                            fill={barColor}
                            initial={{ y: 74 - h / 2, height: h, opacity: 0.85 }}
                            animate={
                                !shouldReduceMotion && listening
                                    ? {
                                          height: [minH, maxH, minH],
                                          y: [74 - minH / 2, 74 - maxH / 2, 74 - minH / 2],
                                          opacity: [0.65, 1, 0.65],
                                      }
                                    : { y: 74 - h / 2, height: h, opacity: 0.85 }
                            }
                            transition={
                                !shouldReduceMotion && listening
                                    ? { duration: 1.15 + (i % 4) * 0.16, delay: i * 0.06, repeat: Infinity, ease: 'easeInOut' }
                                    : { duration: 0.25 }
                            }
                        />
                    );
                })}
            </g>

            <line x1="176" y1="28" x2="176" y2="120" stroke="#e2e8f0" strokeWidth="1.4" />

            {/* Right Info + Language Switcher Pills */}
            <text x="190" y="42" fontSize="11.5" fontWeight="700" fill="#0f172a" fontFamily="Inter, sans-serif">Parinidhi Voice Advisor</text>

            {VOICE_LANGUAGES.map((lang, idx) => {
                const isSelected = idx === langIdx;
                const px = 190 + idx * 56;
                return (
                    <g
                        key={lang.code}
                        className="svg-interactive-node"
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        onClick={() => setLangIdx(idx)}
                        onKeyDown={(e) => handleKeyActivate(e, () => setLangIdx(idx))}
                    >
                        <rect
                            x={px}
                            y="50"
                            width="51"
                            height="18"
                            rx="9"
                            fill={isSelected ? lang.accent : '#f1f5f9'}
                            stroke={isSelected ? lang.accent : '#e2e8f0'}
                            strokeWidth="1"
                        />
                        <text
                            x={px + 25.5}
                            y="62"
                            textAnchor="middle"
                            fontSize="8"
                            fontWeight="700"
                            fill={isSelected ? '#ffffff' : '#475569'}
                            fontFamily="Inter, sans-serif"
                        >
                            {lang.label}
                        </text>
                    </g>
                );
            })}

            <text x="190" y="83" fontSize="9.2" fontWeight="600" fill="#475569" fontFamily="Inter, sans-serif">{active.prompt}</text>
            <rect x="190" y="94" width="164" height="24" rx="7" fill="#fff1f5" stroke="#fecdd3" />
            <text x="272" y="109" textAnchor="middle" fontSize="8.8" fontWeight="700" fill="#be123c" fontFamily="Inter, sans-serif">
                {active.badge}
            </text>
        </svg>
    );
}

const FAMILY_PROFILES = [
    {
        id: 'self',
        blood: 'O+',
        holder: 'Family Card · Primary',
        notes: 'Linked Health + Motor · Tap to switch',
    },
    {
        id: 'senior',
        blood: 'B+',
        holder: 'Parents Plan · Senior Care',
        notes: 'PED Cleared · 30d Free-Look Active',
    },
];

const HELPLINES = [
    {
        id: 'irdai',
        label: 'IRDAI · 155255',
        fill: '#047857',
        x: 26,
        detail: 'Insurance Grievance & Bima Bharosa Escalation',
    },
    {
        id: 'cyber',
        label: 'Cyber · 1930',
        fill: '#b91c1c',
        x: 139,
        detail: 'Instant Fraud & Reverse-UPI Freeze Helpline',
    },
    {
        id: 'sos',
        label: 'SOS · 112 / 108',
        fill: '#0f172a',
        x: 252,
        detail: '24x7 National Medical Ambulance & Police SOS',
    },
];

export function SvgFamilyEmergencyCard() {
    const [profileIdx, setProfileIdx] = useState(0);
    const [helplineIdx, setHelplineIdx] = useState(0);
    const shouldReduceMotion = useReducedMotion();
    const profile = FAMILY_PROFILES[profileIdx];
    const activeLine = HELPLINES[helplineIdx];

    return (
        <svg viewBox="0 0 380 148" className="bento-svg-schematic" role="group" aria-label="Interactive Family Emergency Card and national insurance helplines">
            <rect x="12" y="14" width="356" height="120" rx="12" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.2" />

            {/* Clickable Member Profile Switcher */}
            <g
                className="svg-interactive-node"
                role="button"
                tabIndex={0}
                onClick={() => setProfileIdx((p) => (p + 1) % FAMILY_PROFILES.length)}
                onKeyDown={(e) => handleKeyActivate(e, () => setProfileIdx((p) => (p + 1) % FAMILY_PROFILES.length))}
            >
                <rect x="26" y="25" width="44" height="28" rx="8" fill="#fef2f2" stroke="#fecaca" strokeWidth="1.3" />
                <text x="48" y="43.5" textAnchor="middle" fontSize="12" fontWeight="800" fill="#b91c1c" fontFamily="Inter, sans-serif">
                    {profile.blood}
                </text>
                <text x="80" y="37" fontSize="11.5" fontWeight="700" fill="#0f172a" fontFamily="Inter, sans-serif">
                    {profile.holder}
                </text>
                <text x="80" y="51" fontSize="9" fill="#64748b" fontFamily="Inter, sans-serif">
                    {profile.notes}
                </text>
            </g>

            {/* Live Heartbeat EKG Wave top-right */}
            <motion.path
                d="M 284 39 L 300 39 L 306 30 L 313 48 L 320 33 L 325 39 L 354 39"
                fill="none"
                stroke="#e11d48"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="100"
                initial={{ strokeDashoffset: 100 }}
                animate={shouldReduceMotion ? { strokeDashoffset: 0 } : { strokeDashoffset: [100, 0, -100] }}
                transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Interactive Helpline Dispatch Pills */}
            {HELPLINES.map((line, idx) => {
                const isSelected = idx === helplineIdx;
                return (
                    <motion.g
                        key={line.id}
                        className="svg-interactive-node"
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        onClick={() => setHelplineIdx(idx)}
                        onKeyDown={(e) => handleKeyActivate(e, () => setHelplineIdx(idx))}
                        initial={{ y: 0 }}
                        animate={shouldReduceMotion ? { y: 0 } : { y: isSelected ? -2 : 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <rect
                            x={line.x}
                            y="65"
                            width="102"
                            height="32"
                            rx="9"
                            fill={line.fill}
                            stroke={isSelected ? '#0f172a' : 'transparent'}
                            strokeWidth={isSelected ? 1.8 : 0}
                            opacity={isSelected ? 1 : 0.85}
                        />
                        {isSelected && !shouldReduceMotion && (
                            <motion.circle
                                cx={line.x + 10}
                                cy="81"
                                r="2.8"
                                fill="#ffffff"
                                initial={{ opacity: 0.4 }}
                                animate={{ opacity: [0.4, 1, 0.4] }}
                                transition={{ duration: 1.3, repeat: Infinity }}
                            />
                        )}
                        <text
                            x={line.x + (isSelected ? 57 : 51)}
                            y="84.5"
                            textAnchor="middle"
                            fontSize={isSelected ? '9.4' : '10'}
                            fontWeight="700"
                            fill="#ffffff"
                            fontFamily="Inter, sans-serif"
                        >
                            {line.label}
                        </text>
                    </motion.g>
                );
            })}

            {/* Live Selected Helpline Context Bar */}
            <rect x="26" y="106" width="328" height="19" rx="6" fill="#f8fafc" stroke="#e2e8f0" />
            <text x="190" y="118.5" textAnchor="middle" fontSize="8.5" fontWeight="700" fill={activeLine.fill} fontFamily="Inter, sans-serif">
                {activeLine.detail}
            </text>
        </svg>
    );
}
