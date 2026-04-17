const mongoose = require('mongoose');
const { getRedisClient } = require('../config/redis');
const ChatHistory = require('../models/ChatHistory');
const Policy = require('../models/Policy');
const geminiService = require('./gemini.service');
const logger = require('../utils/logger');
const crypto = require('crypto');

const CACHE_TTL = 3600; // 1 hour
const MAX_HISTORY_LENGTH = 20;

/**
 * Sanitize user input to prevent prompt injection and XSS
 */
const sanitizeInput = (input) => {
    if (!input || typeof input !== 'string') return '';

    // Remove potential prompt injection patterns
    const injectionPatterns = [
        /ignore (all |previous |above )?instructions/gi,
        /you are now/gi,
        /system ?override/gi,
        /forget (all |previous |your )?instructions/gi,
        /new ?instructions/gi,
        /act as (if )?/gi,
        /pretend (you are|to be)/gi,
        /\[system\]/gi,
        /\[admin\]/gi,
    ];

    let sanitized = input;
    for (const pattern of injectionPatterns) {
        sanitized = sanitized.replace(pattern, '[filtered]');
    }

    // Limit length
    sanitized = sanitized.substring(0, 5000);

    // Remove control characters
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized.trim();
};

/**
 * Get or create a session ID
 */
const getSessionId = (userId, sessionId) => {
    return sessionId || `session_${userId}_${crypto.randomBytes(8).toString('hex')}`;
};

/**
 * Get cached conversation from Redis
 */
const getCachedConversation = async (sessionId) => {
    try {
        const redis = getRedisClient();
        if (!redis) return null;

        const cached = await redis.get(`chat:${sessionId}`);
        return cached ? JSON.parse(cached) : null;
    } catch (error) {
        logger.warn('Redis cache read failed:', error.message);
        return null;
    }
};

/**
 * Cache conversation in Redis
 */
const cacheConversation = async (sessionId, history) => {
    try {
        const redis = getRedisClient();
        if (!redis) return;

        // Keep only recent history to limit cache size
        const trimmed = history.slice(-MAX_HISTORY_LENGTH);
        await redis.setex(`chat:${sessionId}`, CACHE_TTL, JSON.stringify(trimmed));
    } catch (error) {
        logger.warn('Redis cache write failed:', error.message);
    }
};

/**
 * Process a chat message
 */
const processMessage = async ({ userId, policyId, message, sessionId, aiModel = 'chatgpt' }) => {
    const sanitizedMessage = sanitizeInput(message);
    if (!sanitizedMessage) {
        throw new Error('Invalid message content');
    }

    const currentSessionId = getSessionId(userId, sessionId);

    // Get policy context
    let policySummary = {};
    if (policyId) {
        const policy = await Policy.findOne({ _id: policyId, userId });
        if (policy) {
            policySummary = policy.aiSummary || {};
            policySummary.policyNumber = policy.policyNumber;
            policySummary.providerName = policy.providerName;
            policySummary.policyType = policy.policyType;
            policySummary.coverageAmount = policy.coverageAmount;
        }
    }

    // Get conversation history (Redis cache first, then MongoDB)
    let conversationHistory = await getCachedConversation(currentSessionId);
    if (!conversationHistory) {
        const dbHistory = await ChatHistory.find({
            userId,
            sessionId: currentSessionId,
        })
            .sort({ timestamp: -1 })
            .limit(MAX_HISTORY_LENGTH)
            .lean();
        conversationHistory = dbHistory.reverse();
    }

    // Call AI service
    let aiResult;
    try {
        aiResult = await geminiService.chatAboutPolicy(sanitizedMessage, policySummary, conversationHistory);
    } catch (error) {
        logger.error('Puter AI chat service error:', error);
        throw new Error('AI chat service is currently unavailable. Please try again later.');
    }

    // Save to MongoDB
    const chatEntry = await ChatHistory.create({
        userId,
        policyId: policyId || null,
        sessionId: currentSessionId,
        message: sanitizedMessage,
        aiResponse: aiResult.response,
        metadata: {
            model: aiResult.model,
            tokensUsed: aiResult.tokensUsed,
            responseTimeMs: aiResult.responseTimeMs,
        },
    });

    // Update Redis cache
    const updatedHistory = [
        ...conversationHistory,
        { message: sanitizedMessage, aiResponse: aiResult.response },
    ];
    await cacheConversation(currentSessionId, updatedHistory);

    return {
        id: chatEntry._id,
        sessionId: currentSessionId,
        message: sanitizedMessage,
        aiResponse: aiResult.response,
        model: aiResult.model,
        responseTimeMs: aiResult.responseTimeMs,
        timestamp: chatEntry.timestamp,
    };
};

/**
 * Get chat history for a user session
 */
const getHistory = async (userId, sessionId, page = 1, limit = 50) => {
    const query = { userId };
    if (sessionId) query.sessionId = sessionId;

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
        ChatHistory.find(query)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        ChatHistory.countDocuments(query),
    ]);

    return {
        messages: messages.reverse(),
        total,
        page,
        pages: Math.ceil(total / limit),
    };
};

/**
 * Get all sessions for a user
 */
const getUserSessions = async (userId) => {
    const sessions = await ChatHistory.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: '$sessionId',
                lastMessage: { $last: '$message' },
                lastTimestamp: { $last: '$timestamp' },
                messageCount: { $sum: 1 },
            },
        },
        { $sort: { lastTimestamp: -1 } },
        { $limit: 20 },
    ]);

    return sessions.map((s) => ({
        sessionId: s._id,
        lastMessage: s.lastMessage.substring(0, 100),
        lastTimestamp: s.lastTimestamp,
        messageCount: s.messageCount,
    }));
};

module.exports = {
    processMessage,
    getHistory,
    getUserSessions,
    sanitizeInput,
};
