const mongoose = require('mongoose');

const policySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        policyNumber: {
            type: String,
            required: [true, 'Policy number is required'],
            trim: true,
            index: true,
        },
        providerName: {
            type: String,
            required: [true, 'Provider name is required'],
            trim: true,
            index: true,
        },
        policyType: {
            type: String,
            required: true,
            enum: ['health', 'life', 'auto', 'home', 'travel', 'business', 'other', 'document', 'general'],
            index: true,
        },
        coverageAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        startDate: {
            type: Date,
            required: true,
        },
        endDate: {
            type: Date,
            required: true,
        },
        pdfUrl: {
            type: String,
            required: true,
        },
        aiSummary: {
            overview: { type: mongoose.Schema.Types.Mixed, default: '' },
            coverage: { type: mongoose.Schema.Types.Mixed, default: '' },
            exclusions: { type: mongoose.Schema.Types.Mixed, default: '' },
            claimProcedure: { type: mongoose.Schema.Types.Mixed, default: '' },
            requiredDocuments: { type: mongoose.Schema.Types.Mixed, default: '' },
            fraudIndicators: { type: mongoose.Schema.Types.Mixed, default: '' },
            simpleSummary: { type: mongoose.Schema.Types.Mixed, default: '' },
            helplineNumber: { type: String, default: '' },
        },
        verificationScore: {
            type: Number,
            min: 0,
            max: 100,
            default: 0,
        },
        status: {
            type: String,
            enum: ['active', 'expired', 'cancelled', 'pending_review'],
            default: 'active',
        },
    },
    {
        timestamps: true,
    }
);

// Compound indexes for query optimization
policySchema.index({ userId: 1, status: 1 });
policySchema.index({ userId: 1, policyType: 1 });
policySchema.index({ providerName: 1, policyType: 1 });
policySchema.index({ endDate: 1 });
policySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Policy', policySchema);
