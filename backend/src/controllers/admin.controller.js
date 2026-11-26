const { supabaseAdmin } = require('../config/supabase');
const fraudService = require('../services/fraud.service');
const { mapProfile, normalizeEnum } = require('../utils/mappers');

const VALID_DOMAIN_CATEGORIES = ['insurer', 'regulator', 'payment_gateway', 'tpa', 'aggregator'];

const getStats = async (req, res, next) => {
    try {
        const now = Date.now();
        const thirtyDaysAgoIso = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
        const sevenDaysAgoIso = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [
            usersRes,
            activeUsersRes,
            policiesRes,
            claimsRes,
            totalChatsRes,
            recentChatsRes,
            growthUsersRes,
            fraudAlerts,
        ] = await Promise.all([
            supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
            supabaseAdmin
                .from('profiles')
                .select('id', { count: 'exact', head: true })
                .gte('last_login', thirtyDaysAgoIso),
            supabaseAdmin.from('policies').select('policy_type, status'),
            supabaseAdmin.from('claims').select('claim_status, claim_amount'),
            supabaseAdmin.from('chat_history').select('id', { count: 'exact', head: true }),
            supabaseAdmin
                .from('chat_history')
                .select('id', { count: 'exact', head: true })
                .gte('timestamp', sevenDaysAgoIso),
            supabaseAdmin
                .from('profiles')
                .select('created_at')
                .gte('created_at', thirtyDaysAgoIso)
                .order('created_at', { ascending: true }),
            fraudService.getFraudAlerts(10),
        ]);

        const policies = policiesRes.data || [];
        const claims = claimsRes.data || [];
        const totalUsers = usersRes.count || 0;
        const activeUsers = activeUsersRes.count || 0;
        const totalPolicies = policies.length;
        const activePolicies = policies.filter((p) => p.status === 'active').length;
        const totalClaims = claims.length;
        const pendingClaims = claims.filter((c) => c.claim_status === 'pending').length;
        const approvedClaims = claims.filter((c) => c.claim_status === 'approved').length;
        const rejectedClaims = claims.filter((c) => c.claim_status === 'rejected').length;
        const totalChats = totalChatsRes.count || 0;
        const recentChats = recentChatsRes.count || 0;

        const typeCounts = {};
        for (const p of policies) {
            const key = p.policy_type || 'other';
            typeCounts[key] = (typeCounts[key] || 0) + 1;
        }
        const policyTypeDistribution = Object.entries(typeCounts)
            .map(([_id, count]) => ({ _id, count }))
            .sort((a, b) => b.count - a.count);

        const amounts = claims.map((c) => Number(c.claim_amount || 0));
        const totalAmount = amounts.reduce((s, a) => s + a, 0);
        const claimAmountStats = amounts.length
            ? {
                  totalAmount,
                  avgAmount: totalAmount / amounts.length,
                  maxAmount: Math.max(...amounts),
              }
            : { totalAmount: 0, avgAmount: 0, maxAmount: 0 };

        const growthMap = {};
        for (const u of growthUsersRes.data || []) {
            const day = String(u.created_at).slice(0, 10);
            growthMap[day] = (growthMap[day] || 0) + 1;
        }
        const userGrowth = Object.entries(growthMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([_id, count]) => ({ _id, count }));

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
                claimAmountStats,
                userGrowth,
                claimSuccessRate: totalClaims > 0 ? Math.round((approvedClaims / totalClaims) * 100) : 0,
            },
            fraudAlerts,
        });
    } catch (error) {
        next(error);
    }
};

const getUsers = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const { search, role } = req.query;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabaseAdmin.from('profiles').select('*', { count: 'exact' });
        if (search) {
            const safeSearch = String(search).replace(/[%_,()]/g, '');
            query = query.or(`name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`);
        }
        if (role) {
            query = query.eq('role', role);
        }

        const { data: users, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) return next(error);

        const enriched = await Promise.all(
            (users || []).map(async (user) => {
                const [{ count: policyCount }, { count: claimCount }] = await Promise.all([
                    supabaseAdmin
                        .from('policies')
                        .select('id', { count: 'exact', head: true })
                        .eq('user_id', user.id),
                    supabaseAdmin
                        .from('claims')
                        .select('id', { count: 'exact', head: true })
                        .eq('user_id', user.id),
                ]);
                return {
                    ...mapProfile(user),
                    policyCount: policyCount || 0,
                    claimCount: claimCount || 0,
                };
            })
        );

        const total = count || 0;
        res.json({
            users: enriched,
            total,
            page,
            pages: Math.ceil(total / limit),
        });
    } catch (error) {
        next(error);
    }
};

