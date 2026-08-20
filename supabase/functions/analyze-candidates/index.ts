import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkRateLimit, getClientIdentifier, rateLimitResponse } from "../_shared/rate-limiter.ts";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limit: 5 requests per minute per user
const RATE_LIMIT_CONFIG = { windowMs: 60000, maxRequests: 5 };

interface CandidateInput {
  name?: string;
  email?: string;
  phone?: string;
  skills?: string;
  experience?: string;
  education?: string;
  lastCompany?: string;
  location?: string;
  linkedin?: string;
  pastCompanies?: string;
  about?: string;
}

interface JobRequirements {
  jobTitle: string;
  city: string;
  skills?: string;
  experience?: string;
  industry?: string;
  description?: string;
  seniorityLevel?: string;
}

// Search for candidate info on the web using Perplexity
async function searchCandidateOnWeb(candidate: CandidateInput, jobRequirements: JobRequirements): Promise<string> {
  const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
  
  if (!PERPLEXITY_API_KEY) {
    console.log("Perplexity API key not found, skipping web search");
    return "";
  }

  try {
    const searchQuery = `${candidate.name || ''} ${candidate.lastCompany || ''} ${jobRequirements.industry || ''} LinkedIn profile professional background`;
    
    console.log(`Searching web for: ${candidate.name}`);
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
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
            content: 'You are a professional headhunter researching candidates. Find relevant professional information about this person including their LinkedIn activity, career history, and any public professional information. Focus on signals that indicate job satisfaction, career growth, and professional activity. Respond in Persian.' 
          },
          { 
            role: 'user', 
            content: `جستجو کن: ${searchQuery}. اطلاعات حرفه‌ای، فعالیت لینکدین، سابقه کاری و هر اطلاعات عمومی مرتبط را پیدا کن.` 
          }
        ],
        search_recency_filter: 'month',
      }),
    });

    if (!response.ok) {
      console.error("Perplexity search failed:", response.status);
      return "";
    }

    const data = await response.json();
    const webInfo = data.choices?.[0]?.message?.content || "";
    console.log(`Web search completed for: ${candidate.name}`);
    return webInfo;
  } catch (error) {
    console.error("Error searching web:", error);
    return "";
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
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
    const { candidates, jobRequirements, enableWebSearch = true } = await req.json();

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return new Response(
        JSON.stringify({ error: "لیست کاندیداها خالی است" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit batch size to prevent API abuse
    const MAX_CANDIDATES = 20;
    if (candidates.length > MAX_CANDIDATES) {
      return new Response(
        JSON.stringify({ error: `حداکثر ${MAX_CANDIDATES} کاندیدا در هر درخواست قابل پردازش است` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Processing ${candidates.length} candidates for job: ${jobRequirements.jobTitle}`);

    // Perform web search for each candidate (if enabled)
    const candidatesWithWebInfo = await Promise.all(
      candidates.map(async (candidate: CandidateInput, sourceIndex: number) => {
        let webResearchInfo = "";
        if (enableWebSearch && candidate.name) {
          webResearchInfo = await searchCandidateOnWeb(candidate, jobRequirements);
        }
        return {
          ...candidate,
          sourceIndex,
          webResearchInfo,
        };
      })
    );


    // Senior Headhunter AI Prompt with 5-Layer Analysis
    const systemPrompt = `تو یک «استعدادیاب ارشد» (Senior Headhunter) هستی که وظیفه داری با تحلیل عمیق داده‌های افراد از رزومه یا اطلاعات وارد شده و اطلاعات جمع‌آوری شده از وب، بهترین کاندیدا را پیدا کنی.

مأموریت: برای هر کاندیدا، ۵ لایه تحلیل زیر را انجام بده:

## لایه ۱: تحلیل رفتار و محتوا (Activity & Sentiment Audit)
- بررسی پروفایل شخص، فعالیت‌ها یا خلاصه About
- آیا از کلمات منفی (Burnout, Tired, End of chapter) استفاده کرده؟ -> سیگنال نارضایتی
- آیا گواهینامه (Certificate) جدید گرفته؟ -> سیگنال آمادگی برای ارتقا
- آیا پست‌های تخصصی می‌گذارد یا فقط اخبار شرکتش را بازنشر می‌کند؟ -> تشخیص سطح تخصص vs کارمند مطیع
- خروجی: تعیین «دمای کاندیدا» (Warm/Cold) برای تماس

## لایه ۲: تطبیق مهارت سخت (Hard Skill Matching)
- بررسی مهارت‌هایی که کاربر داده
- فقط به کلمات کلیدی نگاه نکن؛ به سطح آنها دقت کن
- اگر دنبال Senior هستیم و او در ۳ شرکت آخرش Junior یا Mid-level بوده -> عدم انطباق
- اگر تکنولوژی‌هایش قدیمی است (Legacy) و استک مدرن می‌خواهیم -> نمره منفی
- خروجی: امتیاز ۰-۱۰۰ برای مهارت‌های سخت

## لایه ۳: مسیر شغلی (Career Trajectory)
- تحلیل لیست شرکت‌های قبلی
- Job Hopping: آیا هر ۶ ماه شغل عوض کرده؟ -> هشدار ریسک (Red Flag)
- Growth: آیا در هر جابجایی تایتل بالاتری گرفته؟ -> نیروی با پتانسیل بالا
- Company Tier: آیا در شرکت‌های هم‌تراز یا بهتر کار کرده؟
- Industry Match: آیا در صنعت مورد نظر ما کار کرده؟
- خروجی: امتیاز ۰-۱۰۰ برای مسیر شغلی

## لایه ۴: تحلیل فرهنگی و نرم (Soft Skills & Culture Fit)
- بررسی نحوه ارتباط و تعامل فرد
- تحلیل فعالیت‌های اجتماعی و تیمی
- سازگاری با فرهنگ سازمانی
- خروجی: امتیاز ۰-۱۰۰ برای تناسب فرهنگی

## لایه ۵: ارزیابی ریسک و فرصت (Risk & Opportunity Assessment)
- شناسایی Red Flags (Job hopping, گپ‌های شغلی، ناهماهنگی در رزومه)
- شناسایی Green Flags (رشد پیوسته، گواهینامه‌های جدید، پروژه‌های موفق)
- احتمال پذیرش پیشنهاد
- خروجی: ارزیابی ریسک و فرصت

## قوانین مهم برای نوشتن Green Flags و Red Flags:
۱. فقط اطلاعات مستند و قابل استناد بنویس - اگر اطلاعاتی نداری، چیزی ننویس
۲. هرگز ننویس "اطلاعات جمع‌آوری شده نامرتبط بود" یا "اطلاعات وب پیدا نشد" - این‌ها هشدار نیستند
۳. Red Flags فقط شامل نکات واقعی هشدار باشد مثل: Job hopping، عدم تطابق مهارت، گپ شغلی بزرگ
۴. Green Flags فقط شامل نقاط قوت واقعی و قابل اثبات باشد مثل: تحصیلات عالی، رشد شغلی، مهارت‌های مرتبط
۵. اگر برای یک بخش اطلاعات کافی نداری، آرایه خالی برگردان به جای نوشتن جملات بی‌محتوا
۶. تحلیل را بر اساس داده‌های موجود انجام بده نه فرضیات

برای هر کاندیدا این اطلاعات را برگردان:
- matchScore: امتیاز کلی (میانگین وزنی ۵ لایه)
- candidateTemperature: "hot" | "warm" | "cold" (دمای کاندیدا برای تماس)
- layerScores: امتیاز هر ۵ لایه
- redFlags: لیست هشدارهای واقعی (آرایه خالی اگر چیزی نیست)
- greenFlags: لیست نقاط قوت واقعی (آرایه خالی اگر چیزی نیست)
- summary: خلاصه تحلیل به فارسی
- recommendation: توصیه اقدام ("فوری تماس بگیرید" / "در لیست انتظار" / "رد کنید")

پاسخ را فقط به صورت JSON Array بده، بدون markdown یا متن اضافی.`;

    const userPrompt = `الزامات شغلی:
- عنوان شغل: ${jobRequirements.jobTitle}
- شهر: ${jobRequirements.city}
- مهارت‌های مورد نیاز: ${jobRequirements.skills || 'مشخص نشده'}
- سابقه کار مورد نیاز: ${jobRequirements.experience || 'مشخص نشده'}
- صنعت: ${jobRequirements.industry || 'مشخص نشده'}
- سطح ارشدیت: ${jobRequirements.seniorityLevel || 'مشخص نشده'}
- توضیحات: ${jobRequirements.description || 'ندارد'}

لیست کاندیداها برای تحلیل (شامل اطلاعات جمع‌آوری شده از وب):
${JSON.stringify(candidatesWithWebInfo, null, 2)}

برای هر کاندیدا، ۵ لایه تحلیل را انجام بده و نتیجه را به این ساختار JSON برگردان:
{
  "id": "unique_id",
  "name": "نام کاندیدا",
  "email": "ایمیل",
  "phone": "تلفن",
  "title": "عنوان شغلی پیشنهادی",
  "education": "تحصیلات",
  "experience": "سابقه کار",
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
  "redFlags": ["هشدار ۱", "هشدار ۲"],
  "greenFlags": ["نقطه قوت ۱", "نقطه قوت ۲"],
  "summary": "خلاصه تحلیل ۵ لایه‌ای به فارسی",
  "recommendation": "فوری تماس بگیرید"
}

نتایج را بر اساس matchScore از بیشترین به کمترین مرتب کن. فقط JSON Array برگردان.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "محدودیت درخواست. لطفاً چند دقیقه صبر کنید." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "اعتبار کافی نیست. لطفاً اعتبار خود را شارژ کنید." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log("AI response received, parsing results...");

    // Parse the JSON response (handle markdown code blocks if present)
    let analyzedCandidates;
    try {
      let jsonStr = content.trim();
      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      }
      analyzedCandidates = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI analysis results");
    }

    // Ensure all candidates have required fields
    const processedCandidates = analyzedCandidates.map((c: any, index: number) => ({
      id: c.id || `candidate_${Date.now()}_${index}`,
      name: c.name || `کاندیدا ${index + 1}`,
      email: c.email || '',
      phone: c.phone || '',
      title: c.title || 'نامشخص',
      education: c.education || 'نامشخص',
      experience: c.experience || 'نامشخص',
      lastCompany: c.lastCompany || 'نامشخص',
      location: c.location || jobRequirements.city,
      linkedin: c.linkedin || '',
      skills: Array.isArray(c.skills) ? c.skills : [],
      matchScore: typeof c.matchScore === 'number' ? c.matchScore : 50,
      candidateTemperature: c.candidateTemperature || 'cold',
      layerScores: {
        activitySentiment: c.layerScores?.activitySentiment || 50,
        hardSkillMatch: c.layerScores?.hardSkillMatch || 50,
        careerTrajectory: c.layerScores?.careerTrajectory || 50,
        cultureFit: c.layerScores?.cultureFit || 50,
        riskOpportunity: c.layerScores?.riskOpportunity || 50,
      },
      // Keep old scores format for backward compatibility
      scores: {
        skills: c.layerScores?.hardSkillMatch || c.scores?.skills || 50,
        experience: c.layerScores?.careerTrajectory || c.scores?.experience || 50,
        education: c.scores?.education || 50,
        culture: c.layerScores?.cultureFit || c.scores?.culture || 50,
      },
      redFlags: Array.isArray(c.redFlags) ? c.redFlags : [],
      greenFlags: Array.isArray(c.greenFlags) ? c.greenFlags : [],
      summary: c.summary || '',
      recommendation: c.recommendation || 'در لیست انتظار',
    }));

    // Sort by match score
    processedCandidates.sort((a: any, b: any) => b.matchScore - a.matchScore);

    // Calculate statistics
    const stats = {
      total: processedCandidates.length,
      excellent: processedCandidates.filter((c: any) => c.matchScore >= 85).length,
      good: processedCandidates.filter((c: any) => c.matchScore >= 70 && c.matchScore < 85).length,
      average: processedCandidates.filter((c: any) => c.matchScore < 70).length,
      avgScore: Math.round(processedCandidates.reduce((sum: number, c: any) => sum + c.matchScore, 0) / processedCandidates.length),
      hotCandidates: processedCandidates.filter((c: any) => c.candidateTemperature === 'hot').length,
      warmCandidates: processedCandidates.filter((c: any) => c.candidateTemperature === 'warm').length,
      coldCandidates: processedCandidates.filter((c: any) => c.candidateTemperature === 'cold').length,
    };

    console.log(`Analysis complete. Stats: ${JSON.stringify(stats)}`);

    return new Response(
      JSON.stringify({
        candidates: processedCandidates,
        stats,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-candidates function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "خطای ناشناخته" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
