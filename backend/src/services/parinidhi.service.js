const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const aiService = require('./ai.service');
const searchService = require('./search.service');
const pdfParser = require('./pdfParser.service');
const chatbotService = require('./chatbot.service');
const logger = require('../utils/logger');

const POLICY_RESEARCH_INTENT = /\b(list|compare|comparison|best|recommend|top|vs)\b/i;
const INSURANCE_DOMAIN_KEYWORDS = /\b(insur\w*|polic\w*|plans?|coverage|insurers?|premium|claim\w*|irdai|health|hospital\w*|floater|term life|motor|star health|hdfc ergo|icici lombard|niva bupa|care health|acko|bajaj|tata aig|lic|tpa|deductible|moratorium)\b/i;

const detectParinidhiMode = (message, policyId, requestedMode = 'auto') => {
    if (requestedMode && requestedMode !== 'auto') return requestedMode;
    const text = String(message || '').trim();
    if (policyId && !/\b(compare|other|best|market|list policies|available coverage)\b/i.test(text)) {
        return 'context';
    }
    if (POLICY_RESEARCH_INTENT.test(text) && INSURANCE_DOMAIN_KEYWORDS.test(text)) {
        return 'research';
    }
    return policyId ? 'context' : 'general';
};

const runPolicyResearchComparison = async (message, userPolicies = [], matchedClauses = [], language = 'English', aiModel = '') => {
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

    const clauseSnippet = (matchedClauses || []).length
        ? `\nSelected Policy Clauses:\n${matchedClauses
              .map((c) => `[Page ${c.page_number} · ${c.section_title}]: ${c.clause_text.slice(0, 500)}`)
              .join('\n')}`
        : '';

    const prompt = `You are Parinidhi, an expert Indian Insurance Research & Voice Advisor.
Respond in ${language} (keeping insurance numbers, ₹ currency, and [Page X] citations clear).
User Request: "${message}"

User's Existing Portfolio: ${JSON.stringify(userPortfolioContext)}${clauseSnippet}

Live Web Search Results (${searchRes.engine}):
${sourcesSummary || 'No external results available — rely strictly on factual IRDAI benchmarks.'}

Respond ONLY with valid JSON:
{
  "spokenAnswer": "Clear 2-4 sentence spoken answer summarizing the best options, written naturally for text-to-speech without markdown symbols.",
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
        const aiRes = await aiService.generateJson(prompt, {
            maxTokens: 2400,
            temperature: 0.25,
            ...(aiModel ? { model: aiModel } : {}),
        });
        return {
            mode: 'research',
            aiResponse: aiRes.data.markdownAnswer || aiRes.data.spokenAnswer,
            spokenSummary: aiRes.data.spokenAnswer || aiRes.data.markdownAnswer,
            comparisonCards: aiRes.data.comparisonCards || [],
            bestVerdict: aiRes.data.bestVerdict || '',
            citations: (matchedClauses || []).map((c) => ({
                pageNumber: c.page_number,
                sectionTitle: c.section_title || 'Policy Clause',
                snippet: String(c.clause_text || '').slice(0, 220),
            })),
            sources: (searchRes.results || []).slice(0, 5),
            searchEngine: searchRes.engine,
            cachedSearch: Boolean(searchRes.cached),
            model: `${aiRes.provider}:${aiRes.model}`,
        };
    } catch (err) {
        logger.warn(`Parinidhi research AI synthesis failed (${err.message}), returning raw search summary.`);
        const fallbackBullets = (searchRes.results || [])
            .slice(0, 4)
            .map((r) => `- **${r.title}**: ${r.snippet.slice(0, 180)}`)
            .join('\n');
        const fallbackMsg = searchRes.answer
            ? `${searchRes.answer}${fallbackBullets ? `\n\n${fallbackBullets}` : ''}`
            : fallbackBullets || 'Live policy search completed cleanly, though detailed AI synthesis is temporarily rate-limited. Check your uploaded policy details or try again shortly.';
        return {
            mode: 'research',
            aiResponse: fallbackMsg,
            spokenSummary: (searchRes.answer || 'I retrieved live search sources for your policy comparison on screen.').slice(0, 450),
            comparisonCards: [],
            bestVerdict: '',
            citations: (matchedClauses || []).map((c) => ({
                pageNumber: c.page_number,
                sectionTitle: c.section_title || 'Policy Clause',
                snippet: String(c.clause_text || '').slice(0, 220),
            })),
            sources: (searchRes.results || []).slice(0, 5),
            searchEngine: searchRes.engine,
            cachedSearch: Boolean(searchRes.cached),
            model: 'search-fallback',
        };
    }
};

const processParinidhiTurn = async ({ userId, message, policyId = null, sessionId = null, mode = 'auto', language = 'English', aiModel = '' }) => {
    const start = Date.now();
    const cleanMessage = chatbotService.sanitizeInput(message);
    if (!cleanMessage) {
        const err = new Error('Message is required');
        err.statusCode = 400;
        throw err;
    }

    const safeLanguage = String(language || 'English').trim().slice(0, 32) || 'English';
    const currentSessionId = sessionId || `parinidhi_${userId}_${crypto.randomBytes(6).toString('hex')}`;
    const detectedMode = detectParinidhiMode(cleanMessage, policyId, mode);

    const [{ data: userPolicies }, { data: recentDbHistory }] = await Promise.all([
        supabaseAdmin
            .from('policies')
            .select('id, policy_number, provider_name, policy_type, coverage_amount, ai_summary, cis_summary, structured_terms, start_date, end_date, inception_date')
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

    let resultPayload;

    if (detectedMode === 'research') {
        resultPayload = await runPolicyResearchComparison(cleanMessage, userPolicies || [], matchedClauses, safeLanguage, aiModel);
    } else {
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
              ).toLocaleString('en-IN')}\n${JSON.stringify({
                  cisSummary: activePolicy.cis_summary || {},
                  structuredTerms: activePolicy.structured_terms || {},
                  aiSummary: activePolicy.ai_summary || {},
                  startDate: activePolicy.start_date || null,
                  endDate: activePolicy.end_date || null,
                  inceptionDate: activePolicy.inception_date || null,
              })}`
            : '';

        const systemPrompt = `You are Parinidhi, a dual-purpose general AI and Indian insurance intelligence voice assistant for PolicyAI / PolicyGuard.
Rules:
1. Respond in ${safeLanguage}, keeping technical numbers, ₹ figures, and [Page X] citations clear and natural for voice playback.
2. When policy clauses/schedule context are provided and relevant, cite exact [Page X] references and never invent policy limits.
3. For general-purpose questions (even when a policy is selected), answer clearly and thoughtfully using your general knowledge.`;

        const fullPrompt = `${policyBlock}${clauseBlock}\n\nRECENT CONVERSATION:\n${historyBlock}\n\nUser: ${cleanMessage}\nParinidhi:`;

        let aiText = '';
        let modelLabel = '';
        let fallbackSources = [];
        let fallbackEngine = null;

        try {
            const aiRes = await aiService.generateText(fullPrompt, {
                systemPrompt,
                temperature: 0.3,
                maxTokens: 2048,
                ...(aiModel ? { model: aiModel } : {}),
            });
            aiText = aiRes.text;
            modelLabel = `${aiRes.provider}:${aiRes.model}`;
        } catch (aiErr) {
            logger.warn(`Parinidhi LLM unavailable (${aiErr.message}); engaging grounded offline/search fallback.`);
            const isPolicyQuestion =
                Boolean(activePolicy) &&
                /\b(my\s+policy|this\s+policy|policy\s*#?|sum\s*insured|cover(?:age)?|insured|member|nominee|ped|pre-?existing|exclusion|waiting|room\s*rent|deductible|co-?pay|helpline|claim|premium|moratorium|page|clause)\b/i.test(
                    cleanMessage
                );
            if (isPolicyQuestion && matchedClauses.length > 0) {
                aiText = [
                    `Live AI synthesis is temporarily rate-limited, so here are the matching clauses directly from your **${activePolicy?.provider_name || ''}** policy (**#${activePolicy?.policy_number || ''}**):`,
                    ...matchedClauses.map((c) => `- **[Page ${c.page_number}] ${c.section_title || 'Clause'}**: ${String(c.clause_text || '').slice(0, 320)}`),
                ].join('\n');
                modelLabel = 'offline:policy-clauses';
            } else if (isPolicyQuestion && activePolicy) {
                const cis = activePolicy.cis_summary || {};
                const aiSum = activePolicy.ai_summary || {};
                const members = Array.isArray(activePolicy.structured_terms?.insuredMembers)
                    ? activePolicy.structured_terms.insuredMembers
                    : [];
                const declaredPeds = Array.isArray(activePolicy.structured_terms?.declaredPeds)
                    ? activePolicy.structured_terms.declaredPeds
                    : [];
                aiText = [
                    `Live AI synthesis is temporarily rate-limited. Here are verified facts on **${activePolicy.provider_name} (#${activePolicy.policy_number})**:`,
                    `- **Sum Insured**: ₹${Number(activePolicy.coverage_amount || 0).toLocaleString('en-IN')}`,
                    members.length ? `- **Insured Members**: ${members.map((m) => `${m.name} (${m.relationship || 'Insured'}, Age ${m.age || '?'})`).join(', ')}` : null,
                    declaredPeds.length ? `- **Declared PEDs**: ${declaredPeds.join(' | ')}` : null,
                    cis.roomRentLimit ? `- **Room Rent Limit**: ${cis.roomRentLimit}` : null,
                    cis.coPay ? `- **Co-Pay**: ${cis.coPay}` : null,
                    cis.pedWaitingPeriod ? `- **PED Waiting**: ${cis.pedWaitingPeriod}` : null,
                    aiSum.exclusions ? `- **Key Exclusions**: ${String(aiSum.exclusions).slice(0, 260)}` : null,
                    cis.helplineNumber ? `- **24x7 Helpline**: ${cis.helplineNumber}` : null,
                ]
                    .filter(Boolean)
                    .join('\n');
                modelLabel = 'offline:policy-cis';
            } else {
                const searchQuery = INSURANCE_DOMAIN_KEYWORDS.test(cleanMessage) ? `${cleanMessage} India IRDAI` : cleanMessage;
                const webFallback = await searchService
                    .liveSearch(searchQuery, { prefix: 'parinidhi_fallback', maxResults: 4 })
                    .catch(() => ({ engine: 'offline', answer: '', results: [] }));
                fallbackSources = (webFallback.results || []).slice(0, 4);
                fallbackEngine = webFallback.engine || null;
                if (webFallback.answer || fallbackSources.length > 0) {
                    const bullets = fallbackSources.map((r) => `- **${r.title}**: ${r.snippet.slice(0, 180)}`).join('\n');
                    aiText = `${webFallback.answer ? `${webFallback.answer}\n\n` : ''}${bullets}`;
                    modelLabel = `search:${webFallback.engine || 'web'}`;
                } else {
                    aiText = `AI text generation has temporarily reached the free daily quota on this key. Upload or select a policy to query exact [Page X] clauses instantly, or retry shortly.`;
                    modelLabel = 'offline:quota-notice';
                }
            }
        }

        const spokenSummary = aiText
            .replace(/[#*`_>\[\]]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 480);

        resultPayload = {
            mode: activePolicy ? 'context' : 'general',
            aiResponse: aiText,
            spokenSummary,
            citations: matchedClauses.map((c) => ({
                pageNumber: c.page_number,
                sectionTitle: c.section_title || 'Policy Clause',
                snippet: String(c.clause_text || '').slice(0, 220),
            })),
            comparisonCards: [],
            bestVerdict: '',
            sources: fallbackSources,
            searchEngine: fallbackEngine,
            model: modelLabel,
        };
    }

    const responseTimeMs = Date.now() - start;

    const { error: historyErr } = await supabaseAdmin.from('chat_history').insert({
        user_id: userId,
        policy_id: policyId || null,
        session_id: currentSessionId,
        message: cleanMessage,
        ai_response: resultPayload.aiResponse,
        metadata: {
            agent: 'parinidhi',
            mode: resultPayload.mode,
            language: safeLanguage,
            model: resultPayload.model,
            responseTimeMs,
            comparisonCards: resultPayload.comparisonCards || [],
            bestVerdict: resultPayload.bestVerdict || '',
            citations: resultPayload.citations || [],
            sources: resultPayload.sources || [],
            searchEngine: resultPayload.searchEngine || null,
        },
    });
    if (historyErr) logger.warn('Failed persisting parinidhi chat history:', historyErr.message);

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
