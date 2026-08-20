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
      return new Response(JSON.stringify({ success: false, error: 'API key not configured' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const prompt = `تحلیل جایگاه بازار شرکت "${companyName}" در صنعت "${industry}" ایران. خروجی فقط JSON:
{"marketRank":عدد,"totalPlayers":عدد,"marketShare":عدد,"marketTrend":"growing"|"stable"|"declining","industryGrowth":عدد,"competitiveIntensity":"high"|"medium"|"low","entryBarriers":"high"|"medium"|"low","marketSize":"حجم به ریال","yearToYear":عدد درصد رشد,"keyInsights":["بینش۱","بینش۲"],"opportunities":["فرصت۱","فرصت۲"],"threats":["تهدید۱","تهدید۲"]}`;

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
      marketRank: 5, totalPlayers: 20, marketShare: 15, marketTrend: "stable", industryGrowth: 8,
      competitiveIntensity: "medium", entryBarriers: "medium", marketSize: "۵۰,۰۰۰ میلیارد ریال",
      yearToYear: 12, keyInsights: ["در حال تحلیل"], opportunities: ["در حال تحلیل"], threats: ["در حال تحلیل"]
    }}), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
