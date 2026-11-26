/**
 * Deterministic Insurance Math, IRDAI 2024-2026 Compliance & Claim Engine
 * Rule: Zero LLM arithmetic! All payouts, deductibles, depreciation, moratorium,
 * room-rent proportionate deductions, and scores are calculated here deterministically.
 */

const INDIAN_MOTOR_DEPRECIATION = {
    plastic: 0.5,
    rubber: 0.5,
    nylon: 0.5,
    fiberglass: 0.3,
    glass: 0.0,
    paint: 0.5,
    electrical: 0.5,
};

const getMetalDepreciationRate = (vehicleAgeYears = 2) => {
    const age = Number(vehicleAgeYears) || 0;
    if (age <= 0.5) return 0;
    if (age <= 1) return 0.05;
    if (age <= 2) return 0.1;
    if (age <= 3) return 0.15;
    if (age <= 4) return 0.25;
    if (age <= 5) return 0.35;
    if (age <= 10) return 0.4;
    return 0.5;
};

const toNum = (val, fallback = 0) => {
    if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
    if (typeof val === 'string') {
        const m = val.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
        if (m) {
            const parsed = Number(m[0]);
            return Number.isFinite(parsed) ? parsed : fallback;
        }
    }
    return fallback;
};

/**
 * IRDAI May 2024 Master Circular: 60-Month (5-Year) Continuous Coverage Moratorium
 */
const checkMoratorium60Months = (inceptionDate, referenceDate = new Date()) => {
    if (!inceptionDate) {
        return {
            known: false,
            active: false,
            continuousMonths: null,
            monthsRemaining: null,
            note: 'Date of First Policy Inception not detected — verify if policy has completed 60 continuous months.',
        };
    }

    const start = new Date(inceptionDate);
    const ref = new Date(referenceDate);
    if (Number.isNaN(start.getTime())) {
        return { known: false, active: false, continuousMonths: null, monthsRemaining: null, note: 'Invalid inception date.' };
    }

    let months = (ref.getFullYear() - start.getFullYear()) * 12 + (ref.getMonth() - start.getMonth());
    if (ref.getDate() < start.getDate()) months -= 1;
    const safeMonths = Math.max(0, months);
    const active = safeMonths >= 60;

    return {
        known: true,
        active,
        continuousMonths: safeMonths,
        monthsRemaining: active ? 0 : 60 - safeMonths,
        note: active
            ? `IRDAI 60-Month Moratorium ACTIVE (${safeMonths} months continuous cover): Non-fraud PED or non-disclosure grounds cannot be used to contest claims.`
            : `${safeMonths} months completed (${60 - safeMonths} months remaining to reach the 60-month IRDAI moratorium shield).`,
    };
};

/**
 * Compute transparent Policy Health Score (0-100), 6-Axis Radar, & Gap Finder
 */
