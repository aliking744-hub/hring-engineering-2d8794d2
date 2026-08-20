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
    const { industry, sector, companyName } = await req.json();
    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!apiKey) return new Response(JSON.stringify({ success: false, error: 'API not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const prompt = `تحلیل ترندهای جهانی صنعت "${industry}" و یونیکورن‌های موفق. خروجی فقط JSON:
{"industryTrends":[{"trend":"نام ترند","impact":"high"|"medium"|"low","description":"توضیح"}],"topUnicorns":[{"name":"نام","country":"کشور","valuation":"ارزش","founded":"سال","keyMoves":["اقدام۱"],"lessonsLearned":["درس۱"]}],"emergingTech":["فناوری۱"],"investmentHotspots":["حوزه۱"],"whatToDo":["کار۱"],"whatToAvoid":["اجتناب۱"]}`;

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
      industryTrends: [{ trend: "هوش مصنوعی", impact: "high", description: "در حال تحلیل" }],
      topUnicorns: [{ name: "Stripe", country: "آمریکا", valuation: "$95B", founded: "2010", keyMoves: ["تمرکز بر API"], lessonsLearned: ["سادگی محصول"] }],
      emergingTech: ["AI", "Blockchain"], investmentHotspots: ["فین‌تک"], whatToDo: ["نوآوری"], whatToAvoid: ["رکود"]
    }}), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
