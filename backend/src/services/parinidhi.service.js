const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const aiService = require('./ai.service');
const searchService = require('./search.service');
const pdfParser = require('./pdfParser.service');
const chatbotService = require('./chatbot.service');
const logger = require('../utils/logger');

const POLICY_RESEARCH_TRIGGER = /\b(list|compare|comparison|best|recommend|top|plans?|policies|coverage|insurer|premium|star health|hdfc ergo|icici lombard|niva bupa|care health|acko|bajaj|tata aig|lic|claim settlement ratio)\b/i;

const detectParinidhiMode = (message, policyId, requestedMode = 'auto') => {
    if (requestedMode && requestedMode !== 'auto') return requestedMode;
    const text = String(message || '').trim();
    if (policyId && !/\b(compare|other|best|market|list policies|available coverage)\b/i.test(text)) {
        return 'context';
    }
    if (POLICY_RESEARCH_TRIGGER.test(text)) {
        return 'research';
    }
    return policyId ? 'context' : 'general';
};

const runPolicyResearchComparison = async (message, userPolicies = []) => {
    const searchRes = await searchService.liveSearch(
        `${message} India IRDAI insurance coverage comparison features limits`,
        { prefix: 'parinidhi_research', searchDepth: 'basic', maxResults: 5, cacheHours: 12, prefer: 'tavily' }
    );

    const sourcesSummary = (searchRes.results || [])
        .map((r, i) => `[${i + 1}] ${r.title} (${r.url})\n${r.snippet}`)
        .join('\n\n');

    const userPortfolioContext = (userPolicies || []).slice(0, 4).map((p) => ({
        provider: p.provider_name || p.providerName,
        type: p.policy_type || p.policyType,
        coverageAmount: Number(p.coverage_amount ?? p.coverageAmount ?? 0),
    }));

    const prompt = `You are Parinidhi, an expert Indian Insurance Research & Voice Advisor.
User Request: "${message}"

User's Existing Portfolio: ${JSON.stringify(userPortfolioContext)}

Live Web Search Results (${searchRes.engine}):
${sourcesSummary || 'No external results available — rely strictly on factual IRDAI benchmarks.'}

Respond ONLY with valid JSON:
{
  "spokenAnswer": "Clear 2-4 sentence spoken English answer summarizing the best options, written naturally for text-to-speech without markdown symbols.",
  "markdownAnswer": "Rich concise explanation in markdown bullets.",
  "comparisonCards": [
    {
      "planName": "Policy / Plan Name",
      "insurer": "Insurer Name",
      "idealFor": "Family Floater / Seniors / Comprehensive / Budget",
      "coverageHighlights": "Room rent, restoration, NCB, consumables highlight",
      "waitingPeriodNote": "30d / 2-3yr PED / specifics",
      "claimSettlementInfo": "Settlement track record or key perk",
      "fitRating": "Top Pick | Strong Alternative | Budget Fit",
      "sourceUrl": "matching URL from sources or empty"
    }
  ],
  "bestVerdict": "1-2 sentence recommendation explaining WHY one option fits best and how it compares to the user's existing cover."
}`;

    try {
        const aiRes = await aiService.generateJson(prompt, { maxTokens: 2400, temperature: 0.25 });
        return {
            mode: 'research',
            aiResponse: aiRes.data.markdownAnswer || aiRes.data.spokenAnswer,
            spokenSummary: aiRes.data.spokenAnswer || aiRes.data.markdownAnswer,
            comparisonCards: aiRes.data.comparisonCards || [],
            bestVerdict: aiRes.data.bestVerdict || '',
            sources: (searchRes.results || []).slice(0, 5),
            searchEngine: searchRes.engine,
            cachedSearch: Boolean(searchRes.cached),
            model: `${aiRes.provider}:${aiRes.model}`,
        };
    } catch (err) {
        logger.warn(`Parinidhi research AI synthesis failed (${err.message}), returning raw search summary.`);
        return {
            mode: 'research',
            aiResponse: searchRes.answer || 'Here are the live policy search findings I retrieved for your query.',
            spokenSummary: searchRes.answer || 'I gathered live policy search results for you on screen.',
            comparisonCards: [],
            bestVerdict: '',
            sources: (searchRes.results || []).slice(0, 5),
            searchEngine: searchRes.engine,
            cachedSearch: Boolean(searchRes.cached),
            model: 'search-fallback',
        };
    }
};