const calculateHealthScore = (policy = {}, terms = {}) => {
    const policyType = String(policy.policyType || policy.policy_type || 'health').toLowerCase();
    const coverageAmount = Number(policy.coverageAmount ?? policy.coverage_amount ?? 0);
    const mergedTerms = { ...(policy.structured_terms || {}), ...(terms || {}) };
    const summary = policy.aiSummary || policy.ai_summary || {};
    const combinedText = `${summary.coverage || ''} ${summary.exclusions || ''} ${summary.simpleSummary || ''}`.toLowerCase();

    const moratorium = checkMoratorium60Months(
        mergedTerms.inceptionDate || policy.inception_date || policy.startDate || policy.start_date
    );

    const hasZeroDep = Boolean(mergedTerms.zeroDep) || /zero\s*dep/i.test(combinedText);
    const hasRestoration = Boolean(mergedTerms.restoration) || /restor|refill|recharge/i.test(combinedText);
    const hasRoomPerDayCap = toNum(mergedTerms.roomRentPerDayCap, 0) > 0;
    const noRoomCap =
        !hasRoomPerDayCap &&
        ((mergedTerms.roomRentCapPct === null && !/proportionate|room\s*rent\s*(?:cap|limit|1%)/i.test(combinedText)) ||
            toNum(mergedTerms.roomRentCapPct, 0) >= 100 ||
            (/(?<!not\s)at actuals|\bno capping\b|\bno room rent limit\b/i.test(combinedText) &&
                !/room\s*rent\s*limit/i.test(combinedText)));
    const copayMatch = combinedText.match(/\b(\d{1,2})%\s*co-?pay/i);
    const termCopay = toNum(mergedTerms.coPayPct, 0);
    const copayPct = Math.min(80, Math.max(0, termCopay > 0 ? termCopay : copayMatch ? Number(copayMatch[1]) : 0));
    const initialWaitDays = Math.max(0, toNum(mergedTerms.initialWaitingDays, 30));
    const pedMatch = combinedText.match(/\b(12|24|36|48)\s*months?\b/i);
    const termPed = toNum(mergedTerms.pedWaitingMonths, 0);
    const pedWaitMonths = Math.max(0, termPed > 0 ? termPed : pedMatch ? Number(pedMatch[1]) : 36);
    const hasHelpline = Boolean(summary.helplineNumber || mergedTerms.helplineNumber);

    const checklist = [];
    const gaps = [];
    let score = 0;

    // 1. Sum Insured Adequacy (25 pts)
    let coveragePts = 10;
    if (policyType === 'health') {
        coveragePts = coverageAmount >= 1000000 ? 25 : coverageAmount >= 500000 ? 18 : 10;
        if (coverageAmount > 0 && coverageAmount < 500000) {
            gaps.push('Sum Insured below ₹5,00,000 leaves major metro hospitalization exposed; consider a super top-up.');
        }
    } else if (coverageAmount > 0) {
        coveragePts = 22;
    }
    score += coveragePts;
    checklist.push({
        item: 'Coverage / Sum Insured Adequacy',
        status: coveragePts >= 20 ? 'strong' : 'warning',
        detail: coverageAmount > 0 ? `₹${coverageAmount.toLocaleString('en-IN')}` : 'Verify exact Sum Insured on Schedule',
    });

    // 2. Room Rent / Depreciation Protection (20 pts)
    let roomPts = 12;
    if (policyType === 'auto') {
        roomPts = hasZeroDep ? 20 : 10;
        if (!hasZeroDep) gaps.push('Zero-Depreciation add-on not detected — plastic (50%) and metal depreciation will reduce cash payout.');
        checklist.push({
            item: 'Zero-Depreciation Add-on',
            status: hasZeroDep ? 'strong' : 'missing',
            detail: hasZeroDep ? 'Covered' : 'Not confirmed in schedule',
        });
    } else {
        roomPts = noRoomCap ? 20 : 10;
        if (!noRoomCap) gaps.push('Room rent cap may trigger Proportionate Deduction across surgeon, OT, and diagnostic charges.');
        checklist.push({
            item: 'Room Rent Capping Rule',
            status: noRoomCap ? 'strong' : 'warning',
            detail: noRoomCap ? 'Single Private / At Actuals' : 'Sub-limit detected — check proportionate deduction risk',
        });
    }
    score += roomPts;

    // 3. Restoration / NCB / Moratorium (20 pts)
    const restorePts = hasRestoration || moratorium.active ? 20 : 10;
    score += restorePts;
    checklist.push({
        item: policyType === 'auto' ? 'NCB / Add-on Protection' : 'Automatic Restoration / NCB',
        status: hasRestoration ? 'strong' : 'warning',
        detail: hasRestoration ? 'Included in policy wording' : 'Check restoration clause before second claim',
    });

    // 4. Co-pay & Deductible Shield (20 pts)
    const copayPts = copayPct === 0 ? 20 : copayPct <= 10 ? 14 : 8;
    score += copayPts;
    if (copayPct > 0) gaps.push(`${copayPct}% Co-pay clause applies out-of-pocket sharing on approved claim amounts.`);
    checklist.push({
        item: 'Co-Pay Burden',
        status: copayPct === 0 ? 'strong' : 'warning',
        detail: copayPct === 0 ? '0% Mandatory Co-pay' : `${copayPct}% Co-pay detected`,
    });

    // 5. Claim Readiness & Emergency Helpline (15 pts)
    const readyPts = (hasHelpline ? 8 : 3) + (summary.exclusions ? 7 : 3);
    score += readyPts;
    if (!hasHelpline) gaps.push('24x7 Claim Helpline not extracted cleanly — confirm toll-free number before admission.');
    if (!moratorium.known) gaps.push('Verify First Inception Date for IRDAI 60-month PED moratorium status.');

    const radar = [
        { axis: 'Adequacy', score: Math.round((coveragePts / 25) * 100) },
        { axis: policyType === 'auto' ? 'Zero-Dep' : 'Room Comfort', score: Math.round((roomPts / 20) * 100) },
        { axis: 'Restoration', score: Math.round((restorePts / 20) * 100) },
        { axis: 'Waiting Safety', score: moratorium.active ? 100 : pedWaitMonths <= 24 ? 75 : 55 },
        { axis: 'Co-pay Shield', score: Math.round((copayPts / 20) * 100) },
        { axis: 'Emergency Info', score: Math.round((readyPts / 15) * 100) },
    ];

    return {
        healthScore: Math.min(100, Math.max(0, Math.round(score))),
        radar,
        checklist,
        gaps,
        moratorium,
        detectedTerms: {
            coverageAmount,
            hasZeroDep,
            hasRestoration,
            noRoomCap,
            copayPct,
            initialWaitDays,
            pedWaitMonths,
        },
    };
};

