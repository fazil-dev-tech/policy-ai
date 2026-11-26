const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const sanitizeWinAnsi = (text = '') => {
    return String(text || '')
        .replace(/₹/g, 'INR ')
        .replace(/[—–]/g, '-')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/•/g, '*')
        .replace(/[^\x20-\x7E\n]/g, ' ');
};

const wrapLines = (text, maxChars = 84) => {
    const out = [];
    for (const para of sanitizeWinAnsi(text).split('\n')) {
        const words = para.split(/\s+/).filter(Boolean);
        if (words.length === 0) {
            out.push('');
            continue;
        }
        let line = '';
        for (const rawWord of words) {
            // Break long tokens (URLs / policy numbers) so lines never clip off the PDF page
            const chunks = rawWord.length > maxChars ? rawWord.match(new RegExp(`.{1,${maxChars}}`, 'g')) || [rawWord] : [rawWord];
            for (const w of chunks) {
                if ((line + ' ' + w).trim().length > maxChars) {
                    if (line.trim()) out.push(line.trim());
                    line = w;
                } else {
                    line = `${line} ${w}`.trim();
                }
            }
        }
        if (line) out.push(line.trim());
    }
    return out;
};

const createPdfWriter = async (title) => {
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage([595, 842]);
    let y = 795;

    const addHeader = () => {
        page.drawRectangle({ x: 0, y: 785, width: 595, height: 57, color: rgb(0.925, 0.282, 0.6) });
        page.drawText('PolicyGuard | Insurance Intelligence', {
            x: 36,
            y: 814,
            size: 13,
            font: fontBold,
            color: rgb(1, 1, 1),
        });
        page.drawText(sanitizeWinAnsi(title), {
            x: 36,
            y: 797,
            size: 10,
            font: fontRegular,
            color: rgb(1, 0.92, 0.96),
        });
        y = 755;
    };

    addHeader();

    const ensureSpace = (needed = 24) => {
        if (y - needed < 48) {
            page = pdfDoc.addPage([595, 842]);
            y = 790;
        }
    };

    const heading = (text) => {
        ensureSpace(28);
        page.drawText(sanitizeWinAnsi(text), {
            x: 36,
            y,
            size: 12,
            font: fontBold,
            color: rgb(0.06, 0.09, 0.16),
        });
        y -= 18;
    };

    const paragraph = (text, size = 10) => {
        for (const line of wrapLines(text, 88)) {
            ensureSpace(16);
            page.drawText(line, {
                x: 36,
                y,
                size,
                font: fontRegular,
                color: rgb(0.2, 0.25, 0.33),
            });
            y -= 14;
        }
        y -= 4;
    };

    const kv = (label, value) => {
        const labelStr = sanitizeWinAnsi(`${label}:`);
        const valLines = wrapLines(String(value || 'N/A'), 56);
        ensureSpace(Math.max(18, valLines.length * 14 + 4));
        const labelTooWide = labelStr.length > 26;
        page.drawText(labelStr.slice(0, 48), {
            x: 36,
            y,
            size: 10,
            font: fontBold,
            color: rgb(0.06, 0.09, 0.16),
        });
        if (labelTooWide) y -= 14;
        for (const vl of valLines.slice(0, 6)) {
            ensureSpace(15);
            page.drawText(vl, {
                x: labelTooWide ? 48 : 205,
                y,
                size: 10,
                font: fontRegular,
                color: rgb(0.2, 0.25, 0.33),
            });
            y -= 14;
        }
        y -= 2;
    };

    return {
        pdfDoc,
        heading,
        paragraph,
        kv,
        spacer: (px = 8) => {
            y -= px;
        },
        toBuffer: async () => Buffer.from(await pdfDoc.save()),
    };
};

