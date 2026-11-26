const normalizeEnum = (value, allowed, fallback) => {
    if (!value || typeof value !== 'string') return fallback;
    const normalized = value.trim().toLowerCase();
    if (allowed.includes(normalized)) return normalized;
    const match = allowed.find((item) => normalized.includes(item));
    return match || fallback;
};

const safeIsoDate = (value, fallbackDate) => {
    if (!value) return fallbackDate.toISOString();
    const str = String(value).trim();
    // Handle Indian DD/MM/YYYY or DD-MM-YYYY format before Date.parse
    const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
        const isoCandidate = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
        const p = new Date(isoCandidate);
        if (!Number.isNaN(p.getTime())) return p.toISOString();
    }
    const parsed = new Date(str);
    if (Number.isNaN(parsed.getTime())) {
        return fallbackDate.toISOString();
    }
    return parsed.toISOString();
};

const mapProfile = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        _id: row.id,
        name: row.name,
        email: row.email,
        role: row.role || 'user',
        lastLogin: row.last_login || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

const mapPolicy = (row, signedPdfUrl = null) => {
    if (!row) return null;
    return {
        id: row.id,
        _id: row.id,
        userId: row.user_id,
        policyNumber: row.policy_number,
        providerName: row.provider_name,
        policyType: row.policy_type,
        coverageAmount: Number(row.coverage_amount || 0),
        startDate: row.start_date,
        endDate: row.end_date,
        pdfUrl: signedPdfUrl || row.pdf_url || `/api/policy/${row.id}/file`,
        storagePath: row.storage_path || '',
        aiSummary: row.ai_summary || {},
        verificationScore: Number(row.verification_score ?? 0),
        status: row.status || 'active',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

const mapDocument = (row, signedPdfUrl = null) => {
    if (!row) return null;
    return {
        id: row.id,
        _id: row.id,
        userId: row.user_id,
        documentName: row.document_name,
        documentType: row.document_type,
        pdfUrl: signedPdfUrl || row.pdf_url || `/api/documents/${row.id}/file`,
        storagePath: row.storage_path || '',
        fileSize: Number(row.file_size || 0),
        aiSummary: row.ai_summary || {},
        status: row.status || 'analyzed',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

const mapClaim = (row) => {
    if (!row) return null;
    const policyRelation = row.policies
        ? {
              id: row.policies.id,
              _id: row.policies.id,
              policyNumber: row.policies.policy_number,
              providerName: row.policies.provider_name,
              policyType: row.policies.policy_type,
          }
        : row.policy_id;

    return {
        id: row.id,
        _id: row.id,
        policyId: policyRelation,
        userId: row.user_id,
        claimAmount: Number(row.claim_amount || 0),
        claimStatus: row.claim_status,
        claimDate: row.claim_date,
        description: row.description,
        aiGuidance: row.ai_guidance || {},
        supportingDocuments: row.supporting_documents || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

const mapMarketProvider = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        _id: row.id,
        providerName: row.provider_name,
        claimSettlementRatio: Number(row.claim_settlement_ratio || 0),
        averageClaimTime: Number(row.average_claim_time || 0),
        rating: Number(row.rating || 0),
        premiumRange: row.premium_range || { min: 0, max: 0 },
        policyTypes: row.policy_types || [],
        customerReviews: row.customer_reviews || { total: 0, averageRating: 0 },
        fraudReports: Number(row.fraud_reports || 0),
        lastUpdated: row.last_updated,
        createdAt: row.created_at,
    };
};

const mapChatMessage = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        _id: row.id,
        userId: row.user_id,
        policyId: row.policy_id,
        sessionId: row.session_id,
        message: row.message,
        aiResponse: row.ai_response,
        model: row.metadata?.model || 'ai',
        responseTimeMs: row.metadata?.responseTimeMs || 0,
        metadata: row.metadata || {},
        timestamp: row.timestamp,
    };
};

module.exports = {
    normalizeEnum,
    safeIsoDate,
    mapProfile,
    mapPolicy,
    mapDocument,
    mapClaim,
    mapMarketProvider,
    mapChatMessage,
};
