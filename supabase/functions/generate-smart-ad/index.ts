import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  try {
    const { position, platform, tone, highlights } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const platformGuides: Record<string, string> = {
      linkedin: "LinkedIn - professional tone, use emojis sparingly, include hashtags, 1300 characters max",
      jobinja: "Jobinja - formal Persian, structured format with bullet points",
      jobvision: "JobVision - clear sections, emphasis on benefits and requirements",
      instagram: "Instagram - engaging, use emojis, short paragraphs, call-to-action, 2200 characters max",
      telegram: "Telegram - concise, use formatting, include contact info"
    };

    const toneGuides: Record<string, string> = {
      formal: "رسمی و حرفه‌ای",
      friendly: "دوستانه و صمیمی",
      professional: "تخصصی و کاربردی",
      creative: "خلاقانه و جذاب"
    };

    const systemPrompt = `You are an expert HR copywriter specializing in job advertisements. Generate compelling job ads in Persian (Farsi).

Your task is to create:
1. A job advertisement text optimized for the specified platform
2. An AI image generation prompt (in English) for creating a visual banner
3. Recommended image dimensions for the platform

Platform: ${platformGuides[platform] || "General social media"}
Tone: ${toneGuides[tone] || "حرفه‌ای"}

Return a JSON object with this structure:
{
  "adText": "The full job advertisement text in Persian",
  "imagePrompt": "English prompt for AI image generation - describe a professional, modern image that represents this job position. Include style (corporate, tech, creative), colors, mood, and key visual elements. Make it suitable for a job ad banner.",
  "imageDimensions": {
    "width": number,
    "height": number,
    "aspectRatio": "string"
  },
  "hashtags": ["relevant", "hashtags"],
  "tips": ["optimization tips for this platform"]
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Create a job advertisement for:
Position: ${position}
Platform: ${platform}
Tone: ${tone}
Key Highlights: ${highlights}

Generate a compelling ad in Persian with an AI image prompt.` }
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "محدودیت درخواست. لطفاً چند لحظه صبر کنید." }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "اعتبار کافی نیست. لطفاً اکانت خود را شارژ کنید." }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: "خطا در تولید آگهی" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    let adData;
    try {
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/```\n?([\s\S]*?)\n?```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      adData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      adData = { adText: content, imagePrompt: "", imageDimensions: { width: 1200, height: 630, aspectRatio: "1.91:1" } };
    }

    return new Response(JSON.stringify({ ad: adData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-smart-ad:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
