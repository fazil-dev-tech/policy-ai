import { motion } from 'framer-motion';

export function SvgPolicyCisGraph() {
    return (
        <svg viewBox="0 0 380 148" className="bento-svg-schematic" role="img" aria-label="Policy PDF converted to clear coverage scorecard">
            {/* Left Source Document */}
            <rect x="14" y="16" width="122" height="116" rx="12" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.5" />
            <text x="28" y="37" fontSize="10" fontWeight="700" fill="#64748b" fontFamily="Inter, sans-serif">40-Page Policy PDF</text>
            <rect x="28" y="48" width="94" height="10" rx="5" fill="#f1f5f9" />
            <rect x="28" y="66" width="94" height="10" rx="5" fill="#ffe4e6" />
            <rect x="28" y="84" width="76" height="10" rx="5" fill="#f1f5f9" />
            <rect x="28" y="102" width="60" height="10" rx="5" fill="#e0f2fe" />
            <motion.rect
                x="14"
                y="16"
                width="122"
                height="4"
                rx="2"
                fill="#e11d48"
                opacity={0.45}
                animate={{ y: [18, 126, 18] }}
                transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Smooth Flow Path */}
            <path d="M 142 74 L 182 74" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
            <circle cx="162" cy="74" r="10" fill="#0f172a" />
            <path d="M 159 70 L 165 74 L 159 78" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

            {/* Clean Extracted Result Cards */}
            <g transform="translate(188, 16)">
                <rect width="178" height="34" rx="9" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.2" />
                <circle cx="16" cy="17" r="5" fill="#047857" />
                <text x="30" y="21" fontSize="11" fontWeight="700" fill="#0f172a" fontFamily="Inter, sans-serif">Coverage Cap · Verified</text>
            </g>
            <g transform="translate(188, 57)">
                <rect width="178" height="34" rx="9" fill="#fff1f5" stroke="#fecdd3" strokeWidth="1.2" />
                <circle cx="16" cy="17" r="5" fill="#e11d48" />
                <text x="30" y="21" fontSize="11" fontWeight="700" fill="#9f1239" fontFamily="Inter, sans-serif">Waiting Period · Cited Pg 4</text>
            </g>
            <g transform="translate(188, 98)">
                <rect width="178" height="34" rx="9" fill="#f0f9ff" stroke="#bae6fd" strokeWidth="1.2" />
                <circle cx="16" cy="17" r="5" fill="#0284c7" />
                <text x="30" y="21" fontSize="11" fontWeight="700" fill="#0369a1" fontFamily="Inter, sans-serif">PAN &amp; Aadhaar Protected</text>
            </g>
        </svg>
    );
}

export function SvgPayoutWaterfall() {
    return (
        <svg viewBox="0 0 380 148" className="bento-svg-schematic" role="img" aria-label="Sample claim payout breakdown">
            <text x="16" y="15" fontSize="9.5" fontWeight="600" fill="#64748b" fontFamily="Inter, sans-serif">Illustrative Hospital Claim Breakdown</text>

            <line x1="16" y1="120" x2="364" y2="120" stroke="#cbd5e1" strokeWidth="1.4" />

            {/* Hospital Bill */}
            <rect x="28" y="42" width="66" height="78" rx="8" fill="#0f172a" />
            <text x="61" y="34" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#0f172a" fontFamily="Inter, sans-serif">₹1,20,000</text>
            <text x="61" y="136" textAnchor="middle" fontSize="10" fontWeight="600" fill="#475569" fontFamily="Inter, sans-serif">Total Bill</text>

            {/* Deductions */}
            <line x1="94" y1="42" x2="124" y2="42" stroke="#cbd5e1" strokeDasharray="3 3" />
            <rect x="124" y="42" width="66" height="22" rx="6" fill="#f59e0b" />
            <text x="157" y="34" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#b45309" fontFamily="Inter, sans-serif">−₹9,600</text>
            <text x="157" y="136" textAnchor="middle" fontSize="10" fontWeight="600" fill="#475569" fontFamily="Inter, sans-serif">Non-Payables</text>

            {/* Room Cap Cut */}
            <line x1="190" y1="64" x2="216" y2="64" stroke="#cbd5e1" strokeDasharray="3 3" />
            <rect x="216" y="64" width="56" height="16" rx="6" fill="#e11d48" />
            <text x="244" y="56" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#be123c" fontFamily="Inter, sans-serif">−Room Cut</text>
            <text x="244" y="136" textAnchor="middle" fontSize="10" fontWeight="600" fill="#475569" fontFamily="Inter, sans-serif">Sub-Limits</text>

            {/* Est. Payout */}
            <rect x="296" y="80" width="66" height="40" rx="8" fill="#047857" />
            <text x="329" y="71" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#047857" fontFamily="Inter, sans-serif">Insurer Share</text>
            <text x="329" y="136" textAnchor="middle" fontSize="10" fontWeight="700" fill="#047857" fontFamily="Inter, sans-serif">Est. Payout</text>
        </svg>
    );
}

