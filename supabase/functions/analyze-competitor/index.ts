import { requireUser } from "../_shared/auth.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompetitorAnalysis {
  name: string;
  status: "winning" | "losing" | "stable";
  reason: string;
  strengths: string[];
  weaknesses: string[];
  marketPosition: string;
  recentNews: string[];
  codalInfo?: string;
  contracts?: string[];
  activities?: string[];
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

    console.log('Analyzing competitor with Codal data:', competitorName, 'in industry:', industry);

    const systemPrompt = `تو یک تحلیلگر رقابتی حرفه‌ای هستی که اطلاعات دقیق شرکت‌های ایرانی را از منابع رسمی استخراج و تحلیل می‌کنی.

**منابع اصلی برای جمع‌آوری اطلاعات:**
1. **سایت کدال (codal.ir)**: گزارش‌های مالی، صورت‌های مالی، اساسنامه شرکت، آگهی‌های افزایش سرمایه
2. **سایت بورس تهران (tsetmc.com)**: قیمت سهام، حجم معاملات، ارزش بازار
3. **سایت فیپیران (fipiran.ir)**: اطلاعات صندوق‌ها و شرکت‌های سرمایه‌گذاری
4. **خبرگزاری‌های اقتصادی**: دنیای اقتصاد، اقتصادآنلاین، ایسنا اقتصادی
5. **سایت رسمی شرکت**: خدمات، محصولات، قراردادها

**اطلاعاتی که باید استخراج کنی:**
- اساسنامه و موضوع فعالیت شرکت
- آخرین قراردادهای مهم منعقد شده
- وضعیت مالی (سود/زیان، درآمد، EPS)
- تغییرات سرمایه و ساختار سهامداری
- اخبار مهم ۳ ماه اخیر

خروجی را فقط به صورت JSON بده، بدون هیچ توضیح اضافه. ساختار JSON:
{
  "name": "نام شرکت",
  "status": "winning" یا "losing" یا "stable",
  "reason": "دلیل دقیق وضعیت فعلی بر اساس داده‌های کدال",
  "strengths": ["نقطه قوت مستند ۱", "نقطه قوت ۲", "نقطه قوت ۳"],
  "weaknesses": ["نقطه ضعف مستند ۱", "نقطه ضعف ۲", "نقطه ضعف ۳"],
  "marketPosition": "جایگاه دقیق در بازار با ذکر رتبه و سهم بازار",
  "recentNews": ["خبر مهم ۱ با منبع", "خبر مهم ۲"],
  "codalInfo": "خلاصه مهمترین اطلاعات از کدال",
  "contracts": ["قرارداد مهم ۱", "قرارداد ۲"],
  "activities": ["فعالیت اصلی ۱ از اساسنامه", "فعالیت ۲"]
}`;

    const userPrompt = `شرکت "${competitorName}" که رقیب "${userCompanyName || 'شرکت مورد نظر'}" در صنعت "${industry || 'نامشخص'}" است را به طور کامل تحلیل کن.

**مراحل تحلیل:**
1. ابتدا نماد بورسی شرکت را شناسایی کن
2. اطلاعات را از سایت کدال جستجو کن (codal.ir)
3. اساسنامه و موضوع فعالیت شرکت را استخراج کن
4. آخرین گزارش‌های مالی و قراردادهای منتشر شده را بررسی کن
5. اخبار اخیر شرکت را از خبرگزاری‌های معتبر جمع‌آوری کن

**معیار تعیین status:**
- winning: اگر EPS رشد داشته، قراردادهای جدید بسته، سهم بازار افزایش یافته
- losing: اگر زیان‌ده شده، سهم بازار کاهش یافته، مشکلات حقوقی دارد
- stable: اگر وضعیت نسبتاً ثابت است

لطفاً اطلاعات واقعی و مستند ارائه بده.`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Perplexity API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error?.message || 'Perplexity API error' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const content = data.choices?.[0]?.message?.content;
    console.log('Perplexity response:', content);

    let analysis: CompetitorAnalysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      analysis = {
        name: parsed.name || competitorName,
        status: ["winning", "losing", "stable"].includes(parsed.status) ? parsed.status : "stable",
        reason: parsed.reason || "تحلیل در حال بررسی است",
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5) : ["نیاز به بررسی بیشتر"],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.slice(0, 5) : ["نیاز به بررسی بیشتر"],
        marketPosition: parsed.marketPosition || "جایگاه در حال بررسی",
        recentNews: Array.isArray(parsed.recentNews) ? parsed.recentNews.slice(0, 4) : [],
        codalInfo: parsed.codalInfo || undefined,
        contracts: Array.isArray(parsed.contracts) ? parsed.contracts.slice(0, 3) : [],
        activities: Array.isArray(parsed.activities) ? parsed.activities.slice(0, 4) : [],
      };
    } catch (parseError) {
      console.error('Error parsing Perplexity response:', parseError);
      analysis = {
        name: competitorName,
        status: "stable",
        reason: "اطلاعات در حال جمع‌آوری از کدال و منابع رسمی است",
        strengths: ["نیاز به بررسی گزارش‌های مالی"],
        weaknesses: ["نیاز به بررسی بیشتر"],
        marketPosition: "در حال استخراج از منابع رسمی",
        recentNews: [],
        contracts: [],
        activities: [],
      };
    }

    console.log('Processed competitor analysis:', analysis);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: analysis,
        citations: data.citations || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error analyzing competitor:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});