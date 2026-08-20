import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Required evidence mapping based on claim type
const EVIDENCE_REQUIREMENTS: Record<string, { name: string; description: string; required: boolean }[]> = {
  wrongful_termination: [
    { name: "قرارداد کار", description: "قرارداد امضا شده بین شما و کارفرما", required: true },
    { name: "حکم اخراج یا فسخ", description: "نامه رسمی اخراج یا فسخ قرارداد از طرف کارفرما", required: true },
    { name: "فیش حقوقی", description: "آخرین فیش حقوقی یا گواهی پرداخت", required: false },
    { name: "شهادت همکاران", description: "تایید کتبی از همکاران در مورد شرایط کار", required: false },
    { name: "سابقه بیمه", description: "پرینت سوابق بیمه تامین اجتماعی", required: true },
  ],
  unpaid_salary: [
    { name: "قرارداد کار", description: "قرارداد امضا شده با ذکر حقوق توافقی", required: true },
    { name: "فیش‌های حقوقی", description: "فیش‌های حقوقی ماه‌های پرداخت نشده", required: false },
    { name: "اظهارنامه بانکی", description: "صورت‌حساب بانکی نشان‌دهنده عدم واریز", required: true },
    { name: "لیست حقوق و دستمزد", description: "لیست حقوق امضا شده توسط کارفرما", required: false },
    { name: "کارت ساعت‌زنی", description: "رکورد ورود و خروج یا حضور و غیاب", required: false },
  ],
  insurance_claim: [
    { name: "قرارداد کار", description: "قرارداد نشان‌دهنده رابطه کارگری", required: true },
    { name: "سابقه بیمه ناقص", description: "پرینت سوابق بیمه نشان‌دهنده خلا یا کسری", required: true },
    { name: "فیش حقوقی", description: "فیش حقوقی نشان‌دهنده کسر بیمه از حقوق", required: false },
    { name: "استعلام بیمه", description: "استعلام رسمی از سازمان تامین اجتماعی", required: true },
    { name: "کارت ورود و خروج", description: "مدرک حضور در محل کار", required: false },
  ],
  severance_pay: [
    { name: "قرارداد کار", description: "قرارداد با ذکر تاریخ شروع کار", required: true },
    { name: "سابقه بیمه", description: "پرینت سوابق بیمه نشان‌دهنده سنوات", required: true },
    { name: "تسویه‌حساب", description: "برگه تسویه‌حساب (در صورت وجود)", required: false },
    { name: "آخرین فیش حقوقی", description: "فیش حقوقی برای محاسبه مبنای سنوات", required: true },
    { name: "نامه پایان کار", description: "نامه رسمی اتمام همکاری", required: false },
  ],
};

