const mongoose = require('mongoose');

const marketDataSchema = new mongoose.Schema(
    {
        providerName: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },
        claimSettlementRatio: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
        },
        averageClaimTime: {
            type: Number,
            required: true,
            min: 0,
        },
        rating: {
            type: Number,
            required: true,
            min: 0,
            max: 5,
        },
        premiumRange: {
            min: { type: Number, required: true },
            max: { type: Number, required: true },
        },
        policyTypes: [
            {
                type: String,
                enum: ['health', 'life', 'auto', 'home', 'travel', 'business'],
            },
        ],
        customerReviews: {
            total: { type: Number, default: 0 },
            averageRating: { type: Number, default: 0 },
        },
        fraudReports: {
            type: Number,
            default: 0,
        },
        lastUpdated: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

marketDataSchema.index({ claimSettlementRatio: -1 });
marketDataSchema.index({ rating: -1 });

module.exports = mongoose.model('MarketData', marketDataSchema);