const processParinidhiTurn = async ({ userId, message, policyId = null, sessionId = null, mode = 'auto' }) => {
    const start = Date.now();
    const cleanMessage = chatbotService.sanitizeInput(message);
    if (!cleanMessage) throw new Error('Message is required');

    const currentSessionId = sessionId || `parinidhi_${userId}_${crypto.randomBytes(6).toString('hex')}`;
    const detectedMode = detectParinidhiMode(cleanMessage, policyId, mode);

    const [{ data: userPolicies }, { data: recentDbHistory }] = await Promise.all([
        supabaseAdmin
            .from('policies')
            .select('id, policy_number, provider_name, policy_type, coverage_amount, ai_summary, cis_summary')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(8),
        supabaseAdmin
            .from('chat_history')
            .select('message, ai_response, timestamp')
            .eq('user_id', userId)
            .eq('session_id', currentSessionId)
            .order('timestamp', { ascending: false })
            .limit(10),
    ]);

    const history = (recentDbHistory || []).reverse();
    let resultPayload;

    if (detectedMode === 'research') {
        resultPayload = await runPolicyResearchComparison(cleanMessage, userPolicies || []);
    } else {
        let matchedClauses = [];
        let activePolicy = null;

        if (policyId) {
            activePolicy = (userPolicies || []).find((p) => p.id === policyId) || null;
            if (!activePolicy) {
                const { data: fetched } = await supabaseAdmin
                    .from('policies')
                    .select('*')
                    .eq('id', policyId)
                    .eq('user_id', userId)
                    .maybeSingle();
                activePolicy = fetched;
            }
            if (activePolicy) {
                matchedClauses = await pdfParser.searchPolicyClauses({
                    policyId: activePolicy.id,
                    userId,
                    query: cleanMessage,
                    limit: 5,
                });
            }
        }

        const historyBlock = history
            .map((h) => `User: ${h.message}\nParinidhi: ${h.ai_response}`)
            .join('\n');

        const clauseBlock = matchedClauses.length
            ? `\nMATCHED POLICY CLAUSES (Cite [Page X] strictly):\n${matchedClauses
                  .map((c) => `[Page ${c.page_number} · ${c.section_title}]: ${c.clause_text.slice(0, 700)}`)
                  .join('\n---\n')}`
            : '';

        const policyBlock = activePolicy
            ? `\nACTIVE POLICY SUMMARY:\nProvider: ${activePolicy.provider_name}, Policy #: ${activePolicy.policy_number}, Cover: ₹${Number(
                  activePolicy.coverage_amount || 0
              ).toLocaleString('en-IN')}\n${JSON.stringify(activePolicy.cis_summary || activePolicy.ai_summary || {})}`
            : '';

        const systemPrompt = `You are Parinidhi, an intelligent, warm, English-speaking female AI insurance and general assistant for PolicyAI / PolicyGuard.
Rules:
1. Keep responses helpful, clear, accurate, and natural for both reading and voice playback.
2. When policy clauses are provided, cite exact [Page X] references and never invent policy limits.
3. For general questions, answer clearly and thoughtfully using your knowledge.`;

        const fullPrompt = `${policyBlock}${clauseBlock}\n\nRECENT CONVERSATION:\n${historyBlock}\n\nUser: ${cleanMessage}\nParinidhi:`;

        const aiRes = await aiService.generateText(fullPrompt, { systemPrompt, temperature: 0.3, maxTokens: 2048 });
        const spokenSummary = aiRes.text
            .replace(/[#*`_>\[\]]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 480);

        resultPayload = {
            mode: activePolicy ? 'context' : 'general',
            aiResponse: aiRes.text,
            spokenSummary,
            citations: matchedClauses.map((c) => ({
                pageNumber: c.page_number,
                sectionTitle: c.section_title,
                snippet: c.clause_text.slice(0, 220),
            })),
            comparisonCards: [],
            bestVerdict: '',
            sources: [],
            model: `${aiRes.provider}:${aiRes.model}`,
        };
    }

    const responseTimeMs = Date.now() - start;

    await supabaseAdmin.from('chat_history').insert({
        user_id: userId,
        policy_id: policyId || null,
        session_id: currentSessionId,
        message: cleanMessage,
        ai_response: resultPayload.aiResponse,
        metadata: {
            agent: 'parinidhi',
            mode: resultPayload.mode,
            model: resultPayload.model,
            responseTimeMs,
            comparisonCards: resultPayload.comparisonCards || [],
            bestVerdict: resultPayload.bestVerdict || '',
            citations: resultPayload.citations || [],
            sources: resultPayload.sources || [],
            searchEngine: resultPayload.searchEngine || null,
        },
    });

    return {
        sessionId: currentSessionId,
        message: cleanMessage,
        responseTimeMs,
        ...resultPayload,
    };
};

module.exports = {
    detectParinidhiMode,
    processParinidhiTurn,
};
