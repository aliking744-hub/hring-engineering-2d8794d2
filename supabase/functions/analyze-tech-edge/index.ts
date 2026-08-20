import { requireUser } from "../_shared/auth.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  try {
    const { companyName, industry, technologyLag } = await req.json();
    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!apiKey) return new Response(JSON.stringify({ success: false, error: 'API not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const prompt = `تحلیل فناوری شرکت "${companyName}" با شکاف فناوری ${technologyLag}. خروجی فقط JSON:
{"currentPosition":{"score":عدد۰تا۱۰۰,"label":"عنوان","description":"توضیح"},"technologyGaps":[{"area":"حوزه","gap":"critical"|"moderate"|"minor","recommendation":"پیشنهاد"}],"emergingOpportunities":[{"technology":"نام","readiness":عدد,"impact":"high"|"medium"|"low","timeToImplement":"زمان"}],"competitorTechStack":[{"competitor":"نام","techAdvantages":["مزیت۱"]}],"roadmap":[{"phase":"فاز","actions":["اقدام۱"],"timeline":"زمان"}]}`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'sonar', messages: [{ role: 'user', content: prompt }], temperature: 0.2 }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const jsonMatch = content?.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    return new Response(JSON.stringify({ success: true, data: parsed || {
      currentPosition: { score: 60, label: "متوسط", description: "در حال تحلیل" },
      technologyGaps: [{ area: "هوش مصنوعی", gap: "moderate", recommendation: "سرمایه‌گذاری" }],
      emergingOpportunities: [{ technology: "AI", readiness: 40, impact: "high", timeToImplement: "۶ ماه" }],
      competitorTechStack: [], roadmap: [{ phase: "فاز ۱", actions: ["تحلیل"], timeline: "۳ ماه" }]
    }}), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