const buildCisCard = (policy = {}, terms = {}, evaluation = null) => {
    const scoreData = evaluation || calculateHealthScore(policy, terms);
    const summary = policy.aiSummary || policy.ai_summary || {};
    const mergedTerms = { ...(policy.structured_terms || {}), ...(terms || {}) };
    return {
        policyNumber: policy.policyNumber || policy.policy_number || 'N/A',
        insurerName: policy.providerName || policy.provider_name || 'Unknown Insurer',
        policyType: policy.policyType || policy.policy_type || 'health',
        sumInsured: Number(policy.coverageAmount ?? policy.coverage_amount ?? 0),
        roomRentLimit: mergedTerms.roomRentLabel || (scoreData.detectedTerms.noRoomCap ? 'Up to Single Standard A/C Room' : '1% of Sum Insured / day'),
        coPay: `${scoreData.detectedTerms.copayPct}%`,
        deductible: `₹${Number(mergedTerms.deductible || 0).toLocaleString('en-IN')}`,
        initialWaitingPeriod: `${scoreData.detectedTerms.initialWaitDays} days (except accidents)`,
        specificWaitingPeriod: '24 months (listed procedures)',
        pedWaitingPeriod: `${scoreData.detectedTerms.pedWaitMonths} months`,
        moratoriumStatus: scoreData.moratorium.note,
        cashlessIntimationRule: 'Within 24 hours of emergency hospitalization / 48 hours prior to planned admission',
        irdaiDischargeSla: '3 hours from final discharge bill receipt (IRDAI Cashless SLA)',
        helplineNumber: summary.helplineNumber || mergedTerms.helplineNumber || 'Check Schedule / Call 155255 (IRDAI)',
    };
};

/**
 * Deterministic Health / Hospitalization Claim Payout Calculator + Proportionate Deduction
 */
