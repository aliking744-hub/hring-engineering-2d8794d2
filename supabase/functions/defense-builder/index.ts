import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getClientIdentifier, rateLimitResponse } from "../_shared/rate-limiter.ts";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limit: 5 requests per minute per user (expensive operation)
const RATE_LIMIT_CONFIG = { windowMs: 60000, maxRequests: 5 };

interface AnalysisResult {
  phase: 'audit' | 'gap_analysis' | 'verdict';
  claims: string[];
  relevantArticles: { article: string; requirement: string; category: string }[];
  missingEvidence: { item: string; article: string; question: string }[];
  riskScore: number; // 0-100, higher = more risk of losing
  recommendation: 'fight' | 'settle' | 'needs_more_info';
  reasoning: string;
  defenseBill?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  // Rate limiting
  const clientId = getClientIdentifier(req);
  const rateLimit = checkRateLimit(clientId, RATE_LIMIT_CONFIG);
  if (!rateLimit.allowed) {
    console.log(`Rate limit exceeded for ${clientId}`);
    return rateLimitResponse(rateLimit.resetIn, corsHeaders);
  }

  try {
    const { complaint, evidence, additionalInfo, conversationHistory } = await req.json();

    if (!complaint && !conversationHistory?.length) {
      return new Response(
        JSON.stringify({ error: 'complaint document or conversation history is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Defense Builder - Complaint provided: ${!!complaint}, Evidence files: ${evidence?.length || 0}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Lovable API Key for Gemini 2.5 Pro
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Step 1: AUDIT PHASE - Extract claims from complaint and find relevant laws
    console.log('Phase 1: Audit - Analyzing complaint and retrieving relevant laws...');

    // First, use AI to extract the claims from the complaint
    const extractClaimsPrompt = `شما یک تحلیلگر حقوقی هستید. از دادخواست زیر، ادعاهای اصلی کارگر را استخراج کنید.

دادخواست:
${complaint || 'ادامه مکالمه قبلی'}

${additionalInfo ? `اطلاعات تکمیلی: ${additionalInfo}` : ''}

لطفاً با استفاده از تابع extract_claims ادعاها را استخراج کنید.`;

    const claimsResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          ...(conversationHistory || []),
          { role: 'user', content: extractClaimsPrompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_claims',
            description: 'Extract worker claims from the complaint document',
            parameters: {
              type: 'object',
              properties: {
                claims: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      claim_type: { type: 'string', description: 'نوع ادعا (مثل: اضافه کاری پرداخت نشده، اخراج غیرقانونی، حق سنوات و غیره)' },
                      description: { type: 'string', description: 'توضیح مختصر ادعا' },
                      amount_claimed: { type: 'string', description: 'مبلغ یا میزان ادعا شده (اگر ذکر شده)' }
                    },
                    required: ['claim_type', 'description']
                  }
                }
              },
              required: ['claims']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_claims' } }
      }),
    });

    if (!claimsResponse.ok) {
      const errorText = await claimsResponse.text();
      console.error('Claims extraction error:', errorText);
      throw new Error('Failed to extract claims from complaint');
    }

    const claimsData = await claimsResponse.json();
    let extractedClaims: any[] = [];
    