const generateClaimGuidePdf = async ({ policy = {}, incident = {}, calculation = {}, readiness = {} }) => {
    const w = await createPdfWriter('Personalized Claim Preparation & Verification Guide');

    w.heading('1. Policy & Incident Summary');
    w.kv('Provider / Insurer', policy.providerName || policy.provider_name || 'N/A');
    w.kv('Policy Number', policy.policyNumber || policy.policy_number || 'N/A');
    w.kv('Scenario Type', incident.scenario_type || incident.scenarioType || 'medical_claim');
    w.kv('Claim Verdict', calculation.verdict || 'Verification Required');
    w.kv('Estimated Gross Bill', `INR ${Number(calculation.grossBill || incident.estimated_amount || 0).toLocaleString('en-IN')}`);
    w.kv('Estimated Insurer Share', `INR ${Number(calculation.insurerShare || 0).toLocaleString('en-IN')}`);
    w.kv('Estimated Out-of-Pocket', `INR ${Number(calculation.outOfPocket || 0).toLocaleString('en-IN')}`);
    w.kv('Readiness Score', `${readiness.readinessScore ?? incident.readiness_score ?? 0}%`);
    w.spacer();

    if ((calculation.waterfall || []).length > 0) {
        w.heading('2. Deterministic Payout Waterfall');
        for (const step of calculation.waterfall) {
            w.kv(step.label, `INR ${Number(step.amount || 0).toLocaleString('en-IN')}`);
        }
        w.spacer();
    }

    if ((calculation.alerts || []).length > 0) {
        w.heading('3. Critical Alerts & IRDAI Checks');
        for (const alert of calculation.alerts) {
            w.paragraph(`- ${alert}`);
        }
        w.spacer();
    }

    if (calculation.moratorium?.note) {
        w.heading('4. IRDAI 60-Month Moratorium & Helpline');
        w.paragraph(calculation.moratorium.note);
        w.kv('24x7 Claim Helpline', policy.aiSummary?.helplineNumber || policy.ai_summary?.helplineNumber || 'Refer Policy Schedule / IRDAI 155255');
        w.spacer();
    }

    w.heading('5. Document Readiness Checklist');
    for (const c of readiness.checks || []) {
        w.paragraph(`[${c.completed ? 'READY' : 'MISSING'}] ${c.label}${c.tip ? ` -- ${c.tip}` : ''}`);
    }

    w.spacer();
    w.paragraph('Disclaimer: PolicyGuard provides structured preparation guidance based on uploaded documents and IRDAI guidelines. Final settlement authority rests with your insurer and TPA.', 8);

    return w.toBuffer();
};

const generateGrievanceLetterPdf = async ({ settlement = {}, policy = {} }) => {
    const w = await createPdfWriter('IRDAI Claim Shortfall & GRO Escalation Draft');
    w.heading(`Policy: ${policy.policyNumber || policy.policy_number || 'N/A'} (${policy.providerName || policy.provider_name || 'Insurer'})`);
    w.kv('Claimed Amount', `INR ${Number(settlement.claimed_amount ?? settlement.claimedAmount ?? 0).toLocaleString('en-IN')}`);
    w.kv('Approved Amount', `INR ${Number(settlement.approved_amount ?? settlement.approvedAmount ?? 0).toLocaleString('en-IN')}`);
    w.kv('Shortfall Disputed', `INR ${Number(settlement.shortfall_amount ?? settlement.shortfallAmount ?? 0).toLocaleString('en-IN')}`);
    w.spacer();
    w.paragraph(settlement.grievance_letter || settlement.grievanceLetter || '');
    return w.toBuffer();
};

const generateEmergencyCardPdf = async ({ policy = {}, cis = {}, member = null }) => {
    const w = await createPdfWriter('Digital Hospital & Emergency Policy Card');
    w.heading('Immediate Cashless Admission Card');
    if (member) {
        w.kv('Patient / Member', `${member.full_name} (${member.relationship})`);
        if (member.blood_group) w.kv('Blood Group', member.blood_group);
        if (member.emergency_contact) w.kv('Family Contact', member.emergency_contact);
    }
    w.kv('Insurer', cis.insurerName || policy.providerName || policy.provider_name || 'N/A');
    w.kv('Policy Number', cis.policyNumber || policy.policyNumber || policy.policy_number || 'N/A');
    w.kv('Sum Insured', `INR ${Number(cis.sumInsured ?? policy.coverageAmount ?? policy.coverage_amount ?? 0).toLocaleString('en-IN')}`);
    w.kv('Eligible Room Category', cis.roomRentLimit || 'Check Schedule');
    w.kv('24x7 Helpline', cis.helplineNumber || '1800 / Refer Policy');
    w.kv('Cashless Intimation Rule', cis.cashlessIntimationRule || 'Within 24 hours of admission');
    w.kv('IRDAI Discharge SLA', cis.irdaiDischargeSla || '3 hours from final bill submission');
    w.kv('Moratorium Shield', cis.moratoriumStatus || 'Verify Inception Date');
    return w.toBuffer();
};

module.exports = {
    generateClaimGuidePdf,
    generateGrievanceLetterPdf,
    generateEmergencyCardPdf,
};