const getScamReportsAdmin = async (req, res, next) => {
    try {
        const { status } = req.query;
        let query = supabaseAdmin
            .from('scam_reports')
            .select('*, profiles:user_id(name, email)')
            .order('created_at', { ascending: false })
            .limit(100);
        if (status) query = query.eq('moderation_status', status);
        const { data, error } = await query;
        if (error) return next(error);
        res.json({ reports: data || [] });
    } catch (error) {
        next(error);
    }
};

const moderateScamReport = async (req, res, next) => {
    try {
        const { moderationStatus, moderatorNotes = '' } = req.body || {};
        if (!['verified', 'rejected', 'pending'].includes(moderationStatus)) {
            return res.status(400).json({ error: 'Invalid moderationStatus' });
        }
        const { data, error } = await supabaseAdmin
            .from('scam_reports')
            .update({
                moderation_status: moderationStatus,
                moderator_notes: moderatorNotes,
                reviewed_by: req.user.id,
                reviewed_at: new Date().toISOString(),
            })
            .eq('id', req.params.id)
            .select()
            .maybeSingle();
        if (error) return next(error);
        if (!data) return res.status(404).json({ error: 'Scam report not found' });

        // Sync verified scam into site_scans cache so extension alerts immediately
        if (moderationStatus === 'verified' && data.domain) {
            await supabaseAdmin.from('site_scans').upsert(
                {
                    domain: data.domain,
                    url: data.reported_url,
                    source_surface: data.source_surface || 'web',
                    status: 'threat',
                    risk_score: 95,
                    reasons: [`Admin-verified scam (${data.category})`],
                    last_scanned_at: new Date().toISOString(),
                    expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
                },
                { onConflict: 'domain' }
            );
        }

        res.json({ report: data });
    } catch (error) {
        next(error);
    }
};

const getVerifiedDomainsAdmin = async (req, res, next) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('verified_domains')
            .select('*')
            .order('provider_name', { ascending: true });
        if (error) return next(error);
        res.json({ domains: data || [] });
    } catch (error) {
        next(error);
    }
};

const upsertVerifiedDomain = async (req, res, next) => {
    try {
        const { domain, providerName, category = 'insurer', officialHelpline = '', grievanceEmail = '', isActive = true } = req.body || {};
        if (!domain || !providerName) {
            return res.status(400).json({ error: 'domain and providerName are required' });
        }
        const cleanDomain = String(domain).toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        const safeCategory = normalizeEnum(category, VALID_DOMAIN_CATEGORIES, 'insurer');
        const { data, error } = await supabaseAdmin
            .from('verified_domains')
            .upsert(
                {
                    domain: cleanDomain,
                    provider_name: String(providerName).trim(),
                    category: safeCategory,
                    official_helpline: String(officialHelpline || '').trim(),
                    grievance_email: String(grievanceEmail || '').trim(),
                    is_active: Boolean(isActive),
                    verified_by: req.user.id,
                },
                { onConflict: 'domain' }
            )
            .select()
            .single();
        if (error) return next(error);
        res.status(201).json({ domain: data });
    } catch (error) {
        next(error);
    }
};

const deleteVerifiedDomain = async (req, res, next) => {
    try {
        const { data: deleted, error } = await supabaseAdmin
            .from('verified_domains')
            .delete()
            .eq('id', req.params.id)
            .select('id')
            .maybeSingle();
        if (error) return next(error);
        if (!deleted) return res.status(404).json({ error: 'Verified domain not found' });
        res.json({ message: 'Verified domain deleted' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getStats,
    getUsers,
    getScamReportsAdmin,
    moderateScamReport,
    getVerifiedDomainsAdmin,
    upsertVerifiedDomain,
    deleteVerifiedDomain,
};