const computeHealthClaimEstimate = (policy = {}, terms = {}, input = {}) => {
    const billAmount = Math.max(0, toNum(input.estimatedBill ?? input.estimatedAmount, 0));
    const roomPerDay = Math.max(0, toNum(input.roomRentPerDay, 0));
    const inputRoomCap = toNum(input.policyRoomCapPerDay, 0);
    const termRoomCap = toNum(terms.roomRentPerDayCap, 0);
    const pctRoomCap = toNum(terms.roomRentCapPct, 0) > 0 ? (toNum(policy.coverageAmount ?? policy.coverage_amount, 0) * toNum(terms.roomRentCapPct, 0)) / 100 : 0;
    const policyRoomCap = inputRoomCap > 0 ? inputRoomCap : termRoomCap > 0 ? termRoomCap : pctRoomCap;
    const copayPct = Math.min(80, Math.max(0, toNum(input.copayPct, toNum(terms.coPayPct, 0))));
    const deductible = Math.max(0, toNum(input.deductible, toNum(terms.deductible, 0)));
    const consumablesPct = Math.min(35, Math.max(0, toNum(input.consumablesPct, 8)));
    const sumInsured = Math.max(0, toNum(policy.coverageAmount ?? policy.coverage_amount, 0));
    const priorClaims = Math.max(0, toNum(input.priorClaimsInYear, 0));
    const hasRestoration = Boolean(input.hasRestoration ?? terms.restoration);

    const incidentDate = input.incidentDate ? new Date(input.incidentDate) : new Date();
    const policyStart = policy.startDate || policy.start_date ? new Date(policy.startDate || policy.start_date) : null;
    const rawPolicyEnd = policy.endDate || policy.end_date ? new Date(policy.endDate || policy.end_date) : null;
    const policyEnd = rawPolicyEnd && !Number.isNaN(rawPolicyEnd.getTime()) ? new Date(rawPolicyEnd.getTime()) : null;
    if (policyEnd) policyEnd.setUTCHours(23, 59, 59, 999);
    const isAccident = Boolean(input.isAccident);
    const isPedRelated = Boolean(input.isPedRelated);
    const moratorium = checkMoratorium60Months(terms.inceptionDate || policy.inception_date || policyStart, incidentDate);

    const alerts = [];
    let verdict = 'Covered';

    if (sumInsured === 0) {
        verdict = 'Verification Required';
        alerts.push('Policy Sum Insured is not verified on record (₹0); estimate shown before Sum Insured ceiling.');
    }

    // Eligibility guardrails BEFORE payout math
    if (policyEnd && incidentDate > policyEnd) {
        verdict = 'Not Covered';
        alerts.push(`Policy expired on ${policyEnd.toLocaleDateString('en-IN')} before incident date.`);
    }
    if (policyStart && !Number.isNaN(policyStart.getTime())) {
        const daysSinceStart = Math.floor((incidentDate - policyStart) / (1000 * 60 * 60 * 24));
        if (daysSinceStart < 0) {
            verdict = 'Not Covered';
            alerts.push('Incident date is prior to policy risk start date.');
        } else if (daysSinceStart < 30 && !isAccident) {
            verdict = 'Not Covered';
            alerts.push(`30-day initial waiting period trap (${daysSinceStart} days active). Non-accidental illnesses are excluded.`);
        }
    }
    if (isPedRelated && !moratorium.active) {
        const pedMonths = toNum(terms.pedWaitingMonths, 36);
        if (!moratorium.known || moratorium.continuousMonths < pedMonths) {
            if (verdict !== 'Not Covered') verdict = 'Verification Required';
            alerts.push(
                moratorium.known
                    ? `Declared PED waiting period (${pedMonths} months) vs ${moratorium.continuousMonths} months completed — verify exact ICD/PED match.`
                    : `Declared PED waiting period (${pedMonths} months) requires verifying first policy inception date.`
            );
        }
    }
    if (input.isPartialDoc) {
        if (verdict === 'Covered') verdict = 'Verification Required';
        alerts.push('Partial document / E-card only uploaded — upload full policy wording to confirm disease-wise sub-limits.');
    }

    const nonPayableConsumables = Math.round(billAmount * (consumablesPct / 100));
    const afterConsumables = Math.max(0, billAmount - nonPayableConsumables);

    let proportionateFactor = 1;
    let proportionateDeduction = 0;
    if (policyRoomCap > 0 && roomPerDay > policyRoomCap) {
        proportionateFactor = policyRoomCap / roomPerDay;
        const cappedAmount = Math.round(afterConsumables * proportionateFactor);
        proportionateDeduction = Math.max(0, afterConsumables - cappedAmount);
        if (verdict === 'Covered') verdict = 'Verification Required';
        alerts.push(
            `Proportionate Room-Rent Deduction triggered: Selected room ₹${roomPerDay.toLocaleString('en-IN')}/day exceeds eligible cap ₹${policyRoomCap.toLocaleString('en-IN')}/day (${Math.round((1 - proportionateFactor) * 100)}% reduction across associated bills).`
        );
    }

    const admissibleAfterRoom = Math.max(0, afterConsumables - proportionateDeduction);
    const afterDeductible = Math.max(0, admissibleAfterRoom - deductible);
    const copayAmount = Math.round(afterDeductible * (copayPct / 100));
    const preCapPayable = Math.max(0, afterDeductible - copayAmount);

    let availableSi = Math.max(0, sumInsured - priorClaims);
    if (hasRestoration && priorClaims > 0 && preCapPayable > availableSi) {
        availableSi = Math.max(availableSi, sumInsured);
        alerts.push('Automatic Sum Insured Restoration applied for balance shortfall.');
    }

    const insurerShare = verdict === 'Not Covered' ? 0 : sumInsured > 0 ? Math.min(preCapPayable, availableSi) : preCapPayable;
    const siExcessLoss = Math.max(0, preCapPayable - insurerShare);
    const outOfPocket = Math.max(0, billAmount - insurerShare);

    const waterfall = [
        { label: 'Estimated Hospital Bill', amount: billAmount, type: 'gross' },
        { label: `Non-Payable Consumables (${consumablesPct}%)`, amount: -nonPayableConsumables, type: 'deduction' },
        ...(proportionateDeduction > 0
            ? [{ label: 'Proportionate Room Rent Deduction', amount: -proportionateDeduction, type: 'deduction' }]
            : []),
        ...(deductible > 0 ? [{ label: 'Policy Deductible', amount: -deductible, type: 'deduction' }] : []),
        ...(copayAmount > 0 ? [{ label: `Mandatory Co-pay (${copayPct}%)`, amount: -copayAmount, type: 'deduction' }] : []),
        ...(siExcessLoss > 0 ? [{ label: 'Above Available Sum Insured', amount: -siExcessLoss, type: 'deduction' }] : []),
        { label: 'Estimated Insurer Payout', amount: insurerShare, type: 'payout' },
        { label: 'Your Out-of-Pocket Expense', amount: outOfPocket, type: 'oop' },
    ];

    return {
        verdict,
        alerts,
        moratorium,
        grossBill: billAmount,
        insurerShare,
        outOfPocket,
        deductions: {
            nonPayableConsumables,
            proportionateDeduction,
            deductible,
            copayAmount,
            siExcessLoss,
        },
        waterfall,
        auditTrail: {
            engine: 'PolicyGuard_Deterministic_IRDAI_v2',
            formula: '((Bill - Consumables) * RoomRatio - Deductible) * (1 - CoPay) <= AvailableSI',
            inputsUsed: { billAmount, roomPerDay, policyRoomCap, copayPct, deductible, consumablesPct, sumInsured },
            calculatedAt: new Date().toISOString(),
        },
    };
};