    try {
      const toolCall = claimsData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const args = JSON.parse(toolCall.function.arguments);
        extractedClaims = args.claims || [];
      }
    } catch (e) {
      console.error('Error parsing claims:', e);
      extractedClaims = [{ claim_type: 'نامشخص', description: 'ادعاهای دادخواست قابل استخراج نبود' }];
    }

    console.log(`Extracted ${extractedClaims.length} claims from complaint`);

    // Search legal_docs for each claim type
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const relevantLaws: any[] = [];
    for (const claim of extractedClaims) {
      const searchQuery = `${claim.claim_type} ${claim.description}`;
      
      // Generate embedding for search
      const embeddingResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'models/text-embedding-004',
            content: { parts: [{ text: searchQuery }] }
          }),
        }
      );

      if (embeddingResponse.ok) {
        const embeddingData = await embeddingResponse.json();
        const queryEmbedding = embeddingData.embedding?.values;

        if (queryEmbedding) {
          const { data: results } = await supabase.rpc('search_legal_docs', {
            query_embedding: queryEmbedding,
            match_threshold: 0.4,
            match_count: 3,
            filter_category: null
          });

          if (results) {
            for (const r of results) {
              relevantLaws.push({
                claim_type: claim.claim_type,
                article_number: r.article_number,
                category: r.category,
                content: r.content.slice(0, 1000),
                similarity: r.similarity
              });
            }
          }
        }
      }
    }

    console.log(`Found ${relevantLaws.length} relevant legal articles`);

    // Step 2: GAP ANALYSIS - Compare evidence against legal requirements
    console.log('Phase 2: Gap Analysis - Checking evidence against legal requirements...');

    const evidenceDescription = evidence && evidence.length > 0 
      ? evidence.map((e: any, i: number) => `${i + 1}. ${e.name} (${e.type})`).join('\n')
      : 'مدرکی آپلود نشده است';

    const gapAnalysisPrompt = `شما یک وکیل کار متخصص هستید. باید مدارک کارفرما را با الزامات قانونی مقایسه کنید.

## ادعاهای کارگر:
${extractedClaims.map((c, i) => `${i + 1}. ${c.claim_type}: ${c.description}`).join('\n')}

## مواد قانونی مرتبط:
${relevantLaws.map(l => `- ماده ${l.article_number || 'نامشخص'} (${l.category}): ${l.content.slice(0, 500)}...`).join('\n\n')}

## مدارک ارائه شده توسط کارفرما:
${evidenceDescription}

${evidence?.length > 0 ? evidence.map((e: any) => `\n--- محتوای ${e.name} ---\n${e.content || '[محتوای فایل]'}`).join('\n') : ''}

لطفاً تحلیل کنید:
1. برای هر ادعا، چه مدارکی طبق قانون لازم است؟
2. کدام مدارک ضروری موجود نیستند؟
3. سوالات دقیق برای دریافت مدارک ناقص

از تابع analyze_evidence_gap استفاده کنید.`;

    const gapResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [{ role: 'user', content: gapAnalysisPrompt }],
        tools: [{
          type: 'function',
          function: {
            name: 'analyze_evidence_gap',
            description: 'Analyze gaps between required and provided evidence',
            parameters: {
              type: 'object',
              properties: {
                evidence_analysis: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      claim_type: { type: 'string' },
                      required_evidence: { type: 'array', items: { type: 'string' } },
                      provided_evidence: { type: 'array', items: { type: 'string' } },
                      missing_evidence: { type: 'array', items: { type: 'string' } },
                      legal_basis: { type: 'string', description: 'ماده قانونی مربوطه' }
                    }
                  }
                },
                follow_up_questions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      question: { type: 'string', description: 'سوال برای کارفرما' },
                      reason: { type: 'string', description: 'چرا این مدرک مهم است' },
                      related_article: { type: 'string' }
                    }
                  }
                },
                can_proceed: { type: 'boolean', description: 'آیا مدارک کافی برای ادامه هست؟' }
              },
              required: ['evidence_analysis', 'follow_up_questions', 'can_proceed']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'analyze_evidence_gap' } }
      }),
    });

    if (!gapResponse.ok) {
      const errorText = await gapResponse.text();
      console.error('Gap analysis error:', errorText);
      throw new Error('Failed to analyze evidence gaps');
    }

    const gapData = await gapResponse.json();
    let gapAnalysis: any = { evidence_analysis: [], follow_up_questions: [], can_proceed: false };

    try {
      const toolCall = gapData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        gapAnalysis = JSON.parse(toolCall.function.arguments);
      }
    } catch (e) {
      console.error('Error parsing gap analysis:', e);
    }

    console.log(`Gap Analysis complete. Can proceed: ${gapAnalysis.can_proceed}, Questions: ${gapAnalysis.follow_up_questions?.length || 0}`);

    // Step 3: VERDICT & STRATEGY
    console.log('Phase 3: Verdict - Calculating risk and generating strategy...');

    const verdictPrompt = `شما یک وکیل باتجربه دیوان عدالت اداری هستید. باید احتمال برد/باخت پرونده را ارزیابی کنید.

## ادعاهای کارگر:
${extractedClaims.map((c, i) => `${i + 1}. ${c.claim_type}: ${c.description}`).join('\n')}

## تحلیل مدارک:
${JSON.stringify(gapAnalysis.evidence_analysis, null, 2)}

## مدارک موجود:
${evidenceDescription}

## مدارک ناقص:
${gapAnalysis.evidence_analysis?.flatMap((e: any) => e.missing_evidence || []).join(', ') || 'ندارد'}

بر اساس تجربه، ارزیابی کنید:
1. احتمال باخت (0-100) - بر اساس قوت مدارک
2. توصیه استراتژیک: دفاع قاطع یا سازش
3. اگر توصیه دفاع است، متن لایحه دفاعیه

از تابع generate_verdict استفاده کنید.`;

    const verdictResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [{ role: 'user', content: verdictPrompt }],
        tools: [{
          type: 'function',
          function: {
            name: 'generate_verdict',
            description: 'Generate case verdict and strategy recommendation',
            parameters: {
              type: 'object',
              properties: {
                risk_score: { 
                  type: 'number', 
                  description: 'احتمال باخت از 0 تا 100 (100 = باخت قطعی)' 
                },
                risk_level: { 
                  type: 'string', 
                  enum: ['low', 'medium', 'high', 'critical'],
                  description: 'سطح ریسک کلی'
                },
                recommendation: { 
                  type: 'string', 
                  enum: ['fight', 'settle', 'needs_more_info'],
                  description: 'توصیه: fight=دفاع کنید، settle=سازش کنید، needs_more_info=مدارک بیشتر لازم است'
                },
                reasoning: { 
                  type: 'string', 
                  description: 'توضیح دقیق دلایل این ارزیابی' 
                },
                key_strengths: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'نقاط قوت پرونده کارفرما'
                },
                key_weaknesses: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'نقاط ضعف پرونده کارفرما'
                },
                defense_bill: { 
                  type: 'string', 
                  description: 'متن کامل لایحه دفاعیه (فقط اگر توصیه fight است)' 
                },
                settlement_advice: {
                  type: 'string',
                  description: 'توصیه برای سازش (فقط اگر توصیه settle است)'
                }
              },
              required: ['risk_score', 'risk_level', 'recommendation', 'reasoning']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'generate_verdict' } }
      }),
    });

    if (!verdictResponse.ok) {
      const errorText = await verdictResponse.text();
      console.error('Verdict generation error:', errorText);
      
      if (verdictResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'سرویس شلوغ است، لطفاً کمی صبر کنید' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error('Failed to generate verdict');
    }

    const verdictData = await verdictResponse.json();
    let verdict: any = { 
      risk_score: 50, 
      risk_level: 'medium', 
      recommendation: 'needs_more_info',
      reasoning: 'تحلیل کامل نشد'
    };

    try {
      const toolCall = verdictData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        verdict = JSON.parse(toolCall.function.arguments);
      }
    } catch (e) {
      console.error('Error parsing verdict:', e);
    }

    console.log(`Verdict: Risk ${verdict.risk_score}%, Recommendation: ${verdict.recommendation}`);

    // Build the final response
    const response = {
      success: true,
      claims: extractedClaims,
      relevantLaws: relevantLaws.slice(0, 5),
      gapAnalysis: {
        evidenceAnalysis: gapAnalysis.evidence_analysis || [],
        followUpQuestions: gapAnalysis.follow_up_questions || [],
        canProceed: gapAnalysis.can_proceed
      },
      verdict: {
        riskScore: verdict.risk_score,
        riskLevel: verdict.risk_level,
        recommendation: verdict.recommendation,
        reasoning: verdict.reasoning,
        keyStrengths: verdict.key_strengths || [],
        keyWeaknesses: verdict.key_weaknesses || [],
        defenseBill: verdict.defense_bill,
        settlementAdvice: verdict.settlement_advice
      }
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in defense-builder:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'خطای ناشناخته',
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
