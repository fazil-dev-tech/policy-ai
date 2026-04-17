const MarketData = require('../models/MarketData');
const geminiService = require('../services/gemini.service');
const grokService = require('../services/grok.service');
const logger = require('../utils/logger');

/**
 * GET /api/market/providers
 */
const getProviders = async (req, res, next) => {
    try {
        const { sortBy = 'rating', order = 'desc', policyType } = req.query;
        const query = {};

        if (policyType) {
            query.policyTypes = policyType;
        }

        const sortOrder = order === 'asc' ? 1 : -1;
        const providers = await MarketData.find(query)
            .sort({ [sortBy]: sortOrder })
            .lean();

        res.json({ providers });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/market/insights
 */
const getInsights = async (req, res, next) => {
    try {
        const providers = await MarketData.find().lean();

        // Get insights from Puter even if local providers are empty
        const puterInsights = await geminiService.generateMarketInsights(providers);

        if (providers.length === 0) {
            return res.json({
                insights: { puter: puterInsights },
                stats: { totalProviders: 0, avgSettlementRatio: 0, avgRating: 0 },
                topProviders: [],
            });
        }

        // Calculate aggregated stats
        const avgSettlementRatio =
            providers.reduce((sum, p) => sum + p.claimSettlementRatio, 0) / providers.length;
        const avgRating = providers.reduce((sum, p) => sum + p.rating, 0) / providers.length;
        const topProviders = [...providers]
            .sort((a, b) => b.claimSettlementRatio - a.claimSettlementRatio)
            .slice(0, 5);

        res.json({
            insights: {
                puter: puterInsights,
            },
            stats: {
                totalProviders: providers.length,
                avgSettlementRatio: Math.round(avgSettlementRatio * 100) / 100,
                avgRating: Math.round(avgRating * 100) / 100,
            },
            topProviders: topProviders.map((p) => ({
                name: p.providerName,
                settlementRatio: p.claimSettlementRatio,
                rating: p.rating,
                premiumRange: p.premiumRange,
            })),
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/market/providers (admin only)
 */
const addProvider = async (req, res, next) => {
    try {
        const provider = await MarketData.create(req.body);
        logger.info(`Market provider added: ${provider.providerName}`);
        res.status(201).json({ provider });
    } catch (error) {
        next(error);
    }
};

module.exports = { getProviders, getInsights, addProvider };
