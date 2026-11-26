const chatbotService = require('../services/chatbot.service');

const sendMessage = async (req, res, next) => {
    try {
        const { message, policyId, sessionId, aiModel } = req.body;

        if (!message || message.trim().length === 0) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const result = await chatbotService.processMessage({
            userId: req.user.id,
            policyId,
            message,
            sessionId,
            aiModel,
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
};

const getHistory = async (req, res, next) => {
    try {
        const { sessionId, page = 1, limit = 50 } = req.query;

        const history = await chatbotService.getHistory(
            req.user.id,
            sessionId,
            parseInt(page, 10) || 1,
            parseInt(limit, 10) || 50
        );

        res.json(history);
    } catch (error) {
        next(error);
    }
};

const getSessions = async (req, res, next) => {
    try {
        const agent = ['parinidhi', 'standard'].includes(req.query.agent) ? req.query.agent : 'all';
        const sessions = await chatbotService.getUserSessions(req.user.id, { agent });
        res.json({ sessions });
    } catch (error) {
        next(error);
    }
};

module.exports = { sendMessage, getHistory, getSessions };
