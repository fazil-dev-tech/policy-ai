const claimEngine = require('../src/services/claimEngine.service');

describe('claimEngine deterministic math and IRDAI compliance', () => {
    describe('checkMoratorium60Months', () => {
        test('returns unknown when inceptionDate is omitted', () => {
            const res = claimEngine.checkMoratorium60Months(null);
            expect(res.known).toBe(false);
            expect(res.active).toBe(false);
        });

        test('marks moratorium inactive before 60 continuous months', () => {
            const res = claimEngine.checkMoratorium60Months('2024-01-01', '2026-06-15');
            expect(res.known).toBe(true);
            expect(res.active).toBe(false);
            expect(res.continuousMonths).toBe(29);
            expect(res.monthsRemaining).toBe(31);
        });

        test('activates moratorium at or after 60 continuous months', () => {
            const res = claimEngine.checkMoratorium60Months('2020-01-01', '2026-02-01');
            expect(res.known).toBe(true);
            expect(res.active).toBe(true);
            expect(res.continuousMonths).toBeGreaterThanOrEqual(60);
            expect(res.monthsRemaining).toBe(0);
        });
    });

    describe('calculateHealthScore', () => {
        test('does not false-flag 10% senior co-pay or room cap on Any-Room ₹10L policy when coPayPct is 0', () => {
            const evalRes = claimEngine.calculateHealthScore(
                {
                    policyType: 'health',
                    coverageAmount: 1000000,
                    aiSummary: {
                        coverage: 'Any room (Except suite or above category). Automatic restoration up to 100%.',
                        exclusions: 'Proportionate deductions are not applied where differential billing is not adopted. 10% co-pay applies for entry age 61 years and above.',
                        helplineNumber: '1800-425-2255',
                    },
                },
                {
                    coPayPct: 0,
                    roomRentCapPct: null,
                    roomRentLabel: 'Any room (Except suite or above category)',
                    restoration: true,
                }
            );
            expect(evalRes.detectedTerms.noRoomCap).toBe(true);
            expect(evalRes.detectedTerms.copayPct).toBe(0);
            expect(evalRes.healthScore).toBe(100);
        });
    });

    describe('computeHealthClaimEstimate & proportionate room rent', () => {
        test('calculates deterministic payout waterfall with proportionate room rent deduction', () => {
            const result = claimEngine.computeHealthClaimEstimate(
                { coverageAmount: 500000 },
                { coPayPct: 10, deductible: 5000 },
                {
                    estimatedBill: 100000,
                    roomRentPerDay: 8000,
                    policyRoomCapPerDay: 4000,
                    copayPct: 10,
                    deductible: 5000,
                    consumablesPct: 10,
                }
            );

            // Bill = 100000; 10% consumables = 10000 -> afterConsumables = 90000
            // Room ratio = 4000 / 8000 = 0.5 -> cappedAmount = 45000 (proportionateDeduction = 45000)
            // After deductible 5000 = 40000; 10% co-pay = 4000 -> insurerShare = 36000
            expect(result.deductions.nonPayableConsumables).toBe(10000);
            expect(result.deductions.proportionateDeduction).toBe(45000);
            expect(result.deductions.deductible).toBe(5000);
            expect(result.deductions.copayAmount).toBe(4000);
            expect(result.insurerShare).toBe(36000);
            expect(result.outOfPocket).toBe(64000);
            expect(result.verdict).toBe('Verification Required');
        });

        test('computeWhatIfRoomRent delegates accurately', () => {
            const whatIf = claimEngine.computeWhatIfRoomRent({
                estimatedBill: 100000,
                selectedRoomRent: 4000,
                policyRoomCap: 5000,
                copayPct: 0,
                deductible: 0,
                consumablesPct: 8,
                sumInsured: 500000,
            });
            expect(whatIf.deductions.proportionateDeduction).toBe(0);
            expect(whatIf.insurerShare).toBe(92000);
        });
    });

    describe('computeMotorClaimEstimate', () => {
        test('waives depreciation with zeroDep and detects garage overcharge', () => {
            const benchmarks = [
                {
                    part_key: 'front_bumper',
                    part_label: 'Front Bumper',
                    material_type: 'plastic',
                    std_depreciation_pct: 50,
                    moderate_min: 8000,
                    moderate_max: 12000,
                },
            ];
            const res = claimEngine.computeMotorClaimEstimate({
                damagedParts: [{ partKey: 'front_bumper', severity: 'moderate' }],
                benchmarks,
                vehicleInfo: { year: 2022, zeroDep: true, engineCc: 1200, idv: 600000 },
                garageQuoteTotal: 25000,
            });
            expect(res.insurancePayout.zeroDepApplied).toBe(true);
            expect(res.insurancePayout.totalDepreciation).toBe(0);
            expect(res.repairEstimate.quoteOverchargeWarning).toBeTruthy();
        });

        test('applies ₹100 IRDAI compulsory deductible and fallback bike parts for two_wheeler', () => {
            const currentYear = new Date().getFullYear();
            const res = claimEngine.computeMotorClaimEstimate({
                damagedParts: [
                    { partKey: 'fuel_tank', severity: 'moderate' },
                    { partKey: 'front_mudguard', severity: 'severe' },
                ],
                benchmarks: [],
                vehicleInfo: {
                    vehicleCategory: 'two_wheeler',
                    bikeTier: 'commuter',
                    year: currentYear - 2,
                    zeroDep: false,
                },
            });
            expect(res.vehicleCategory).toBe('two_wheeler');
            expect(res.insurancePayout.vehicleCategory).toBe('two_wheeler');
            expect(res.insurancePayout.compulsoryDeductible).toBe(100);
            expect(res.insurancePayout.idv).toBe(75000);
            expect(res.itemizedParts[0].partLabel).toBe('Fuel Tank');
            expect(res.itemizedParts[0].depreciationPct).toBe(10);
            expect(res.itemizedParts[1].depreciationPct).toBe(50);
            expect(res.insurancePayout.estimatedPayout).toBeGreaterThan(0);
        });

        test('scales two_wheeler repair estimates for premium_ev tier and waives depreciation with zeroDep', () => {
            const currentYear = new Date().getFullYear();
            const commuter = claimEngine.computeMotorClaimEstimate({
                damagedParts: [{ partKey: 'bike_fairing', severity: 'severe' }],
                benchmarks: [],
                vehicleInfo: { vehicleCategory: 'two_wheeler', bikeTier: 'commuter', year: currentYear - 2, idv: 90000 },
            });
            const premiumEv = claimEngine.computeMotorClaimEstimate({
                damagedParts: [{ partKey: 'bike_fairing', severity: 'severe' }],
                benchmarks: [],
                vehicleInfo: { vehicleCategory: 'two_wheeler', bikeTier: 'premium_ev', year: currentYear - 2, idv: 180000, zeroDep: true },
            });
            expect(premiumEv.bikeTier).toBe('premium_ev');
            expect(premiumEv.repairEstimate.mid).toBeGreaterThan(commuter.repairEstimate.mid * 1.6);
            expect(premiumEv.insurancePayout.compulsoryDeductible).toBe(100);
            expect(premiumEv.insurancePayout.totalDepreciation).toBe(0);
        });
    });

    describe('computeSettlementShortfall', () => {
        test('computes shortfall, flags questionable deductions and generates GRO letter', () => {
            const decoded = claimEngine.computeSettlementShortfall({
                claimedAmount: 150000,
                approvedAmount: 95000,
                lineItems: [{ itemName: 'Admin Fee', claimed: 20000, approved: 0, reason: 'Unexplained admin' }],
                policyNumber: 'POL-9988',
                insurerName: 'Test Health Insurer',
                claimantName: 'Asha Rao',
            });
            expect(decoded.shortfallAmount).toBe(55000);
            expect(decoded.recoveryRatioPct).toBe(63);
            expect(decoded.discrepancyFlags[0].disputeRecommended).toBe(true);
            expect(decoded.grievanceLetter).toContain('POL-9988');
            expect(decoded.grievanceLetter).toContain('bimabharosa.irdai.gov.in');
        });
    });

    describe('computeReadinessChecklist', () => {
        test('resolves dl_rc via extracted_data.subCategory for motor_accident', () => {
            const readiness = claimEngine.computeReadinessChecklist(
                'motor_accident',
                [
                    { doc_category: 'vehicle_photo', extracted_data: {} },
                    { doc_category: 'other', extracted_data: { subCategory: 'dl_rc' } },
                ],
                { id: 'pol-1' }
            );
            const dlRc = readiness.checks.find((c) => c.key === 'dl_rc');
            const photos = readiness.checks.find((c) => c.key === 'photos');
            expect(photos.completed).toBe(true);
            expect(dlRc.completed).toBe(true);
        });
    });

    describe('auditAgentPromise', () => {
        test('flags waiting period discrepancy when agent promised zero wait', () => {
            const audit = claimEngine.auditAgentPromise(
                { zeroWaitingPeriod: true, promisedSumInsured: 1000000 },
                { coverageAmount: 500000, aiSummary: { exclusions: 'Standard 30 days & 36 months PED waiting period.' } }
            );
            expect(audit.status).toBe('mis_selling_risk');
            expect(audit.discrepancies.length).toBeGreaterThanOrEqual(2);
        });

        test('does not false-flag noRoomCapPromised when wording says proportionate deductions are not applied', () => {
            const audit = claimEngine.auditAgentPromise(
                { noRoomCapPromised: true },
                {
                    coverageAmount: 1000000,
                    aiSummary: {
                        coverage: 'Any room (Except suite or above category)',
                        exclusions: 'Proportionate deductions are not applied where differential billing is absent.',
                    },
                }
            );
            expect(audit.status).toBe('verified_match');
            expect(audit.discrepancies).toHaveLength(0);
        });
    });

    describe('buildCisCard unknown room rent honesty', () => {
        test('does not fabricate 1% room rent limit when room terms were not explicitly detected', () => {
            const cis = claimEngine.buildCisCard(
                {
                    policyType: 'health',
                    coverageAmount: 1000000,
                    aiSummary: { coverage: 'Hospitalization up to Sum Insured', exclusions: 'Standard waiting periods' },
                },
                { coPayPct: 0 }
            );
            expect(cis.roomRentLimit).toBe('Verify in Policy Schedule / Clause Citations');
        });
    });
});
