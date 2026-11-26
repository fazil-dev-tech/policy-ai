const { supabaseAdmin } = require('../config/supabase');
const grokService = require('./grok.service');
const logger = require('../utils/logger');

const analyzePolicyFraud = async (policyData, { skipAi = false } = {}) => {
    try {
        const ruleBasedFlags = [];
        let ruleBasedScore = 0;

        if (Number(policyData.coverageAmount) > 50000000) {
            ruleBasedFlags.push('Unusually high coverage amount (> 5 Crore)');
            ruleBasedScore += 15;
        }

        const startDate = new Date(policyData.startDate);
        const endDate = new Date(policyData.endDate);
        const durationDays = (endDate - startDate) / (1000 * 60 * 60 * 24);

        if (!Number.isNaN(durationDays)) {
            if (durationDays < 0) {
                ruleBasedFlags.push('Policy end date precedes start date');
                ruleBasedScore += 35;
            } else if (durationDays < 30) {
                ruleBasedFlags.push('Very short policy duration');
                ruleBasedScore += 10;
            }
            if (durationDays > 365 * 10) {
                ruleBasedFlags.push('Unusually long policy duration');
                ruleBasedScore += 5;
            }
        }

        if (!policyData.policyNumber || policyData.policyNumber.length < 3) {
            ruleBasedFlags.push('Missing or invalid policy number');
            ruleBasedScore += 20;
        }

        const aiAnalysis = skipAi ? null : await grokService.analyzeFraud(policyData);
        const aiUnknown = !aiAnalysis || aiAnalysis.riskLevel === 'unknown';
        const combinedScore = Math.min(
            100,
            aiUnknown ? ruleBasedScore : Math.round((ruleBasedScore + (Number(aiAnalysis.fraudScore) || 0)) / 2)
        );

        return {
            overallScore: combinedScore,
            riskLevel: combinedScore > 70 ? 'critical' : combinedScore > 40 ? 'high' : combinedScore > 20 ? 'medium' : 'low',
            ruleBasedFlags,
            aiFlags: aiAnalysis?.indicators || [],
            aiAnomalies: aiAnalysis?.anomalies || [],
            recommendation: aiAnalysis?.recommendation || (ruleBasedFlags.length ? ruleBasedFlags.join('; ') : 'Deterministic schedule checks passed'),
            confidence: aiAnalysis?.confidence || (skipAi ? 85 : 0),
        };
    } catch (error) {
        logger.error('Fraud analysis error:', error.message);
        return {
            overallScore: 0,
            riskLevel: 'unknown',
            ruleBasedFlags: [],
            aiFlags: [],
            aiAnomalies: [],
            recommendation: 'Fraud analysis temporarily unavailable',
            confidence: 0,
        };
    }
};

const getFraudAlerts = async (limit = 20) => {
    try {
        const [{ data: suspiciousPolicies, error: polErr }, { data: recentClaims, error: clmErr }] = await Promise.all([
            supabaseAdmin
                .from('policies')
                .select('id, policy_number, verification_score, provider_name, created_at, profiles(name, email)')
                .lt('verification_score', 50)
                .order('verification_score', { ascending: true })
                .limit(limit),
            supabaseAdmin
                .from('claims')
                .select('id, claim_amount, claim_date, ai_guidance, policies(policy_number), profiles(name)')
                .order('created_at', { ascending: false })
                .limit(100),
        ]);

        if (polErr) logger.warn('Failed to fetch suspicious policies:', polErr.message);
        if (clmErr) logger.warn('Failed to fetch claims for fraud alerts:', clmErr.message);

        const suspiciousClaims = (recentClaims || [])
            .filter((c) => Number(c.ai_guidance?.fraudRisk?.score || 0) > 50)
            .sort((a, b) => Number(b.ai_guidance?.fraudRisk?.score || 0) - Number(a.ai_guidance?.fraudRisk?.score || 0))
            .slice(0, limit);

        return {
            policies: (suspiciousPolicies || []).map((p) => ({
                id: p.id,
                policyNumber: p.policy_number,
                user: p.profiles?.name || 'Unknown',
                email: p.profiles?.email || '',
                verificationScore: p.verification_score,
                providerName: p.provider_name,
                createdAt: p.created_at,
            })),
            claims: suspiciousClaims.map((c) => ({
                id: c.id,
                policyNumber: c.policies?.policy_number || 'Unknown',
                user: c.profiles?.name || 'Unknown',
                claimAmount: Number(c.claim_amount),
                fraudScore: Number(c.ai_guidance?.fraudRisk?.score || 0),
                flags: c.ai_guidance?.fraudRisk?.flags || [],
                claimDate: c.claim_date,
            })),
        };
    } catch (error) {
        logger.error('Error fetching fraud alerts:', error.message);
        return { policies: [], claims: [] };
    }
};

module.exports = {
    analyzePolicyFraud,
    getFraudAlerts,
};
