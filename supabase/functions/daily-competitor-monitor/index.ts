import { requireUser } from "../_shared/auth.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Competitor {
  name: string;
  marketShare?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  try {
    const { companyName, industry, sector, competitors } = await req.json();
    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Perplexity API key not configured' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const competitorNames = competitors?.map((c: Competitor) => c.name).join('، ') || 'رقبای اصلی';
    
    const prompt = `تحلیل اخبار و تغییرات روزانه رقبا در صنعت "${industry}" ایران. شرکت‌های رقیب: ${competitorNames}

لطفاً اخبار امروز و دیروز را از منابع معتبر ایرانی (خبرگزاری‌ها، سایت بورس، روزنامه‌های اقتصادی) بررسی کن.

خروجی فقط JSON با این ساختار:
{
  "news": [
    {
      "title": "عنوان خبر",
      "source": "نام منبع",
      "date": "تاریخ",
      "sentiment": "positive" | "negative" | "neutral",
      "competitor": "نام رقیب",
      "category": "استراتژی | محصول | بازار | مالی | منابع انسانی",
      "summary": "خلاصه تأثیر بر ما"
    }
  ],
  "alerts": [
    {
      "competitor": "نام رقیب",
      "type": "growth" | "decline" | "strategy" | "product" | "market",
      "description": "توضیح هشدار",
      "impact": "high" | "medium" | "low",
      "timestamp": "زمان"
    }
  ],
  "insights": {
    "marketMoves": ["حرکت بازار ۱", "حرکت ۲"],
    "competitorShifts": ["تغییر رقیب ۱", "تغییر ۲"],
    "opportunities": ["فرصت ۱", "فرصت ۲"],
    "warnings": ["هشدار ۱", "هشدار ۲"]
  }
}`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', response.status, errorText);
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    // Extract JSON from response
    const jsonMatch = content?.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: parsed || {
          news: [],
          alerts: [],
          insights: {
            marketMoves: ["در حال تحلیل..."],
            competitorShifts: ["در حال تحلیل..."],
            opportunities: ["در حال تحلیل..."],
            warnings: ["در حال تحلیل..."]
          }
        }
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in daily-competitor-monitor:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
