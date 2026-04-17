const { init, getAuthToken } = require('@heyputer/puter.js/src/init.cjs');
const logger = require('../utils/logger');

let puterClient = null;

const getPuterClient = async () => {
  if (puterClient) return puterClient;
  const env = require('../config/env');
  let token = env.PUTER_AUTH_TOKEN;
  if (!token) {
    logger.info('PUTER_AUTH_TOKEN not found, starting browser-based auth...');
    token = await getAuthToken();
  }
  puterClient = init(token || undefined);
  return puterClient;
};

/**
 * Safely parse Puter AI response
 */
const extractText = (response) => {
  if (typeof response === 'string') return response;
  if (response?.message?.content) return response.message.content;
  if (response?.text) return response.text;
  return JSON.stringify(response);
};

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

/**
 * Extracts generic information from a non-insurance PDF using Puter.js AI
 * @param {string} pdfText - The extracted text from the PDF
 * @returns {Object} JSON object containing general insights
 */
const extractDocumentInfo = async (pdfText) => {
  try {
    const puter = await getPuterClient();

    const prompt = `${DOCUMENT_EXTRACTION_PROMPT}\n\nDocument Text:\n---\n${pdfText.substring(0, 30000)}\n---`;

    const response = await puter.ai.chat(prompt);
    const text = extractText(response);

    // Clean up potential markdown formatting (```json ... ```)
    let cleanJson = text.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.substring(7);
    }
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.substring(3);
    }
    if (cleanJson.endsWith('```')) {
      cleanJson = cleanJson.substring(0, cleanJson.length - 3);
    }

    const parsed = JSON.parse(cleanJson.trim());
    logger.info('Document extraction successful via Puter AI');
    return parsed;
  } catch (error) {
    logger.error('Document AI extraction failed:', error.message);
    return getFallbackData();
  }
};

const getFallbackData = () => ({
  documentName: 'Unknown Document',
  documentType: 'general',
  simpleSummary: 'AI analysis failed. Please review the document manually.',
  keyPoints: ['AI processing unavailable.'],
  actionItems: [],
  riskFactors: [],
  entities: {}
});

/**
 * Chat about a document using Puter.js AI
 * @param {string} userMessage - The user's question
 * @param {Object} documentContext - The document's AI summary and metadata
 * @param {Array} conversationHistory - Previous messages in the conversation
 * @returns {Object} AI response with metadata
 */
const chatAboutDocument = async (userMessage, documentContext, conversationHistory = []) => {
  try {
    const puter = await getPuterClient();

    let prompt = `You are an expert Document Analyst AI assistant for the PolicyAI platform. Your role is to answer questions about uploaded documents based on the context provided.

RULES:
1. Answer based ONLY on the provided document context when the user asks about their specific document.
2. If the user asks a general knowledge question, you are free to answer it helpfully using your general knowledge.
3. NEVER make up document details that are not in the context.
4. Be helpful, clear, concise, and use simple language.
5. If you cannot find the answer in the document context, say so honestly.

DOCUMENT CONTEXT:
${JSON.stringify(documentContext, null, 2)}

CONVERSATION HISTORY:
`;

    for (const h of conversationHistory.slice(-10)) {
      prompt += `User: ${h.message}\nAssistant: ${h.response}\n`;
    }

    prompt += `\nUser: ${userMessage}\nAssistant:`;

    const startTime = Date.now();
    const response = await puter.ai.chat(prompt);
    const responseTime = Date.now() - startTime;
    const responseText = extractText(response);

    logger.info(`Document chat response generated in ${responseTime}ms`);

    return {
      response: responseText,
      responseTimeMs: responseTime,
    };
  } catch (error) {
    logger.error('Document chat failed:', error.message);
    throw new Error('AI chat service unavailable: ' + error.message);
  }
};

module.exports = {
  extractDocumentInfo,
  chatAboutDocument,
};