const computeWhatIfRoomRent = ({
    estimatedBill = 120000,
    selectedRoomRent = 6000,
    policyRoomCap = 5000,
    copayPct = 0,
    deductible = 0,
    consumablesPct = 8,
    sumInsured = 1000000,
}) => {
    return computeHealthClaimEstimate(
        { coverageAmount: sumInsured },
        { coPayPct: copayPct, deductible },
        {
            estimatedBill,
            roomRentPerDay: selectedRoomRent,
            policyRoomCapPerDay: policyRoomCap,
            copayPct,
            deductible,
            consumablesPct,
        }
    );
};

/**
 * Deterministic Motor Own-Damage Estimator (Repair Cost vs Payout Split)
 */
const computeMotorClaimEstimate = ({
    damagedParts = [],
    benchmarks = [],
    vehicleInfo = {},
    policy = {},
    garageQuoteTotal = 0,
}) => {
    const benchmarkMap = new Map((benchmarks || []).map((b) => [b.part_key, b]));
    const vehicleAgeYears = Math.max(0, new Date().getFullYear() - (Number(vehicleInfo.year) || new Date().getFullYear() - 2));
    const zeroDep = Boolean(vehicleInfo.zeroDep ?? policy.structured_terms?.zeroDep);
    const engineCc = Number(vehicleInfo.engineCc || 1200);
    const compulsoryDeductible = Number(vehicleInfo.compulsoryDeductible || (engineCc > 1500 ? 2000 : 1000));
    const idv = Number(vehicleInfo.idv || policy.coverageAmount || 500000);

    let repairMin = 0;
    let repairMax = 0;
    let totalDepreciation = 0;
    const itemizedParts = [];

    for (const part of damagedParts) {
        const key = String(part.partKey || part.part_key || '').toLowerCase();
        const severity = String(part.severity || 'moderate').toLowerCase();
        const bench = benchmarkMap.get(key);

        const sevMin = Number(
            part.repairMin ??
                (bench
                    ? bench[`${severity}_min`] ?? bench.moderate_min
                    : severity === 'severe'
                      ? 12000
                      : severity === 'minor'
                        ? 2000
                        : 5500)
        );
        const sevMax = Number(
            part.repairMax ??
                (bench
                    ? bench[`${severity}_max`] ?? bench.moderate_max
                    : severity === 'severe'
                      ? 28000
                      : severity === 'minor'
                        ? 5000
                        : 14000)
        );
        const laborPaint = Number(bench?.labor_paint_avg ?? 3000);
        const partAvg = Math.round((sevMin + sevMax) / 2);
        const material = part.material || bench?.material_type || 'plastic';
        const depRate = zeroDep
            ? 0
            : material === 'metal'
              ? getMetalDepreciationRate(vehicleAgeYears)
              : INDIAN_MOTOR_DEPRECIATION[material] ?? 0.5;

        const depAmount = Math.round(partAvg * depRate);
        repairMin += sevMin + Math.round(laborPaint * 0.7);
        repairMax += sevMax + Math.round(laborPaint * 1.2);
        totalDepreciation += depAmount;

        itemizedParts.push({
            partKey: key || 'body_panel',
            partLabel: part.partLabel || bench?.part_label || key.replace(/_/g, ' '),
            severity,
            material,
            action: part.action || (severity === 'severe' ? 'Replace' : severity === 'moderate' ? 'Repair / Replace' : 'Dent & Repaint'),
            repairMin: sevMin + Math.round(laborPaint * 0.7),
            repairMax: sevMax + Math.round(laborPaint * 1.2),
            repairMid: partAvg + laborPaint,
            depreciationPct: Math.round(depRate * 100),
            depreciationDeduction: depAmount,
        });
    }

    const expectedRepairMid = Math.round((repairMin + repairMax) / 2);
    const referenceTotal = Number(garageQuoteTotal) > 0 ? Number(garageQuoteTotal) : expectedRepairMid;
    const scaledDepreciation =
        Number(garageQuoteTotal) > 0 && expectedRepairMid > 0
            ? Math.round((totalDepreciation / expectedRepairMid) * referenceTotal)
            : totalDepreciation;
    const fileCharge = Number(vehicleInfo.fileProcessingFee || 0);
    const voluntaryDeductible = Number(vehicleInfo.voluntaryDeductible || 0);
    const grossInsurerEligible = Math.max(0, referenceTotal - scaledDepreciation - compulsoryDeductible - voluntaryDeductible - fileCharge);
    const estimatedPayout = Math.min(idv, grossInsurerEligible);
    const outOfPocket = Math.max(0, referenceTotal - estimatedPayout);

    const quoteOverchargeWarning =
        Number(garageQuoteTotal) > 0 && repairMax > 0 && Number(garageQuoteTotal) > repairMax * 1.25
            ? `Uploaded garage quote (₹${Number(garageQuoteTotal).toLocaleString('en-IN')}) is >25% above typical OEM benchmark max (₹${repairMax.toLocaleString('en-IN')}). Check labor & consumables line items.`
            : null;

    return {
        itemizedParts,
        repairEstimate: {
            min: repairMin,
            max: repairMax,
            mid: expectedRepairMid,
            garageQuoteProvided: Number(garageQuoteTotal) || 0,
            quoteOverchargeWarning,
        },
        insurancePayout: {
            idv,
            zeroDepApplied: zeroDep,
            vehicleAgeYears,
            totalDepreciation,
            compulsoryDeductible,
            estimatedPayout,
            outOfPocket,
            ncbImpactNote: 'Filing an Own-Damage claim resets No Claim Bonus (20–50%) on renewal unless NCB Protect add-on is active.',
        },
    };
};

