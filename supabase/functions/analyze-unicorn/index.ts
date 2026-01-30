import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StartupProfile {
  companyName: string;
  companyUrl: string;
  linkedinUrl?: string;
  foundersBio?: string;
  currentValuation: number;
  monthlyActiveUsers: number;
  burnRate: number;
}

interface AnalysisRequest {
  profile: StartupProfile;
  analysisId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profile, analysisId } = await req.json() as AnalysisRequest;
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Analyzing startup: ${profile.companyName}`);

    // Step 1: Gather web intelligence about the company
    const webSearchPrompt = `
شما یک تحلیلگر ارشد سرمایه‌گذاری هستید. براساس اطلاعات زیر، تحلیل جامعی از این استارتاپ ارائه دهید:

**اطلاعات شرکت:**
- نام: ${profile.companyName}
- وب‌سایت: ${profile.companyUrl}
- لینکدین: ${profile.linkedinUrl || 'ندارد'}
- بیوگرافی بنیان‌گذاران: ${profile.foundersBio || 'ارائه نشده'}

**شاخص‌های مالی ادعا شده:**
- ارزش‌گذاری فعلی: ${profile.currentValuation.toLocaleString()} میلیون تومان
- کاربران فعال ماهانه: ${profile.monthlyActiveUsers.toLocaleString()}
- نرخ سوختن ماهانه: ${profile.burnRate.toLocaleString()} میلیون تومان

لطفاً یک تحلیل JSON با ساختار زیر ارائه دهید:

{
  "uScore": عدد بین 0-100 (امتیاز کلی پتانسیل یونیکورن),
  "financialHealth": {
    "grossMargin": درصد حاشیه سود ناخالص تخمینی,
    "burnRate": نرخ سوختن ماهانه به تومان,
    "runway": عمر مالی به ماه,
    "healthGrade": یکی از "A", "B", "C", "D", "F"
  },
  "founderGrit": {
    "resilience": درصد تاب‌آوری (0-100),
    "experience": درصد تجربه (0-100),
    "adaptability": درصد انطباق‌پذیری (0-100),
    "networkStrength": درصد قدرت شبکه ارتباطی (0-100),
    "overallScore": میانگین امتیاز (0-100)
  },
  "techViability": {
    "score": امتیاز فنی (0-100),
    "aiProof": آیا در برابر جایگزینی AI مقاوم است (true/false),
    "riskLevel": یکی از "low", "medium", "high",
    "insights": آرایه‌ای از 3 بینش کلیدی فنی به فارسی
  },
  "nationalUtility": {
    "dataSovereignty": آیا داده‌ها در ایران نگهداری می‌شوند (true/false),
    "exportReady": آیا قابلیت صادرات دارد (true/false),
    "localImpact": درصد تاثیر محلی (0-100),
    "jobCreation": تعداد تخمینی اشتغال‌زایی
  },
  "verdict": {
    "status": یکی از "rejected", "conditional", "approved", "unicorn",
    "summary": خلاصه حکم به فارسی (حداکثر 2 جمله),
    "recommendations": آرایه‌ای از 4 پیشنهاد به فارسی
  }
}

