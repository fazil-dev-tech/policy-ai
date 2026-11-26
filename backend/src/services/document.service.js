const aiService = require('./ai.service');
const pdfParser = require('./pdfParser.service');
const { sanitizeInput } = require('./chatbot.service');
const logger = require('../utils/logger');

const DOCUMENT_EXTRACTION_PROMPT = `You are an elite enterprise Document Analyst AI.
Analyze the following text extracted from a general document (could be a contract, invoice, report, legal letter, etc.).

IMPORTANT: Respond ONLY with valid JSON. No markdown, no code fences, no explanations.

Extract the information into a strict JSON object with the following keys:

{
  "documentName": "A concise, descriptive title for this document (max 6 words).",
  "documentType": "One of: contract, invoice, report, letter, legal, general",
  "simpleSummary": "A very brief 2-3 sentence overview of what this document is about.",
  "keyPoints": [
    "Key detail 1",
    "Key detail 2",
    "Key detail 3"
  ],
  "actionItems": [
    "Required action 1",
    "Required action 2"
  ],
  "riskFactors": [
    "Potential risk, liability, or warning 1",
    "Potential risk, liability, or warning 2"
  ],
  "entities": {
    "Party A": "Name",
    "Party B": "Name",
    "Date": "Date if applicable",
    "Amount": "Any monetary amount if found"
  }
}

IMPORTANT:
- If a section cannot be determined, return an empty string or empty array.
- The output MUST be valid JSON only.`;

const getFallbackData = () => ({
    documentName: 'Document Pending Manual Review',
    documentType: 'general',
    simpleSummary: 'AI summary is temporarily rate-limited. Review key clauses or ask questions in document chat.',
    keyPoints: ['Automated AI extraction reached temporary provider rate limits.'],
    actionItems: [],
    riskFactors: [],
    entities: {},
    _aiFailed: true,
});

const extractDocumentInfo = async (pdfText) => {
    try {
        const masked = pdfParser.maskSensitivePii(String(pdfText || ''));
        const prompt = `${DOCUMENT_EXTRACTION_PROMPT}\n\nDocument Text:\n---\n${masked.substring(0, 24000)}\n---`;
        const { data, provider } = await aiService.generateJson(prompt);
        logger.info(`Document extraction successful via ${provider}`);
        return data;
    } catch (error) {
        logger.error('Document AI extraction failed:', error.message);
        return getFallbackData();
    }
};

const chatAboutDocument = async (userMessage, documentContext, conversationHistory = []) => {
    const cleanQuestion = sanitizeInput(String(userMessage || ''));
    if (!cleanQuestion) {
        const err = new Error('Message is required');
        err.statusCode = 400;
        throw err;
    }
    const safeHistory = Array.isArray(conversationHistory) ? conversationHistory.slice(-10) : [];

    try {
        const systemPrompt = `You are an expert Document Analyst AI assistant for the PolicyAI platform. Your role is to answer questions about uploaded documents based on the context provided.

RULES:
1. Answer based ONLY on the provided document context when the user asks about their specific document.
2. If the user asks a general knowledge question, you are free to answer it helpfully using your general knowledge.
3. NEVER make up document details that are not in the context.
4. Be helpful, clear, concise, and use simple language.
5. If you cannot find the answer in the document context, say so honestly.`;

        let prompt = `DOCUMENT CONTEXT:\n${JSON.stringify(documentContext || {}, null, 2)}\n\nCONVERSATION HISTORY:\n`;
        for (const h of safeHistory) {
            if (!h || typeof h !== 'object') continue;
            prompt += `User: ${String(h.message || '')}\nAssistant: ${String(h.response || h.aiResponse || '')}\n`;
        }
        prompt += `\nUser: ${cleanQuestion}\nAssistant:`;

        const result = await aiService.generateText(prompt, { systemPrompt });
        logger.info(`Document chat response generated via ${result.provider} in ${result.responseTimeMs}ms`);

        return {
            response: result.text,
            responseTimeMs: result.responseTimeMs,
            model: `${result.provider}:${result.model}`,
        };
    } catch (error) {
        logger.warn('Document chat AI unavailable, returning summary fallback:', error.message);
        const pts = Array.isArray(documentContext?.keyPoints) ? documentContext.keyPoints.slice(0, 4).join('; ') : '';
        return {
            response: `AI synthesis is temporarily rate-limited.\n\nDocument: ${documentContext?.documentName || 'Uploaded PDF'}\nSummary: ${documentContext?.simpleSummary || 'Review extracted points below.'}${pts ? `\nKey Points: ${pts}` : ''}`,
            responseTimeMs: 0,
            model: 'offline:document-fallback',
        };
    }
};

module.exports = {
    extractDocumentInfo,
    chatAboutDocument,
};