const computeSettlementShortfall = ({
    claimedAmount = 0,
    approvedAmount = 0,
    lineItems = [],
    policyNumber = 'POLICY',
    insurerName = 'Insurer',
    claimantName = 'Policyholder',
}) => {
    const claimed = Math.max(0, Number(claimedAmount) || 0);
    const approved = Math.max(0, Number(approvedAmount) || 0);
    const shortfall = Math.max(0, claimed - approved);
    const discrepancyFlags = [];

    for (const item of lineItems) {
        const billed = Number(item.claimed || item.billed || 0);
        const allowed = Number(item.approved || item.allowed || 0);
        const gap = billed - allowed;
        if (gap > 0) {
            const reason = String(item.reason || '').toLowerCase();
            const questionable = !reason || reason.includes('other') || reason.includes('admin') || reason.includes('unexplained') || gap / Math.max(1, billed) > 0.35;
            discrepancyFlags.push({
                itemName: item.name || item.itemName || 'Line Item',
                gap,
                reason: item.reason || 'No clause cited',
                disputeRecommended: questionable,
            });
        }
    }

    if (discrepancyFlags.length === 0 && shortfall > 0) {
        discrepancyFlags.push({
            itemName: 'Total Unexplained Shortfall',
            gap: shortfall,
            reason: 'Detailed deduction break-up missing from settlement sheet',
            disputeRecommended: true,
        });
    }

    const grievanceLetter = `Subject: Request for Claim Deduction Clarification & Re-evaluation – Policy No. ${policyNumber}

To the Grievance Redressal Officer (GRO),
${insurerName}

Dear Sir/Madam,

I am writing regarding my claim submitted under Policy No. ${policyNumber} by ${claimantName}. Against a total claimed bill of ₹${claimed.toLocaleString('en-IN')}, only ₹${approved.toLocaleString('en-IN')} has been approved, leaving a shortfall of ₹${shortfall.toLocaleString('en-IN')}.

Under IRDAI Protection of Policyholders' Interests Regulations, kindly furnish the itemized deduction sheet citing the exact policy clause and page number for the following disputed/unexplained amounts:
${discrepancyFlags.map((d, idx) => `${idx + 1}. ${d.itemName}: Deducted ₹${Number(d.gap).toLocaleString('en-IN')} (${d.reason})`).join('\n')}

Please review and release the balance admissible amount within 15 days, failing which I shall escalate this matter to the IRDAI Bima Bharosa portal (bimabharosa.irdai.gov.in) and the Office of the Insurance Ombudsman.

Sincerely,
${claimantName}`;

    return {
        claimedAmount: claimed,
        approvedAmount: approved,
        shortfallAmount: shortfall,
        recoveryRatioPct: claimed > 0 ? Math.round((approved / claimed) * 100) : 0,
        discrepancyFlags,
        grievanceLetter,
    };
};

