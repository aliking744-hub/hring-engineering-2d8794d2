import { requireUser } from "../_shared/auth.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const competitorNames = competitors?.map((c: { name: string }) => c.name).join('، ') || '';
    
    const prompt = `تحلیل وضعیت سرمایه‌گذاری و ارزش‌گذاری شرکت‌های صنعت "${industry}" ایران.

شرکت‌ها: ${companyName}${competitorNames ? '، ' + competitorNames : ''}

اطلاعات از منابع بورس تهران، فرابورس، و اخبار اقتصادی.

خروجی فقط JSON:
{
  "companyValuations": [
    {
      "name": "نام شرکت",
      "marketCap": "ارزش بازار به ریال",
      "marketCapUSD": "ارزش به دلار",
      "peRatio": عدد P/E,
      "pbRatio": عدد P/B,
      "lastFunding": "آخرین تأمین مالی",
      "fundingRound": "Series A/B/IPO/...",
      "investors": ["سرمایه‌گذار ۱"],
      "valuationTrend": "up|down|stable",
      "changePercent": عدد درصد تغییر,
      "stockSymbol": "نماد بورسی"
    }
  ],
  "recentDeals": [
    {
      "type": "acquisition|investment|ipo|merger",
      "company": "نام شرکت",
      "amount": "مبلغ",
      "date": "تاریخ",
      "investor": "سرمایه‌گذار/خریدار",
      "description": "توضیح"
    }
  ],
  "industryMetrics": {
    "totalMarketCap": "کل ارزش بازار صنعت",
    "averagePE": عدد میانگین P/E,
    "topPerformer": "بهترین عملکرد",
    "worstPerformer": "ضعیف‌ترین عملکرد",
    "hotSectors": ["بخش داغ ۱", "بخش ۲"],
    "fundingTrend": "increasing|decreasing|stable"
  },
  "upcomingIPOs": [
    {
      "company": "نام شرکت",
      "expectedDate": "تاریخ تقریبی",
      "estimatedValue": "ارزش تخمینی"
    }
  ]
}`;

    console.log('Fetching funding data for:', companyName);

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', response.status, errorText);
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    console.log('Perplexity funding response received');

    // Extract JSON from response
    const jsonMatch = content?.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: parsed || {
          companyValuations: [],
          recentDeals: [],
          industryMetrics: {
            totalMarketCap: "در حال تحلیل",
            averagePE: 0,
            topPerformer: "",
            worstPerformer: "",
            hotSectors: [],
            fundingTrend: "stable"
          },
          upcomingIPOs: []
        },
        citations: data.citations || []
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in track-funding:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
