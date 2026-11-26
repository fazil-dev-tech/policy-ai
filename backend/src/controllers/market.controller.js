const { supabaseAdmin } = require('../config/supabase');
const geminiService = require('../services/gemini.service');
const { mapMarketProvider } = require('../utils/mappers');
const logger = require('../utils/logger');

const SORT_COLUMN_MAP = {
    rating: 'rating',
    claimSettlementRatio: 'claim_settlement_ratio',
    averageClaimTime: 'average_claim_time',
    providerName: 'provider_name',
    lastUpdated: 'last_updated',
};

const getProviders = async (req, res, next) => {
    try {
        const { sortBy = 'rating', order = 'desc', policyType } = req.query;
        const sortColumn = SORT_COLUMN_MAP[sortBy] || 'rating';
        const ascending = order === 'asc';

        let query = supabaseAdmin.from('market_data').select('*');
        if (policyType) {
            query = query.contains('policy_types', [policyType]);
        }

        const { data, error } = await query.order(sortColumn, { ascending });
        if (error) return next(error);

        res.json({ providers: (data || []).map(mapMarketProvider) });
    } catch (error) {
        next(error);
    }
};

const getInsights = async (req, res, next) => {
    try {
        const { data: rows, error } = await supabaseAdmin.from('market_data').select('*');
        if (error) return next(error);

        const providers = (rows || []).map(mapMarketProvider);
        const aiResult = await geminiService.generateMarketInsights(providers);

        const insightsPayload = {
            summary: aiResult.text,
            provider: aiResult.provider,
            model: aiResult.model,
            puter: aiResult.text,
        };

        if (providers.length === 0) {
            return res.json({
                insights: insightsPayload,
                stats: { totalProviders: 0, avgSettlementRatio: 0, avgRating: 0 },
                topProviders: [],
            });
        }

        const avgSettlementRatio =
            providers.reduce((sum, p) => sum + p.claimSettlementRatio, 0) / providers.length;
        const avgRating = providers.reduce((sum, p) => sum + p.rating, 0) / providers.length;
        const topProviders = [...providers]
            .sort((a, b) => b.claimSettlementRatio - a.claimSettlementRatio)
            .slice(0, 5);

        res.json({
            insights: insightsPayload,
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

const addProvider = async (req, res, next) => {
    try {
        const {
            providerName,
            claimSettlementRatio,
            averageClaimTime,
            rating,
            premiumRange,
            policyTypes,
            customerReviews,
            fraudReports,
        } = req.body;

        const { data: provider, error } = await supabaseAdmin
            .from('market_data')
            .insert({
                provider_name: providerName,
                claim_settlement_ratio: claimSettlementRatio,
                average_claim_time: averageClaimTime,
                rating,
                premium_range: premiumRange || { min: 0, max: 0 },
                policy_types: policyTypes || [],
                customer_reviews: customerReviews || { total: 0, averageRating: 0 },
                fraud_reports: fraudReports || 0,
            })
            .select()
            .single();

        if (error) return next(error);

        logger.info(`Market provider added: ${provider.provider_name}`);
        res.status(201).json({ provider: mapMarketProvider(provider) });
    } catch (error) {
        next(error);
    }
};

module.exports = { getProviders, getInsights, addProvider };