const computeReadinessChecklist = (scenarioType, evidenceList = [], policy = {}, incidentDate = new Date()) => {
    const categories = new Set((evidenceList || []).map((e) => e.doc_category || e.docCategory));
    const parsedTime = new Date(incidentDate).getTime();
    const hoursElapsed = Number.isNaN(parsedTime) ? 999 : (Date.now() - parsedTime) / (1000 * 60 * 60);

    const checks = [
        {
            key: 'policy_linked',
            label: 'Active Policy Document / E-Card Linked',
            completed: Boolean(policy?.id || policy?._id) || categories.has('policy_pdf') || categories.has('e_card'),
            required: true,
        },
        {
            key: 'kyc_id',
            label: 'Policyholder ID & Cancelled Cheque / NEFT Details',
            completed: false,
            required: true,
            tip: 'Keep Aadhaar/PAN + cancelled cheque ready for TPA KYC & NEFT settlement; check once verified.',
        },
    ];

    if (scenarioType === 'motor_accident') {
        checks.push(
            { key: 'photos', label: 'Clear Multi-Angle Accident Damage Photos', completed: categories.has('vehicle_photo'), required: true },
            { key: 'quote', label: 'Authorized Garage Repair Estimate / Quote', completed: categories.has('garage_quote'), required: false },
            { key: 'dl_rc', label: 'Valid Driving License & Vehicle RC Verification', completed: categories.has('dl_rc'), required: true }
        );
    } else if (scenarioType === 'settlement_audit') {
        checks.push(
            { key: 'settlement', label: 'Settlement Sheet / Deduction Advice Uploaded', completed: categories.has('settlement_sheet'), required: true },
            { key: 'bill', label: 'Final Hospital / Garage Bill Uploaded', completed: categories.has('hospital_estimate') || categories.has('garage_quote'), required: true }
        );
    } else {
        checks.push(
            { key: 'script', label: 'Doctor Consultation Note / Prescription', completed: categories.has('doctor_script'), required: true },
            { key: 'estimate', label: 'Itemized Hospital Estimate / Final Bill', completed: categories.has('hospital_estimate') || categories.has('discharge_summary'), required: true },
            { key: 'diagnostics', label: 'Diagnostic Lab Reports / X-Ray Supporting Diagnosis', completed: categories.has('lab_xray'), required: false }
        );
    }

    if (hoursElapsed >= 0 && hoursElapsed <= 24) {
        checks.push({
            key: 'intimation',
            label: '24-Hour Cashless / Emergency Intimation Window Open',
            completed: false,
            required: true,
            tip: `Notify insurer TPA helpline (${policy?.aiSummary?.helplineNumber || '1800 toll-free'}) immediately to lock intimation reference ID.`,
        });
    }

    const doneCount = checks.filter((c) => c.completed).length;
    const readinessScore = Math.round((doneCount / checks.length) * 100);
    return { readinessScore, doneCount, totalCount: checks.length, checks };
};

