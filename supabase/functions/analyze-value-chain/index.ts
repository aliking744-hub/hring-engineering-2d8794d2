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
    const { companyName, industry, sector } = await req.json();
    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Perplexity API key not configured' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prompt = `تحلیل زنجیره ارزش شرکت "${companyName}" در صنعت "${industry}" ایران.

شامل:
1. شرکت‌های زیرمجموعه و وابسته
2. شرکای استراتژیک در هر بخش زنجیره ارزش
3. فرصت‌های سرمایه‌گذاری و خرید (M&A) در زنجیره
4. استارتاپ‌های مستعد رشد در اکوسیستم

خروجی فقط JSON:
{
  "valueChain": [
    {
      "segment": "نام بخش زنجیره (تأمین، تولید، توزیع، فروش، خدمات)",
      "companies": [
        {
          "name": "نام شرکت",
          "type": "subsidiary|affiliate|partner|opportunity",
          "ownership": "درصد مالکیت اگر زیرمجموعه",
          "growthPotential": "high|medium|low",
          "description": "توضیح کوتاه",
          "recommendation": "پیشنهاد اقدام"
        }
      ]
    }
  ],
  "investmentOpportunities": [
    {
      "company": "نام شرکت یا استارتاپ",
      "segment": "بخش زنجیره",
      "reason": "دلیل سرمایه‌گذاری",
      "expectedReturn": "بازده مورد انتظار",
      "riskLevel": "low|medium|high",
      "synergy": "هم‌افزایی با شرکت اصلی",
      "investmentType": "acquisition|investment|partnership"
    }
  ],
  "ecosystemInsights": {
    "totalSubsidiaries": عدد,
    "totalAffiliates": عدد,
    "keyPartners": ["شریک ۱", "شریک ۲"],
    "gaps": ["شکاف ۱ در زنجیره", "شکاف ۲"],
    "recommendations": ["توصیه ۱", "توصیه ۲"]
  }
}`;

    console.log('Analyzing value chain for:', companyName);

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
    
    console.log('Perplexity value chain response received');

    // Extract JSON from response
    const jsonMatch = content?.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (parsed) {
      console.log('Parsed value chain:', JSON.stringify(parsed).substring(0, 200));
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: parsed || {
          valueChain: [],
          investmentOpportunities: [],
          ecosystemInsights: {
            totalSubsidiaries: 0,
            totalAffiliates: 0,
            keyPartners: [],
            gaps: ["در حال تحلیل..."],
            recommendations: ["در حال تحلیل..."]
          }
        },
        citations: data.citations || []
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in analyze-value-chain:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
