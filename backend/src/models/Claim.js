const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema(
    {
        policyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Policy',
            required: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        claimAmount: {
            type: Number,
            required: [true, 'Claim amount is required'],
            min: 0,
        },
        claimStatus: {
            type: String,
            enum: ['pending', 'under_review', 'approved', 'rejected', 'settled'],
            default: 'pending',
            index: true,
        },
        claimDate: {
            type: Date,
            default: Date.now,
        },
        description: {
            type: String,
            required: [true, 'Claim description is required'],
            maxlength: 2000,
        },
        aiGuidance: {
            recommendation: { type: String, default: '' },
            requiredSteps: [{ type: String }],
            estimatedTimeline: { type: String, default: '' },
            fraudRisk: {
                score: { type: Number, default: 0, min: 0, max: 100 },
                flags: [{ type: String }],
            },
        },
        supportingDocuments: [
            {
                filename: String,
                url: String,
                uploadedAt: { type: Date, default: Date.now },
            },
        ],
    },
    {
        timestamps: true,
    }
);

claimSchema.index({ policyId: 1, claimStatus: 1 });
claimSchema.index({ userId: 1, claimDate: -1 });
claimSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Claim', claimSchema);
