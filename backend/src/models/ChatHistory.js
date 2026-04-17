const mongoose = require('mongoose');

const chatHistorySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        policyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Policy',
            default: null,
        },
        sessionId: {
            type: String,
            required: true,
            index: true,
        },
        message: {
            type: String,
            required: [true, 'Message is required'],
            maxlength: 5000,
        },
        aiResponse: {
            type: String,
            required: true,
            maxlength: 10000,
        },
        metadata: {
            model: { type: String, default: 'puter' },
            tokensUsed: { type: Number, default: 0 },
            responseTimeMs: { type: Number, default: 0 },
        },
        timestamp: {
            type: Date,
            default: Date.now,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

chatHistorySchema.index({ userId: 1, sessionId: 1, timestamp: -1 });
chatHistorySchema.index({ userId: 1, policyId: 1 });

module.exports = mongoose.model('ChatHistory', chatHistorySchema);
