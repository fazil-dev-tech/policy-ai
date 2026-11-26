const aiService = require('./ai.service');
const logger = require('../utils/logger');

const FRAUD_ANALYSIS_PROMPT = `You are an Indian insurance fraud & authenticity verification specialist.
Evaluate policy metadata strictly and realistically:
- Legitimate Indian retail policies (e.g. Star Health, HDFC ERGO, ICICI Lombard, LIC, Bajaj Allianz) with Sum Insured INR 50,000 - 5,00,00,000 and standard 1-3 year periods should score LOW fraud risk (0-18) unless obvious tampering, contradictory amounts, or fabricated identifiers appear.

IMPORTANT: Respond ONLY with valid JSON.

Return:
{
  "fraudScore": 0-100,
  "riskLevel": "low" | "medium" | "high" | "critical",
  "indicators": ["list of specific fraud indicators found"],
  "anomalies": ["list of data anomalies detected"],
  "recommendation": "detailed recommendation",
  "confidence": 0-100
}`;

const analyzeFraud = async (policyData, claimData = null) => {
    try {
        const sanitizedPolicy = policyData
            ? {
                  policyNumber: policyData.policyNumber,
                  providerName: policyData.providerName,
                  policyType: policyData.policyType,
                  coverageAmount: policyData.coverageAmount,
                  startDate: policyData.startDate,
                  endDate: policyData.endDate,
                  overview: policyData.aiSummary?.overview || '',
                  helplineNumber: policyData.aiSummary?.helplineNumber || '',
              }
            : null;
        const dataToAnalyze = {
            policy: sanitizedPolicy,
            claim: claimData,
        };

        const prompt = `${FRAUD_ANALYSIS_PROMPT}\n\nData to Analyze:\n${JSON.stringify(dataToAnalyze, null, 2)}`;
        const { data: result, provider } = await aiService.generateJson(prompt);

        logger.info(`Fraud analysis complete via ${provider}. Score: ${result.fraudScore}`);
        return result;
    } catch (error) {
        logger.error('Fraud analysis failed:', error.message);
        return {
            fraudScore: 0,
            riskLevel: 'unknown',
            indicators: [],
            anomalies: [],
            recommendation: 'Fraud analysis temporarily unavailable',
            confidence: 0,
        };
    }
};

module.exports = {
    analyzeFraud,
};
