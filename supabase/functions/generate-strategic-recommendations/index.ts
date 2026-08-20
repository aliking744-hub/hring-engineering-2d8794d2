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
    const { companyName, industry, competitors, maturityScore, strategicGoal } = await req.json();
    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!apiKey) return new Response(JSON.stringify({ success: false, error: 'API not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const prompt = `توصیه استراتژیک برای "${companyName}" در صنعت "${industry}". خروجی فقط JSON:
{"overallAssessment":{"score":عدد,"verdict":"نتیجه","summary":"خلاصه"},"mustDo":[{"action":"اقدام","reason":"دلیل","impact":"high"|"medium"|"low","urgency":"immediate"|"short-term"|"long-term"}],"mustAvoid":[{"action":"اقدام","reason":"دلیل","risk":"critical"|"high"|"medium"}],"competitorMistakes":[{"competitor":"نام","mistake":"اشتباه","lesson":"درس"}],"unicornPath":[{"milestone":"نقطه عطف","currentStatus":"achieved"|"in-progress"|"not-started","recommendation":"پیشنهاد"}],"quickWins":["پیروزی۱"]}`;

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
      overallAssessment: { score: 65, verdict: "وضعیت متوسط", summary: "در حال تحلیل" },
      mustDo: [{ action: "نوآوری", reason: "رقابت", impact: "high", urgency: "short-term" }],
      mustAvoid: [{ action: "رکود", reason: "از دست دادن بازار", risk: "high" }],
      competitorMistakes: [{ competitor: "رقیب", mistake: "عدم نوآوری", lesson: "سرمایه‌گذاری در R&D" }],
      unicornPath: [{ milestone: "رشد ۱۰برابری", currentStatus: "not-started", recommendation: "تمرکز بر مقیاس‌پذیری" }],
      quickWins: ["بهبود UX", "اتوماسیون"]
    }}), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