export function SvgVehicleDamageBlueprint() {
    return (
        <svg viewBox="0 0 380 148" className="bento-svg-schematic" role="img" aria-label="Vehicle exterior damage inspection visual">
            <rect x="8" y="8" width="364" height="132" rx="12" fill="#0b1121" stroke="#1e293b" strokeWidth="1" />
            <line x1="20" y1="108" x2="360" y2="108" stroke="#1e293b" strokeWidth="1.5" />

            {/* Clean Vehicle Side Profile shifted left so right callout has generous breathing room */}
            <path
                d="M 26 93 L 40 70 L 84 48 L 158 48 L 200 70 L 228 74 C 237 77, 239 93, 228 99 L 26 99 C 18 99, 20 93, 26 93 Z"
                fill="rgba(56, 189, 248, 0.09)"
                stroke="#38bdf8"
                strokeWidth="1.8"
            />
            <circle cx="64" cy="100" r="14" fill="#090d16" stroke="#94a3b8" strokeWidth="2.2" />
            <circle cx="64" cy="100" r="5.5" fill="none" stroke="#cbd5e1" strokeWidth="1.4" />
            <circle cx="188" cy="100" r="14" fill="#090d16" stroke="#94a3b8" strokeWidth="2.2" />
            <circle cx="188" cy="100" r="5.5" fill="none" stroke="#cbd5e1" strokeWidth="1.4" />

            {/* Highlighted Damage Zone */}
            <motion.circle
                cx="224"
                cy="84"
                r="13"
                fill="rgba(225, 29, 72, 0.24)"
                stroke="#fb7185"
                strokeWidth="1.6"
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <line x1="233" y1="71" x2="250" y2="49" stroke="#fb7185" strokeWidth="1.4" />
            <circle cx="250" cy="49" r="2.2" fill="#fb7185" />
            <text x="258" y="45" fontSize="10" fontWeight="700" fill="#fda4af" fontFamily="Inter, sans-serif">Front Bumper</text>
            <text x="258" y="59" fontSize="9" fill="#94a3b8" fontFamily="Inter, sans-serif">OEM Repair Range</text>
            <rect x="258" y="67" width="98" height="20" rx="5" fill="rgba(56, 189, 248, 0.12)" stroke="rgba(56, 189, 248, 0.35)" />
            <text x="307" y="80" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#7dd3fc" fontFamily="Inter, sans-serif">+25% Overcharge Audit</text>

            <text x="22" y="29" fontSize="10.5" fontWeight="700" fill="#38bdf8" fontFamily="Inter, sans-serif">Vision + CPU Part Assessment</text>
            <text x="22" y="127" fontSize="9.5" fontWeight="600" fill="#34d399" fontFamily="Inter, sans-serif">Includes Zero-Dep Depreciation &amp; Statutory Part Tiers</text>
        </svg>
    );
}

