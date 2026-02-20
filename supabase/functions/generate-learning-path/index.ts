import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { jobTitle, industry, seniorityLevel, educationLevel, experienceYears } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert HR and L&D (Learning and Development) strategist. Based on the user's current profile, generate a highly personalized, practical learning and development roadmap. You MUST return ONLY a valid JSON object with no markdown, no code blocks, no extra text. The JSON must have exactly this structure, with all text in Persian (Farsi):
{
  "skillGapAnalysis": "A short paragraph explaining what the user lacks to reach the next level.",
  "hardSkills": [
    {"skill": "Name of technical skill", "reason": "Why it is needed"}
  ],
  "softSkills": [
    {"skill": "Name of soft skill", "reason": "Why it is needed"}
  ],
  "roadmap": [
    {"month": "ماه اول", "focus": "Main focus area", "actionItems": ["Task 1", "Task 2", "Task 3"]}
  ]
}
Return at least 4 hard skills, 3 soft skills, and 4-6 months in the roadmap. All content must be in Persian.`;

    const userMessage = `Profile:
- Job Title: ${jobTitle}
- Industry: ${industry}
- Seniority Level: ${seniorityLevel}
- Education Level: ${educationLevel}
- Years of Experience: ${experienceYears}

Generate a personalized learning roadmap for this person to reach the next career level.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "نرخ درخواست بیش از حد مجاز است. لطفاً کمی صبر کنید." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "اعتبار هوش مصنوعی تمام شده است." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from AI");

    // Strip markdown code blocks if present
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI JSON:", cleaned);
      throw new Error("AI returned invalid JSON");
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-learning-path error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "خطای ناشناخته" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
