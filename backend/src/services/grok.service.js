const { init, getAuthToken } = require('@heyputer/puter.js/src/init.cjs');
const logger = require('../utils/logger');

let puterClient = null;

const getPuterClient = async () => {
    if (puterClient) return puterClient;
    const env = require('../config/env');
    let token = env.PUTER_AUTH_TOKEN;
    if (!token) {
        logger.info('PUTER_AUTH_TOKEN not found, starting browser-based auth...');
        token = await getAuthToken();
    }
    puterClient = init(token || undefined);
    return puterClient;
};

// ============================================
// PUTER-SPECIFIC AI PROMPTS
// ============================================

const FRAUD_ANALYSIS_PROMPT = `You are an advanced insurance fraud detection specialist. Analyze the following policy data and identify potential fraud indicators.

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

/**
 * Safely parse Puter AI response
 */
const extractText = (response) => {
    if (typeof response === 'string') return response;
    if (response?.message?.content) return response.message.content;
    if (response?.text) return response.text;
    return JSON.stringify(response);
};

/**
 * Analyze policy for fraud using Puter.js
 */
const analyzeFraud = async (policyData, claimData = null) => {
    try {
        const puter = await getPuterClient();

        const dataToAnalyze = {
            policy: policyData,
            claim: claimData,
        };

        const prompt = `${FRAUD_ANALYSIS_PROMPT}\n\nData to Analyze:\n${JSON.stringify(dataToAnalyze, null, 2)}`;
        const response = await puter.ai.chat(prompt);
        const text = extractText(response);

        let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const result = JSON.parse(cleaned);

        logger.info(`Puter fraud analysis complete. Score: ${result.fraudScore}`);
        return result;
    } catch (error) {
        logger.error('Puter fraud analysis failed:', error.message);
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

/**
 * Alternative AI chat using Puter 
 */
const chatWithGrok = async (userMessage, policyContext, conversationHistory = []) => {
    throw new Error('Not implemented. Please use gemini.service.chatAboutPolicy via Puter integration instead.');
};

/**
 * Alternative market analysis using Puter
 */
const analyzeMarket = async (marketData) => {
    throw new Error('Not implemented. Please use gemini.service.generateMarketInsights via Puter integration instead.');
};

module.exports = {
    analyzeFraud,
    analyzeMarket,
    chatWithGrok,
    getPuterClient,
};