// Claim type labels in Persian
const CLAIM_LABELS: Record<string, string> = {
  wrongful_termination: "اخراج غیرقانونی",
  unpaid_salary: "معوقات مزدی",
  insurance_claim: "حق بیمه",
  severance_pay: "سنوات و پایان کار",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  try {
    const { action, claimType, evidence, additionalFiles } = await req.json();

    // Action 1: Get required evidence for claim type
    if (action === "get_required_evidence") {
      const requirements = EVIDENCE_REQUIREMENTS[claimType] || [];
      return new Response(
        JSON.stringify({ requiredEvidence: requirements }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action 2: Analyze case and generate complaint
    if (action === "analyze_and_draft") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

      if (!LOVABLE_API_KEY) {
        throw new Error("LOVABLE_API_KEY is not configured");
      }

      // Initialize Supabase client for RAG
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

      // Get embedding for legal search
      const searchQuery = `قانون کار ${CLAIM_LABELS[claimType]} مدارک اثبات شرایط`;
      
      // Generate embedding using Gemini
      const embeddingResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "models/text-embedding-004",
            content: { parts: [{ text: searchQuery }] },
          }),
        }
      );

      let legalContext = "";
      let relevantArticles: string[] = [];

      if (embeddingResponse.ok) {
        const embeddingData = await embeddingResponse.json();
        const queryEmbedding = embeddingData.embedding.values;

        // Search legal_docs
        const { data: legalDocs, error: searchError } = await supabase.rpc(
          "search_legal_docs",
          {
            query_embedding: JSON.stringify(queryEmbedding),
            match_threshold: 0.5,
            match_count: 8,
          }
        );

        if (!searchError && legalDocs && legalDocs.length > 0) {
          legalContext = legalDocs
            .map((doc: any) => `[${doc.article_number || doc.category}]: ${doc.content}`)
            .join("\n\n");
          relevantArticles = legalDocs
            .filter((doc: any) => doc.article_number)
            .map((doc: any) => doc.article_number);
        }
      }

      // Build evidence summary
      const evidenceSummary = evidence
        .map((e: any) => `- ${e.label}: ${e.hasIt ? "دارد" : "ندارد"}${e.file ? " (فایل پیوست)" : ""}`)
        .join("\n");

      const requiredEvidence = EVIDENCE_REQUIREMENTS[claimType] || [];
      const missingRequired = requiredEvidence
        .filter((req) => req.required && !evidence.find((e: any) => e.label === req.name && e.hasIt))
        .map((req) => req.name);

      // Build AI prompt
      const systemPrompt = `شما یک وکیل متخصص حقوق کار ایران هستید. وظیفه شما تحلیل پرونده شکایت کارگر و ارزیابی شانس موفقیت است.

قوانین مرتبط:
${legalContext || "اطلاعات قانونی در دسترس نیست."}

شما باید:
1. بر اساس مدارک موجود و الزامات قانونی، احتمال موفقیت را از 0 تا 100 تخمین بزنید
2. نقاط قوت پرونده را شناسایی کنید
3. نقاط ضعف و مدارک ناقص را مشخص کنید
4. توصیه مشخص ارائه دهید (طرح دادخواست یا مذاکره)
5. اگر شانس موفقیت بالای 50% است، متن دادخواست رسمی تنظیم کنید

متن دادخواست باید:
- با عبارت "ریاست محترم هیات تشخیص اداره کار..." شروع شود
- به مواد قانونی مرتبط استناد کند
- فرمت رسمی سامانه جامع روابط کار را رعایت کند
- با عبارت "با احترام" و جای امضا پایان یابد

پاسخ را دقیقا در فرمت JSON زیر بدهید:
{
  "winProbability": عدد 0 تا 100,
  "riskLevel": "high" یا "medium" یا "low",
  "strongPoints": [لیست نقاط قوت],
  "weakPoints": [لیست نقاط ضعف],
  "missingEvidence": [لیست مدارک ناقص],
  "recommendation": "متن توصیه",
  "complaintText": "متن دادخواست (اگر شانس بالای 50% است) یا null",
  "relevantArticles": [لیست مواد قانونی مرتبط]
}`;

      const userPrompt = `موضوع شکایت: ${CLAIM_LABELS[claimType]}

وضعیت مدارک کارگر:
${evidenceSummary}

مدارک ضروری که ندارد: ${missingRequired.length > 0 ? missingRequired.join("، ") : "همه مدارک ضروری موجود است"}

تعداد فایل‌های اضافی: ${additionalFiles?.length || 0}

لطفا پرونده را تحلیل کنید و نتیجه را در فرمت JSON بدهید.`;

      // Call Lovable AI
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("AI API error:", aiResponse.status, errorText);
        
        if (aiResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: "سرویس شلوغ است. لطفا چند دقیقه دیگر تلاش کنید." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (aiResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: "اعتبار سرویس به پایان رسیده است." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw new Error("AI API error");
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices[0]?.message?.content || "";

      // Parse JSON from response
      let result;
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
        result = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("JSON parse error:", parseError, "Content:", content);
        // Return fallback result
        result = {
          winProbability: missingRequired.length === 0 ? 60 : 30,
          riskLevel: missingRequired.length === 0 ? "medium" : "high",
          strongPoints: evidence.filter((e: any) => e.hasIt).map((e: any) => `مدرک "${e.label}" موجود است`),
          weakPoints: missingRequired.map((m: string) => `مدرک ضروری "${m}" موجود نیست`),
          missingEvidence: missingRequired,
          recommendation: missingRequired.length > 0 
            ? "قبل از طرح شکایت، مدارک ناقص را تکمیل کنید." 
            : "مدارک کافی به نظر می‌رسد. می‌توانید اقدام کنید.",
          complaintText: null,
          relevantArticles: relevantArticles,
        };
      }

      // Merge with found articles
      if (relevantArticles.length > 0 && (!result.relevantArticles || result.relevantArticles.length === 0)) {
        result.relevantArticles = relevantArticles;
      }

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in labor-complaint-assistant:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
