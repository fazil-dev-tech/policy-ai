const chatbotService = require('../services/chatbot.service');
const logger = require('../utils/logger');

/**
 * POST /api/chat/message
 */
const sendMessage = async (req, res, next) => {
    try {
        const { message, policyId, sessionId, aiModel } = req.body;

        if (!message || message.trim().length === 0) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const result = await chatbotService.processMessage({
            userId: req.user._id,
            policyId,
            message,
            sessionId,
            aiModel: aiModel || 'puter',
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/chat/history
 */
const getHistory = async (req, res, next) => {
    try {
        const { sessionId, page = 1, limit = 50 } = req.query;

        const history = await chatbotService.getHistory(
            req.user._id,
            sessionId,
            parseInt(page),
            parseInt(limit)
        );

        res.json(history);
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/chat/sessions
 */
const getSessions = async (req, res, next) => {
    try {
        const sessions = await chatbotService.getUserSessions(req.user._id.toString());
        res.json({ sessions });
    } catch (error) {
        next(error);
    }
};

module.exports = { sendMessage, getHistory, getSessions };
