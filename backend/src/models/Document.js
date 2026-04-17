const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        documentName: {
            type: String,
            required: [true, 'Document name is required'],
            trim: true,
            index: true,
        },
        documentType: {
            type: String,
            required: true,
            enum: ['contract', 'invoice', 'report', 'letter', 'legal', 'general'],
            default: 'general',
            index: true,
        },
        pdfUrl: {
            type: String,
            required: true,
        },
        fileSize: {
            type: Number,
            default: 0,
        },
        aiSummary: {
            simpleSummary: { type: mongoose.Schema.Types.Mixed, default: '' },
            keyPoints: { type: mongoose.Schema.Types.Mixed, default: '' },
            actionItems: { type: mongoose.Schema.Types.Mixed, default: '' },
            riskFactors: { type: mongoose.Schema.Types.Mixed, default: '' },
            entities: { type: mongoose.Schema.Types.Mixed, default: '' },
        },
        status: {
            type: String,
            enum: ['analyzed', 'failed', 'pending'],
            default: 'analyzed',
        },
    },
    {
        timestamps: true,
    }
);

// Compound indexes for query optimization
documentSchema.index({ userId: 1, status: 1 });
documentSchema.index({ userId: 1, documentType: 1 });
documentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Document', documentSchema);
