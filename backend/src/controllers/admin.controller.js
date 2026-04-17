const User = require('../models/User');
const Policy = require('../models/Policy');
const Claim = require('../models/Claim');
const ChatHistory = require('../models/ChatHistory');
const MarketData = require('../models/MarketData');
const fraudService = require('../services/fraud.service');
const logger = require('../utils/logger');

/**
 * GET /api/admin/stats
 */
const getStats = async (req, res, next) => {
    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

        const [
            totalUsers,
            activeUsers,
            totalPolicies,
            activePolicies,
            totalClaims,
            pendingClaims,
            approvedClaims,
            rejectedClaims,
            totalChats,
            recentChats,
            policyTypeDistribution,
            claimAmountStats,
            userGrowth,
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ lastLogin: { $gte: thirtyDaysAgo } }),
            Policy.countDocuments(),
            Policy.countDocuments({ status: 'active' }),
            Claim.countDocuments(),
            Claim.countDocuments({ claimStatus: 'pending' }),
            Claim.countDocuments({ claimStatus: 'approved' }),
            Claim.countDocuments({ claimStatus: 'rejected' }),
            ChatHistory.countDocuments(),
            ChatHistory.countDocuments({ timestamp: { $gte: sevenDaysAgo } }),
            Policy.aggregate([
                { $group: { _id: '$policyType', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
            Claim.aggregate([
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: '$claimAmount' },
                        avgAmount: { $avg: '$claimAmount' },
                        maxAmount: { $max: '$claimAmount' },
                    },
                },
            ]),
            User.aggregate([
                { $match: { createdAt: { $gte: thirtyDaysAgo } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]),
        ]);

        // Get fraud alerts
        const fraudAlerts = await fraudService.getFraudAlerts(10);

        res.json({
            overview: {
                totalUsers,
                activeUsers,
                totalPolicies,
                activePolicies,
                totalClaims,
                pendingClaims,
                approvedClaims,
                rejectedClaims,
            },
            aiUsage: {
                totalChats,
                recentChats,
                avgChatsPerDay: Math.round(recentChats / 7),
            },
            analytics: {
                policyTypeDistribution,
                claimAmountStats: claimAmountStats[0] || { totalAmount: 0, avgAmount: 0, maxAmount: 0 },
                userGrowth,
                claimSuccessRate: totalClaims > 0 ? Math.round((approvedClaims / totalClaims) * 100) : 0,
            },
            fraudAlerts,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/admin/users
 */
const getUsers = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search, role } = req.query;
        const query = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }
        if (role) query.role = role;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [users, total] = await Promise.all([
            User.find(query)
                .select('-password_hash -refreshToken')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            User.countDocuments(query),
        ]);

        // Enrich with stats
        const enriched = await Promise.all(
            users.map(async (user) => {
                const [policyCount, claimCount] = await Promise.all([
                    Policy.countDocuments({ userId: user._id }),
                    Claim.countDocuments({ userId: user._id }),
                ]);
                return { ...user, policyCount, claimCount };
            })
        );

        res.json({
            users: enriched,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { getStats, getUsers };