export function SvgBrowserShieldRadar() {
    return (
        <svg viewBox="0 0 380 148" className="bento-svg-schematic" role="img" aria-label="Browser scam shield status overview">
            {/* Official Safe Link */}
            <rect x="14" y="18" width="186" height="32" rx="9" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.2" />
            <circle cx="30" cy="34" r="5" fill="#047857" />
            <text x="44" y="38" fontSize="10.5" fontWeight="700" fill="#0f172a" fontFamily="Inter, sans-serif">Official Insurer Verified</text>

            {/* APK Block */}
            <rect x="14" y="58" width="186" height="32" rx="9" fill="#fff1f5" stroke="#fecdd3" strokeWidth="1.2" />
            <circle cx="30" cy="74" r="5" fill="#e11d48" />
            <text x="44" y="78" fontSize="10.5" fontWeight="700" fill="#9f1239" fontFamily="Inter, sans-serif">Fake .APK Link Blocked</text>

            {/* UPI Lure */}
            <rect x="14" y="98" width="186" height="32" rx="9" fill="#fffbeb" stroke="#fde68a" strokeWidth="1.2" />
            <circle cx="30" cy="114" r="5" fill="#d97706" />
            <text x="44" y="118" fontSize="10.5" fontWeight="700" fill="#92400e" fontFamily="Inter, sans-serif">Reverse-UPI Lure Flagged</text>

            {/* Shield Emblem */}
            <line x1="200" y1="74" x2="248" y2="74" stroke="#cbd5e1" strokeWidth="1.8" strokeDasharray="3 3" />
            <motion.circle
                cx="296"
                cy="74"
                r="48"
                fill="none"
                stroke="#bae6fd"
                strokeWidth="1.2"
                animate={{ scale: [1, 1.07, 1], opacity: [0.55, 0.9, 0.55] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
            <circle cx="296" cy="74" r="42" fill="#f0f9ff" stroke="#bae6fd" strokeWidth="1.4" />
            <path d="M 296 48 L 317 57 L 317 75 C 317 88, 308 98, 296 103 C 284 98, 275 88, 275 75 L 275 57 Z" fill="#0284c7" />
            <path d="M 287 74 L 293 80 L 306 67" fill="none" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function SvgParinidhiAcoustic() {
    const heights = [20, 42, 58, 34, 64, 48, 70, 40, 56, 28, 44, 24];
    return (
        <svg viewBox="0 0 380 148" className="bento-svg-schematic" role="img" aria-label="Multilingual voice policy assistant">
            <rect x="12" y="16" width="356" height="116" rx="12" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.2" />
            {heights.map((h, i) => (
                <motion.rect
                    key={i}
                    x={28 + i * 11.5}
                    y={74 - h / 2}
                    width="6.5"
                    height={h}
                    rx="3.2"
                    fill={i % 3 === 0 ? '#e11d48' : i % 2 === 0 ? '#0284c7' : '#94a3b8'}
                    animate={{ opacity: [0.55, 1, 0.55] }}
                    transition={{ duration: 1.8, delay: i * 0.1, repeat: Infinity, ease: 'easeInOut' }}
                />
            ))}
            <line x1="178" y1="30" x2="178" y2="118" stroke="#e2e8f0" strokeWidth="1.4" />
            <text x="196" y="52" fontSize="12" fontWeight="700" fill="#0f172a" fontFamily="Inter, sans-serif">Parinidhi Voice Advisor</text>
            <text x="196" y="70" fontSize="10" fill="#475569" fontFamily="Inter, sans-serif">Ask in English, Hindi &amp; regional languages</text>
            <rect x="196" y="84" width="154" height="26" rx="7" fill="#fff1f5" stroke="#fecdd3" />
            <text x="273" y="100.5" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#be123c" fontFamily="Inter, sans-serif">Grounded in Policy Pages</text>
        </svg>
    );
}

export function SvgFamilyEmergencyCard() {
    return (
        <svg viewBox="0 0 380 148" className="bento-svg-schematic" role="img" aria-label="Family Emergency Card and helplines">
            <rect x="12" y="16" width="356" height="116" rx="12" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.2" />
            <rect x="28" y="32" width="44" height="28" rx="8" fill="#fef2f2" stroke="#fecaca" />
            <text x="50" y="50" textAnchor="middle" fontSize="12" fontWeight="800" fill="#b91c1c" fontFamily="Inter, sans-serif">O+</text>
            <text x="84" y="44" fontSize="12" fontWeight="700" fill="#0f172a" fontFamily="Inter, sans-serif">Family Emergency Card</text>
            <text x="84" y="60" fontSize="9.5" fill="#64748b" fontFamily="Inter, sans-serif">Blood Group · Linked Policy · PED Notes</text>
            <rect x="28" y="76" width="102" height="36" rx="9" fill="#047857" />
            <text x="79" y="97.5" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#ffffff" fontFamily="Inter, sans-serif">IRDAI · 155255</text>
            <rect x="139" y="76" width="102" height="36" rx="9" fill="#b91c1c" />
            <text x="190" y="97.5" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#ffffff" fontFamily="Inter, sans-serif">Cyber · 1930</text>
            <rect x="250" y="76" width="102" height="36" rx="9" fill="#0f172a" />
            <text x="301" y="97.5" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#ffffff" fontFamily="Inter, sans-serif">SOS · 112 / 108</text>
        </svg>
    );
}