const comparePolicyRenewal = (oldSummary = {}, newSummary = {}, oldCov = 0, newCov = 0) => {
    const diffs = [];
    if (Number(newCov) !== Number(oldCov)) {
        diffs.push({
            field: 'Sum Insured / Coverage',
            oldValue: `₹${Number(oldCov).toLocaleString('en-IN')}`,
            newValue: `₹${Number(newCov).toLocaleString('en-IN')}`,
            severity: Number(newCov) < Number(oldCov) ? 'warning' : 'improved',
        });
    }
    for (const key of ['coverage', 'exclusions', 'claimProcedure', 'helplineNumber']) {
        const a = String(oldSummary?.[key] || '').trim();
        const b = String(newSummary?.[key] || '').trim();
        if (a && b && a !== b) {
            diffs.push({
                field: key,
                oldValue: a.slice(0, 180),
                newValue: b.slice(0, 180),
                severity: key === 'exclusions' ? 'warning' : 'changed',
            });
        }
    }
    return diffs;
};

const auditAgentPromise = (promisedTerms = {}, policy = {}) => {
    const summaryText = `${policy.aiSummary?.coverage || ''} ${policy.aiSummary?.exclusions || ''} ${policy.aiSummary?.simpleSummary || ''}`.toLowerCase();
    const discrepancies = [];

    if (promisedTerms.zeroWaitingPeriod && /30\s*days|waiting period|24\s*months|36\s*months/i.test(summaryText)) {
        discrepancies.push({
            promise: 'Zero Waiting Period promised',
            actual: 'Policy wording explicitly states statutory waiting periods (30 days / specific / PED).',
            risk: 'high',
        });
    }
    if (promisedTerms.zeroDepPromised && !/zero\s*dep/i.test(summaryText) && policy.policyType === 'auto') {
        discrepancies.push({
            promise: 'Zero Depreciation promised',
            actual: 'Zero-Depreciation cover was not detected in the issued policy schedule.',
            risk: 'high',
        });
    }
    if (promisedTerms.noRoomCapPromised && /1%\s*of\s*sum|room\s*rent\s*limit|proportionate/i.test(summaryText)) {
        discrepancies.push({
            promise: 'Single Room / No Room Cap promised',
            actual: 'Policy contains room rent sub-limit language.',
            risk: 'medium',
        });
    }
    if (promisedTerms.promisedSumInsured && Number(promisedTerms.promisedSumInsured) > Number(policy.coverageAmount || 0)) {
        discrepancies.push({
            promise: `Promised ₹${Number(promisedTerms.promisedSumInsured).toLocaleString('en-IN')} cover`,
            actual: `Issued policy Sum Insured is only ₹${Number(policy.coverageAmount || 0).toLocaleString('en-IN')}.`,
            risk: 'high',
        });
    }

    return {
        status: discrepancies.length > 0 ? 'mis_selling_risk' : 'verified_match',
        discrepancies,
        freeLookNote: 'IRDAI grants a 30-day Free-Look Period on digital/retail policies from receipt to cancel for a pro-rata refund if mis-sold.',
    };
};

module.exports = {
    checkMoratorium60Months,
    calculateHealthScore,
    buildCisCard,
    computeHealthClaimEstimate,
    computeWhatIfRoomRent,
    computeMotorClaimEstimate,
    computeSettlementShortfall,
    computeReadinessChecklist,
    comparePolicyRenewal,
    auditAgentPromise,
};
