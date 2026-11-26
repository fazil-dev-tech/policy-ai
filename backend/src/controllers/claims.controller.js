const { supabaseAdmin } = require('../config/supabase');
const geminiService = require('../services/gemini.service');
const notificationService = require('../services/notification.service');
const { mapClaim } = require('../utils/mappers');
const logger = require('../utils/logger');

const createClaim = async (req, res, next) => {
    try {
        const { policyId, claimAmount, description } = req.body;

        const { data: policy, error: policyErr } = await supabaseAdmin
            .from('policies')
            .select('*')
            .eq('id', policyId)
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (policyErr) return next(policyErr);
        if (!policy) {
            return res.status(404).json({ error: 'Policy not found' });
        }

        if (policy.status !== 'active') {
            return res.status(400).json({ error: 'Cannot file claim on an inactive policy' });
        }

        const coverageAmount = Number(policy.coverage_amount || 0);
        if (claimAmount > coverageAmount) {
            return res.status(400).json({
                error: `Claim amount (${claimAmount}) exceeds coverage (${coverageAmount})`,
            });
        }

        const aiGuidance = await geminiService.generateClaimGuidance(
            {
                policyNumber: policy.policy_number,
                providerName: policy.provider_name,
                policyType: policy.policy_type,
                coverageAmount,
                aiSummary: policy.ai_summary,
            },
            description
        );

        const { data: claim, error: claimErr } = await supabaseAdmin
            .from('claims')
            .insert({
                policy_id: policy.id,
                user_id: req.user.id,
                claim_amount: claimAmount,
                description,
                ai_guidance: aiGuidance,
                claim_status: 'pending',
            })
            .select()
            .single();

        if (claimErr) return next(claimErr);

        notificationService
            .sendClaimStatusEmail(req.user.email, req.user.name, {
                policyNumber: policy.policy_number,
                claimAmount,
                claimStatus: 'pending',
            })
            .catch((err) => logger.error('Notification failed:', err));

        logger.info(`Claim created: ${claim.id} for policy ${policy.policy_number}`);

        res.status(201).json({
            message: 'Claim filed successfully',
            claim: mapClaim(claim),
        });
    } catch (error) {
        next(error);
    }
};

const getClaimsByPolicy = async (req, res, next) => {
    try {
        const { policyId } = req.params;

        const { data: policy, error: policyErr } = await supabaseAdmin
            .from('policies')
            .select('id')
            .eq('id', policyId)
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (policyErr) return next(policyErr);
        if (!policy) {
            return res.status(404).json({ error: 'Policy not found' });
        }

        const { data: claims, error } = await supabaseAdmin
            .from('claims')
            .select('*')
            .eq('policy_id', policyId)
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) return next(error);

        res.json({ claims: (claims || []).map(mapClaim) });
    } catch (error) {
        next(error);
    }
};

const getUserClaims = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
        const { status } = req.query;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabaseAdmin
            .from('claims')
            .select('*, policies(id, policy_number, provider_name, policy_type)', { count: 'exact' })
            .eq('user_id', req.user.id);

        if (status) query = query.eq('claim_status', status);

        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) return next(error);

        const total = count || 0;
        res.json({
            claims: (data || []).map(mapClaim),
            total,
            page,
            pages: Math.ceil(total / limit),
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { createClaim, getClaimsByPolicy, getUserClaims };