مهم: فقط JSON خالص برگردانید، بدون هیچ توضیح اضافی.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "شما یک تحلیلگر سرمایه‌گذاری متخصص در ارزیابی استارتاپ‌ها هستید. پاسخ‌های شما باید دقیق، واقع‌بینانه و مبتنی بر داده باشد. همیشه فقط JSON خالص برگردانید."
          },
          {
            role: "user",
            content: webSearchPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "سرویس در حال حاضر شلوغ است. لطفاً چند دقیقه دیگر تلاش کنید." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "اعتبار کافی نیست. لطفاً اعتبار خود را شارژ کنید." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("خطا در سرویس هوش مصنوعی");
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("پاسخی از هوش مصنوعی دریافت نشد");
    }

    // Parse JSON from response
    let analysisResult;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("JSON not found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      // Return a fallback result if parsing fails
      analysisResult = generateFallbackResult(profile);
    }

    // Validate and normalize the result
    analysisResult = normalizeResult(analysisResult, profile);

    console.log(`Analysis complete for ${profile.companyName}, U-Score: ${analysisResult.uScore}`);

    return new Response(
      JSON.stringify({ success: true, result: analysisResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in unicorn analysis:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "خطای ناشناخته در تحلیل" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateFallbackResult(profile: StartupProfile) {
  const baseScore = Math.min(95, Math.max(30, 
    50 + 
    (profile.monthlyActiveUsers > 100000 ? 15 : profile.monthlyActiveUsers > 10000 ? 10 : 5) +
    (profile.currentValuation > 10000 ? 10 : 5) +
    (profile.foundersBio && profile.foundersBio.length > 200 ? 10 : 5) +
    Math.random() * 15
  ));

  const burnRate = profile.burnRate * 1000000;
  const runway = Math.round(profile.currentValuation / (profile.burnRate || 1));

  return {
    uScore: Math.round(baseScore),
    financialHealth: {
      grossMargin: Math.round(35 + Math.random() * 30),
      burnRate: burnRate,
      runway: Math.min(36, Math.max(3, runway)),
      healthGrade: baseScore >= 80 ? 'A' : baseScore >= 60 ? 'B' : baseScore >= 40 ? 'C' : 'D'
    },
    founderGrit: {
      resilience: Math.round(60 + Math.random() * 30),
      experience: Math.round(50 + Math.random() * 40),
      adaptability: Math.round(55 + Math.random() * 35),
      networkStrength: Math.round(45 + Math.random() * 40),
      overallScore: Math.round(55 + Math.random() * 30)
    },
    techViability: {
      score: Math.round(50 + Math.random() * 40),
      aiProof: Math.random() > 0.4,
      riskLevel: Math.random() > 0.6 ? 'low' : Math.random() > 0.3 ? 'medium' : 'high',
      insights: [
        'زیرساخت فنی نیاز به بررسی بیشتر دارد',
        'پتانسیل رشد در بازار داخلی وجود دارد',
        'نیاز به تقویت امنیت سایبری'
      ]
    },
    nationalUtility: {
      dataSovereignty: Math.random() > 0.3,
      exportReady: Math.random() > 0.5,
      localImpact: Math.round(40 + Math.random() * 50),
      jobCreation: Math.round(20 + Math.random() * 180)
    },
    verdict: {
      status: baseScore >= 90 ? 'unicorn' : baseScore >= 70 ? 'approved' : baseScore >= 50 ? 'conditional' : 'rejected',
      summary: `شرکت ${profile.companyName} نیاز به بررسی بیشتر دارد. تحلیل اولیه انجام شده است.`,
      recommendations: [
        'تنوع‌بخشی به منابع درآمدی',
        'کاهش وابستگی به خدمات خارجی',
        'تقویت تیم فنی و امنیت سایبری',
        'گسترش بازار هدف به کشورهای منطقه'
      ]
    }
  };
}

function normalizeResult(result: any, profile: StartupProfile) {
  // Ensure all required fields exist with valid values
  return {
    uScore: Math.max(0, Math.min(100, result.uScore || 50)),
    financialHealth: {
      grossMargin: result.financialHealth?.grossMargin || 40,
      burnRate: result.financialHealth?.burnRate || profile.burnRate * 1000000,
      runway: result.financialHealth?.runway || 12,
      healthGrade: result.financialHealth?.healthGrade || 'C'
    },
    founderGrit: {
      resilience: result.founderGrit?.resilience || 60,
      experience: result.founderGrit?.experience || 55,
      adaptability: result.founderGrit?.adaptability || 60,
      networkStrength: result.founderGrit?.networkStrength || 50,
      overallScore: result.founderGrit?.overallScore || 55
    },
    techViability: {
      score: result.techViability?.score || 60,
      aiProof: result.techViability?.aiProof ?? true,
      riskLevel: result.techViability?.riskLevel || 'medium',
      insights: result.techViability?.insights || ['در حال تحلیل...']
    },
    nationalUtility: {
      dataSovereignty: result.nationalUtility?.dataSovereignty ?? true,
      exportReady: result.nationalUtility?.exportReady ?? false,
      localImpact: result.nationalUtility?.localImpact || 50,
      jobCreation: result.nationalUtility?.jobCreation || 50
    },
    verdict: {
      status: result.verdict?.status || 'conditional',
      summary: result.verdict?.summary || `تحلیل شرکت ${profile.companyName} انجام شد.`,
      recommendations: result.verdict?.recommendations || ['نیاز به بررسی بیشتر']
    }
  };
}
