import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// ⚙️  CONFIGURATION
// ============================================================
// Paste your Make.com webhook URL here (or set it as a secret):
const MAKE_WEBHOOK_URL = Deno.env.get('MAKE_WEBHOOK_URL') || "https://HOOK_URL_HERE";
// ============================================================

interface JobRequirements {
  jobTitle: string;
  city: string;
  skills?: string;
  experience?: string;
  industry?: string;
  description?: string;
  seniorityLevel?: string;
}

// ─────────────────────────────────────────────────────────────
// STEP 1 — Fetch real candidates from Make.com / PhantomBuster
// ─────────────────────────────────────────────────────────────
async function fetchRealCandidatesFromWebhook(jobRequirements: JobRequirements): Promise<any[]> {
  console.log("[Step 1] Sending job requirements to Make.com webhook...");

  if (MAKE_WEBHOOK_URL === "https://HOOK_URL_HERE") {
    console.warn("[Step 1] ⚠️  Webhook URL not configured. Using mock data for testing.");
    // Mock data — remove this block once your webhook is live
    return [
      {
        name: "علی رضایی",
        linkedin: "https://linkedin.com/in/ali-rezaei",
        skills: `${jobRequirements.skills || "برنامه‌نویسی"}, Python, React`,
        experience: "5 سال",
        location: jobRequirements.city,
        lastCompany: "شرکت نمونه",
        about: "توسعه‌دهنده ارشد با تجربه در استارتاپ‌ها",
      },
      {
        name: "سارا محمدی",
        linkedin: "https://linkedin.com/in/sara-mohammadi",
        skills: `${jobRequirements.skills || "مدیریت پروژه"}, Agile, Scrum`,
        experience: "7 سال",
        location: jobRequirements.city,
        lastCompany: "تکنوفکر",
        about: "مدیر محصول با سابقه در شرکت‌های B2B",
      },
    ];
  }

  const response = await fetch(MAKE_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobTitle: jobRequirements.jobTitle,
      city: jobRequirements.city,
      skills: jobRequirements.skills || "",
      experience: jobRequirements.experience || "",
      industry: jobRequirements.industry || "",
      seniorityLevel: jobRequirements.seniorityLevel || "",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Webhook request failed [${response.status}]: ${errorText}`);
  }

  const rawCandidates = await response.json();
  console.log(`[Step 1] ✅ Received ${rawCandidates.length} candidates from webhook`);

  // Normalize the response — webhook may return various shapes
  if (Array.isArray(rawCandidates)) return rawCandidates;
  if (rawCandidates.candidates && Array.isArray(rawCandidates.candidates)) return rawCandidates.candidates;
  if (rawCandidates.data && Array.isArray(rawCandidates.data)) return rawCandidates.data;

  throw new Error("Webhook response is not a recognisable array of candidates");
}

// ─────────────────────────────────────────────────────────────
// STEP 2 — 5-Layer AI analysis on the real candidate list
// ─────────────────────────────────────────────────────────────
async function analyzeRealCandidates(candidates: any[], jobRequirements: JobRequirements): Promise<any[]> {
  console.log(`[Step 2] Running 5-layer AI analysis on ${candidates.length} real candidates...`);

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  // Optionally enrich each candidate with a Perplexity web search
  const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
  const enrichedCandidates = await Promise.all(
    candidates.map(async (c) => {
      if (!PERPLEXITY_API_KEY || !c.name) return c;
      try {
        const searchQuery = `${c.name} ${c.lastCompany || ""} LinkedIn ${jobRequirements.industry || ""}`;
        const pxRes = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'sonar',
            messages: [
              {
                role: 'system',
                content: 'You are a professional headhunter. Find relevant public professional information about this person. Be concise and factual. Respond in Persian.',
              },
              {
                role: 'user',
                content: `جستجو: ${searchQuery} — فعالیت لینکدین، تاریخچه شغلی و هر اطلاعات عمومی مرتبط را خلاصه کن.`,
              },
            ],
            search_recency_filter: 'month',
          }),
        });
        if (pxRes.ok) {
          const pxData = await pxRes.json();
          c.webResearchInfo = pxData.choices?.[0]?.message?.content || "";
          console.log(`[Step 2] Perplexity enrichment done for: ${c.name}`);
        }
      } catch (e) {
        console.warn(`[Step 2] Perplexity enrichment failed for ${c.name}:`, e);
      }
      return c;
    })
  );

  // ── The full 5-layer Senior Headhunter prompt ──
  const systemPrompt = `تو یک «استعدادیاب ارشد» (Senior Headhunter) هستی که وظیفه داری با تحلیل عمیق داده‌های افراد از اطلاعات واقعی جمع‌آوری شده از وب و لینکدین، بهترین کاندیدا را پیدا کنی.

مأموریت: برای هر کاندیدا، ۵ لایه تحلیل زیر را انجام بده:

## لایه ۱: تحلیل رفتار و محتوا (Activity & Sentiment Audit)
- بررسی پروفایل، فعالیت‌ها یا خلاصه About
- آیا از کلمات منفی (Burnout, Tired, End of chapter) استفاده کرده؟ -> سیگنال نارضایتی
- آیا گواهینامه جدید گرفته؟ -> سیگنال آمادگی برای ارتقا
- خروجی: تعیین «دمای کاندیدا» (hot/warm/cold)

## لایه ۲: تطبیق مهارت سخت (Hard Skill Matching)
- بررسی مهارت‌ها و سطح آنها در مقایسه با الزامات شغلی
- خروجی: امتیاز ۰-۱۰۰

## لایه ۳: مسیر شغلی (Career Trajectory)
- Job Hopping، رشد تایتل، تطابق صنعت
- خروجی: امتیاز ۰-۱۰۰

## لایه ۴: تناسب فرهنگی (Culture Fit)
- خروجی: امتیاز ۰-۱۰۰

## لایه ۵: ارزیابی ریسک (Risk & Opportunity)
- Red Flags و Green Flags واقعی و قابل استناد
- خروجی: ارزیابی ریسک

## قوانین مهم:
۱. فقط اطلاعات مستند بنویس - اگر اطلاعاتی نداری، آرایه خالی برگردان
۲. هرگز ننویس "اطلاعات پیدا نشد" - این هشدار نیست
۳. تحلیل را بر اساس داده‌های موجود انجام بده نه فرضیات

پاسخ را فقط به صورت JSON Array بده، بدون markdown یا متن اضافی.`;

  const userPrompt = `الزامات شغلی:
- عنوان شغل: ${jobRequirements.jobTitle}
- شهر: ${jobRequirements.city}
- مهارت‌های مورد نیاز: ${jobRequirements.skills || 'مشخص نشده'}
- سابقه کار مورد نیاز: ${jobRequirements.experience || 'مشخص نشده'}
- صنعت: ${jobRequirements.industry || 'مشخص نشده'}
- سطح ارشدیت: ${jobRequirements.seniorityLevel || 'مشخص نشده'}

کاندیداهای واقعی دریافت‌شده از PhantomBuster / LinkedIn:
${JSON.stringify(enrichedCandidates, null, 2)}

برای هر کاندیدا این ساختار JSON را برگردان:
{
  "name": "نام",
  "email": "ایمیل یا null",
  "phone": "تلفن یا null",
  "title": "عنوان شغلی",
  "education": "تحصیلات",
  "experience": "سابقه",
  "lastCompany": "آخرین شرکت",
  "location": "محل",
  "linkedin": "لینک لینکدین",
  "skills": ["مهارت۱", "مهارت۲"],
  "matchScore": 85,
  "candidateTemperature": "warm",
  "layerScores": {
    "activitySentiment": 80,
    "hardSkillMatch": 90,
    "careerTrajectory": 75,
    "cultureFit": 85,
    "riskOpportunity": 70
  },
  "redFlags": [],
  "greenFlags": [],
  "summary": "خلاصه تحلیل ۵ لایه‌ای",
  "recommendation": "فوری تماس بگیرید"
}

نتایج را بر اساس matchScore از بیشترین به کمترین مرتب کن. فقط JSON Array برگردان.`;

  const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!aiRes.ok) {
    const errText = await aiRes.text();
    throw new Error(`AI gateway error [${aiRes.status}]: ${errText}`);
  }

  const aiData = await aiRes.json();
  const content = aiData.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty AI response");

  let jsonStr = content.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  }

  const analyzed = JSON.parse(jsonStr);
  console.log(`[Step 2] ✅ AI analysis complete for ${analyzed.length} candidates`);
  return analyzed;
}

// ─────────────────────────────────────────────────────────────
// STEP 3 — Save analyzed candidates to the database
// ─────────────────────────────────────────────────────────────
async function saveCandidatesToDB(
  analyzedCandidates: any[],
  campaignId: string,
  supabaseClient: ReturnType<typeof createClient>
): Promise<number> {
  console.log(`[Step 3] Saving ${analyzedCandidates.length} candidates to DB for campaign ${campaignId}...`);

  const rows = analyzedCandidates.map((c: any, index: number) => ({
    campaign_id: campaignId,
    name: c.name || null,
    email: c.email || null,
    phone: c.phone || null,
    title: c.title || null,
    education: c.education || null,
    experience: c.experience || null,
    last_company: c.lastCompany || null,
    location: c.location || null,
    // skills column is text in DB — convert array
    skills: Array.isArray(c.skills) ? c.skills.join(", ") : (c.skills || null),
    match_score: typeof c.matchScore === 'number' ? c.matchScore : 50,
    candidate_temperature: c.candidateTemperature || 'cold',
    recommendation: c.recommendation || null,
    green_flags: Array.isArray(c.greenFlags) ? c.greenFlags : [],
    red_flags: Array.isArray(c.redFlags) ? c.redFlags : [],
    layer_scores: c.layerScores || null,
    raw_data: { linkedin: c.linkedin, summary: c.summary, sourceIndex: index },
    status: 'analyzed',
  }));

  const { error } = await supabaseClient
    .from('candidates')
    .insert(rows);

  if (error) throw new Error(`DB insert failed: ${error.message}`);

  console.log(`[Step 3] ✅ ${rows.length} candidates saved to DB`);
  return rows.length;
}

// ─────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { campaignId, jobRequirements } = await req.json();

    if (!campaignId || !jobRequirements?.jobTitle) {
      return new Response(
        JSON.stringify({ error: "campaignId و jobTitle الزامی هستند" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`\n🚀 Auto-headhunt started | campaign: ${campaignId} | job: ${jobRequirements.jobTitle}\n`);

    // ── Step 1 ──
    const realCandidates = await fetchRealCandidatesFromWebhook(jobRequirements);

    if (realCandidates.length === 0) {
      // Update campaign status to reflect empty result
      await supabaseClient
        .from('campaigns')
        .update({ status: 'paused', progress: 0 })
        .eq('id', campaignId);

      return new Response(
        JSON.stringify({ message: "هیچ کاندیدایی از webhook دریافت نشد", count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update progress to 33%
    await supabaseClient
      .from('campaigns')
      .update({ status: 'processing', progress: 33 })
      .eq('id', campaignId);

    // ── Step 2 ──
    const analyzedCandidates = await analyzeRealCandidates(realCandidates, jobRequirements);

    // Update progress to 66%
    await supabaseClient
      .from('campaigns')
      .update({ progress: 66 })
      .eq('id', campaignId);

    // ── Step 3 ──
    const savedCount = await saveCandidatesToDB(analyzedCandidates, campaignId, supabaseClient);

    // Final campaign update
    await supabaseClient
      .from('campaigns')
      .update({ status: 'active', progress: 100 })
      .eq('id', campaignId);

    const stats = {
      total: savedCount,
      hot: analyzedCandidates.filter((c: any) => c.candidateTemperature === 'hot').length,
      warm: analyzedCandidates.filter((c: any) => c.candidateTemperature === 'warm').length,
      cold: analyzedCandidates.filter((c: any) => c.candidateTemperature === 'cold').length,
      avgScore: Math.round(
        analyzedCandidates.reduce((s: number, c: any) => s + (c.matchScore || 0), 0) / analyzedCandidates.length
      ),
    };

    console.log(`\n✅ Auto-headhunt complete | ${JSON.stringify(stats)}\n`);

    return new Response(
      JSON.stringify({ success: true, stats, campaignId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("❌ auto-headhunt error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "خطای ناشناخته" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
