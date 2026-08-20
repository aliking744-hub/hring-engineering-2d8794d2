import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  try {
    const { jobTitle, industry, seniorityLevel, educationLevel, fieldOfStudy, experienceYears, trainingMonths } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const hasTrainingMonths = trainingMonths && trainingMonths > 0;

    const systemPrompt = `You are an expert HR and L&D (Learning and Development) strategist with a deep understanding of realistic capacity planning. Based on the user's current profile${hasTrainingMonths ? ` and their STRICT time budget of ${trainingMonths} months until year-end` : ""}, generate a highly personalized, practical learning and development roadmap. 

CRITICAL REALISM RULE: ${hasTrainingMonths
  ? `The user has ONLY ${trainingMonths} months available for training this year. A full-time employee can realistically complete ONE course per month (2-4 weeks per course, a few hours per week alongside their job). Therefore, the roadmap should contain EXACTLY ${trainingMonths} milestones (one per month), each with ONE primary course or skill focus — not a list of many things. Choose only the HIGHEST PRIORITY items. Quality over quantity. This is not a wishlist; it's a realistic plan.`
  : `A full-time employee can realistically complete ONE course per month (2-4 weeks per course). Each monthly milestone should have ONE primary course or skill focus. Do not overwhelm the user. Generate 4-6 months of realistic milestones.`}

Each roadmap milestone should contain:
- The month label
- The ONE main course or skill focus for that month
- 2-3 specific, concrete action items (e.g., "تماشای دوره React Router در یودمی", "تمرین با پروژه شخصی روی GitHub")

You MUST return ONLY a valid JSON object with no markdown, no code blocks, no extra text. The JSON must have exactly this structure, with all text in Persian (Farsi):
{
  "skillGapAnalysis": "A concise paragraph (3-4 sentences) explaining the most important gaps the user must close to reach the next career level.",
  "hardSkills": [
    {"skill": "Name of technical skill", "reason": "Why it is needed and what level to aim for"}
  ],
  "softSkills": [
    {"skill": "Name of soft skill", "reason": "Why it is needed"}
  ],
  "roadmap": [
    {"month": "ماه اول", "focus": "نام یک دوره یا مهارت اصلی", "actionItems": ["اقدام اول", "اقدام دوم", "اقدام سوم"]}
  ],
  "trainingNote": "A one-sentence realistic summary of what the user can achieve in their available time, e.g. 'در ${hasTrainingMonths ? trainingMonths : "N"} ماه آینده، اگر هر ماه یک دوره اصلی طی کنید، می‌توانید مهارت X، Y و Z را به سطح کاربردی برسانید.'"
}

Return exactly ${hasTrainingMonths ? trainingMonths : "4 to 6"} months in the roadmap. Return at least 4 hard skills and 3 soft skills. All content must be in Persian.`;

    const userMessage = `Profile:
- Job Title: ${jobTitle}
- Industry: ${industry}
- Seniority Level: ${seniorityLevel}
- Education Level: ${educationLevel}
- Field of Study: ${fieldOfStudy || "Not specified"}
- Years of Relevant Experience: ${experienceYears}
${hasTrainingMonths ? `- Training Time Available Until Year-End: ${trainingMonths} months` : ""}

Generate a personalized, REALISTIC learning roadmap for this person to reach the next career level, respecting their time constraints.`;

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
