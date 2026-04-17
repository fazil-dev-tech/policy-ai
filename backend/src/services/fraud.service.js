const Policy = require('../models/Policy');
const Claim = require('../models/Claim');
const grokService = require('./grok.service');
const logger = require('../utils/logger');

/**
 * Analyze policy for fraud indicators
 */
const analyzePolicyFraud = async (policyData) => {
    try {
        // Rule-based checks first
        const ruleBasedFlags = [];
        let ruleBasedScore = 0;

        // Check coverage amount vs premium (suspicious if extremely high coverage)
        if (policyData.coverageAmount > 10000000) {
            ruleBasedFlags.push('Unusually high coverage amount');
            ruleBasedScore += 15;
        }

        // Check policy dates
        const startDate = new Date(policyData.startDate);
        const endDate = new Date(policyData.endDate);
        const durationDays = (endDate - startDate) / (1000 * 60 * 60 * 24);

        if (durationDays < 30) {
            ruleBasedFlags.push('Very short policy duration');
            ruleBasedScore += 10;
        }

        if (durationDays > 365 * 10) {
            ruleBasedFlags.push('Unusually long policy duration');
            ruleBasedScore += 5;
        }

        // Check for missing information
        if (!policyData.policyNumber || policyData.policyNumber.length < 3) {
            ruleBasedFlags.push('Missing or invalid policy number');
            ruleBasedScore += 20;
        }

        // AI-based analysis using Grok
        const aiAnalysis = await grokService.analyzeFraud(policyData);

        // Combine scores
        const combinedScore = Math.min(100, Math.round((ruleBasedScore + aiAnalysis.fraudScore) / 2));

        return {
            overallScore: combinedScore,
            riskLevel: combinedScore > 70 ? 'critical' : combinedScore > 40 ? 'high' : combinedScore > 20 ? 'medium' : 'low',
            ruleBasedFlags,
            aiFlags: aiAnalysis.indicators || [],
            aiAnomalies: aiAnalysis.anomalies || [],
            recommendation: aiAnalysis.recommendation || 'No AI analysis available',
            confidence: aiAnalysis.confidence || 0,
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

/**
 * Get fraud alerts for admin dashboard
 */
const getFraudAlerts = async (limit = 20) => {
    try {
        const suspiciousPolicies = await Policy.find({
            verificationScore: { $lt: 50 },
        })
            .populate('userId', 'name email')
            .sort({ verificationScore: 1 })
            .limit(limit)
            .lean();

        const suspiciousClaims = await Claim.find({
            'aiGuidance.fraudRisk.score': { $gt: 50 },
        })
            .populate('policyId', 'policyNumber providerName')
            .populate('userId', 'name email')
            .sort({ 'aiGuidance.fraudRisk.score': -1 })
            .limit(limit)
            .lean();

        return {
            policies: suspiciousPolicies.map((p) => ({
                id: p._id,
                policyNumber: p.policyNumber,
                user: p.userId?.name || 'Unknown',
                email: p.userId?.email || '',
                verificationScore: p.verificationScore,
                providerName: p.providerName,
                createdAt: p.createdAt,
            })),
            claims: suspiciousClaims.map((c) => ({
                id: c._id,
                policyNumber: c.policyId?.policyNumber || 'Unknown',
                user: c.userId?.name || 'Unknown',
                claimAmount: c.claimAmount,
                fraudScore: c.aiGuidance?.fraudRisk?.score || 0,
                flags: c.aiGuidance?.fraudRisk?.flags || [],
                claimDate: c.claimDate,
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
