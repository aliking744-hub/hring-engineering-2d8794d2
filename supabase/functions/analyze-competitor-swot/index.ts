import { requireUser } from "../_shared/auth.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompetitorSWOT {
  name: string;
  status: "winning" | "losing" | "stable";
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  try {
    const { competitorName, industry, userCompanyName } = await req.json();

    if (!competitorName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Competitor name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!apiKey) {
      console.error('PERPLEXITY_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Perplexity connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Analyzing SWOT for competitor:', competitorName);

    const systemPrompt = `تو یک تحلیلگر استراتژیک هستی که تحلیل SWOT شرکت‌های ایرانی را انجام می‌دهی.

خروجی را فقط به صورت JSON بده، بدون هیچ توضیح اضافه. ساختار JSON باید دقیقاً به این شکل باشد:
{
  "name": "نام شرکت",
  "status": "winning" یا "losing" یا "stable",
  "strengths": ["قوت ۱", "قوت ۲", "قوت ۳"],
  "weaknesses": ["ضعف ۱", "ضعف ۲", "ضعف ۳"],
  "opportunities": ["فرصت ۱", "فرصت ۲", "فرصت ۳"],
  "threats": ["تهدید ۱", "تهدید ۲", "تهدید ۳"]
}

معیار status:
- winning: رشد سهم بازار یا سودآوری
- losing: کاهش سهم بازار یا زیان‌ده
- stable: وضعیت ثابت

نکات مهم:
- Strengths: مزایای رقابتی داخلی شرکت
- Weaknesses: نقاط ضعف داخلی شرکت
- Opportunities: فرصت‌های خارجی بازار که می‌تواند استفاده کند
- Threats: تهدیدات خارجی که ممکن است آسیب برساند`;

    const userPrompt = `تحلیل SWOT کامل شرکت "${competitorName}" در صنعت "${industry || 'نامشخص'}" را انجام بده.

منابع اطلاعات:
1. کدال (codal.ir) - گزارش‌های مالی
2. بورس تهران (tsetmc.com)
3. خبرگزاری‌های اقتصادی
4. سایت رسمی شرکت

برای هر بخش SWOT حداقل ۳ مورد مشخص و کاربردی ارائه بده.`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 1500,
      }),
    });

    // Check response status BEFORE parsing JSON
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', response.status, errorText.substring(0, 200));
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Perplexity API error: ${response.status}`,
          data: {
            name: competitorName,
            status: "stable",
            strengths: ["خطا در دریافت اطلاعات"],
            weaknesses: ["خطا در دریافت اطلاعات"],
            opportunities: ["خطا در دریافت اطلاعات"],
            threats: ["خطا در دریافت اطلاعات"],
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    console.log('Perplexity SWOT response:', content);

    let swot: CompetitorSWOT;
    try {
      const jsonMatch = content?.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      swot = {
        name: parsed.name || competitorName,
        status: ["winning", "losing", "stable"].includes(parsed.status) ? parsed.status : "stable",
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5) : ["نقطه قوت نامشخص"],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.slice(0, 5) : ["نقطه ضعف نامشخص"],
        opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities.slice(0, 5) : ["فرصت نامشخص"],
        threats: Array.isArray(parsed.threats) ? parsed.threats.slice(0, 5) : ["تهدید نامشخص"],
      };
    } catch (parseError) {
      console.error('Error parsing SWOT response:', parseError);
      swot = {
        name: competitorName,
        status: "stable",
        strengths: ["نیاز به بررسی بیشتر"],
        weaknesses: ["نیاز به بررسی بیشتر"],
        opportunities: ["نیاز به بررسی بیشتر"],
        threats: ["نیاز به بررسی بیشتر"],
      };
    }

    console.log('Processed SWOT analysis:', swot);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: swot,
        citations: data.citations || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error analyzing competitor SWOT:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
