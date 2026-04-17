const Claim = require('../models/Claim');
const Policy = require('../models/Policy');
const geminiService = require('../services/gemini.service');
const notificationService = require('../services/notification.service');
const logger = require('../utils/logger');

/**
 * POST /api/claims
 */
const createClaim = async (req, res, next) => {
    try {
        const { policyId, claimAmount, description } = req.body;

        // Verify policy belongs to user
        const policy = await Policy.findOne({
            _id: policyId,
            userId: req.user._id,
        });

        if (!policy) {
            return res.status(404).json({ error: 'Policy not found' });
        }

        // Check if policy is active
        if (policy.status !== 'active') {
            return res.status(400).json({ error: 'Cannot file claim on an inactive policy' });
        }

        // Check claim amount vs coverage
        if (claimAmount > policy.coverageAmount) {
            return res.status(400).json({
                error: `Claim amount (${claimAmount}) exceeds coverage (${policy.coverageAmount})`,
            });
        }

        // Generate AI guidance
        const aiGuidance = await geminiService.generateClaimGuidance(
            {
                policyNumber: policy.policyNumber,
                providerName: policy.providerName,
                policyType: policy.policyType,
                coverageAmount: policy.coverageAmount,
                aiSummary: policy.aiSummary,
            },
            description
        );

        // Create claim
        const claim = await Claim.create({
            policyId: policy._id,
            userId: req.user._id,
            claimAmount,
            description,
            aiGuidance,
        });

        // Send notification (async, don't wait)
        notificationService
            .sendClaimStatusEmail(req.user.email, req.user.name, {
                policyNumber: policy.policyNumber,
                claimAmount,
                claimStatus: 'pending',
            })
            .catch((err) => logger.error('Notification failed:', err));

        logger.info(`Claim created: ${claim._id} for policy ${policy.policyNumber}`);

        res.status(201).json({
            message: 'Claim filed successfully',
            claim,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/claims/:policyId
 */
const getClaimsByPolicy = async (req, res, next) => {
    try {
        const { policyId } = req.params;

        // Verify policy belongs to user
        const policy = await Policy.findOne({
            _id: policyId,
            userId: req.user._id,
        });

        if (!policy) {
            return res.status(404).json({ error: 'Policy not found' });
        }

        const claims = await Claim.find({ policyId })
            .sort({ createdAt: -1 })
            .lean();

        res.json({ claims });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/claims
 */
const getUserClaims = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const query = { userId: req.user._id };
        if (status) query.claimStatus = status;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [claims, total] = await Promise.all([
            Claim.find(query)
                .populate('policyId', 'policyNumber providerName policyType')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Claim.countDocuments(query),
        ]);

        res.json({
            claims,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { createClaim, getClaimsByPolicy, getUserClaims };
