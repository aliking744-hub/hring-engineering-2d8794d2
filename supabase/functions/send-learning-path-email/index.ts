import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface HardSoftSkill { skill: string; reason: string; }
interface RoadmapMonth { month: string; focus: string; actionItems: string[]; }
interface LearningPathResult {
  skillGapAnalysis: string;
  hardSkills: HardSoftSkill[];
  softSkills: HardSoftSkill[];
  roadmap: RoadmapMonth[];
  trainingNote?: string;
}

function buildHTML(employeeName: string, jobTitle: string, result: LearningPathResult): string {
  const roadmapRows = result.roadmap.map((m, i) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;vertical-align:top;width:90px;">
        <span style="display:inline-block;background:#dcfce7;color:#15803d;border-radius:6px;padding:4px 8px;font-size:12px;font-weight:700;">${i + 1}</span>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
        <strong style="color:#166534;">${m.month} – ${m.focus}</strong>
        <ul style="margin:8px 0 0 0;padding-right:20px;">
          ${m.actionItems.map(a => `<li style="color:#374151;font-size:14px;margin-bottom:4px;">${a}</li>`).join("")}
        </ul>
      </td>
    </tr>
  `).join("");

  const hardSkillsHtml = result.hardSkills.map(s => `
    <li style="margin-bottom:10px;padding:10px 12px;background:#eff6ff;border-right:3px solid #3b82f6;border-radius:4px;">
      <strong style="color:#1d4ed8;">${s.skill}</strong>
      <p style="color:#6b7280;font-size:13px;margin:4px 0 0;">${s.reason}</p>
    </li>
  `).join("");

  const softSkillsHtml = result.softSkills.map(s => `
    <li style="margin-bottom:10px;padding:10px 12px;background:#faf5ff;border-right:3px solid #8b5cf6;border-radius:4px;">
      <strong style="color:#6d28d9;">${s.skill}</strong>
      <p style="color:#6b7280;font-size:13px;margin:4px 0 0;">${s.reason}</p>
    </li>
  `).join("");

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>نقشه راه یادگیری</title></head>
<body style="font-family:'Segoe UI',Tahoma,Arial,sans-serif;background:#f9fafb;margin:0;padding:24px;direction:rtl;">
  <div style="max-width:680px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:32px 28px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;">🎓 نقشه راه آموزشی شما</h1>
      <p style="color:#bfdbfe;margin:8px 0 0;font-size:15px;">${employeeName} عزیز، برنامه توسعه شما برای شغل <strong>${jobTitle}</strong> آماده است.</p>
    </div>

    <div style="padding:28px;">

      ${result.trainingNote ? `
      <!-- Training Note -->
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 18px;margin-bottom:24px;">
        <p style="margin:0;color:#166534;font-size:14px;">✅ ${result.trainingNote}</p>
      </div>` : ""}

      <!-- Skill Gap -->
      <div style="margin-bottom:28px;">
        <h2 style="color:#92400e;font-size:16px;margin:0 0 10px;border-bottom:2px solid #fef3c7;padding-bottom:8px;">📊 تحلیل شکاف مهارتی</h2>
        <div style="background:#fffbeb;border-right:4px solid #f59e0b;padding:14px 16px;border-radius:4px;">
          <p style="color:#374151;font-size:14px;line-height:1.8;margin:0;">${result.skillGapAnalysis}</p>
        </div>
      </div>

      <!-- Hard Skills -->
      <div style="margin-bottom:28px;">
        <h2 style="color:#1d4ed8;font-size:16px;margin:0 0 12px;border-bottom:2px solid #dbeafe;padding-bottom:8px;">🛠 مهارت‌های سخت که باید توسعه دهید</h2>
        <ul style="list-style:none;padding:0;margin:0;">${hardSkillsHtml}</ul>
      </div>

      <!-- Soft Skills -->
      <div style="margin-bottom:28px;">
        <h2 style="color:#6d28d9;font-size:16px;margin:0 0 12px;border-bottom:2px solid #ede9fe;padding-bottom:8px;">🤝 مهارت‌های نرم که باید توسعه دهید</h2>
        <ul style="list-style:none;padding:0;margin:0;">${softSkillsHtml}</ul>
      </div>

      <!-- Roadmap -->
      <div style="margin-bottom:16px;">
        <h2 style="color:#166534;font-size:16px;margin:0 0 12px;border-bottom:2px solid #dcfce7;padding-bottom:8px;">🗓 نقشه راه اجرایی – اولویت‌بندی واقع‌بینانه</h2>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          ${roadmapRows}
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:20px 28px;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">این نقشه راه توسط سیستم هوش مصنوعی HRing تولید شده است.</p>
    </div>
  </div>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { employeeName, employeeEmail, jobTitle, result } = await req.json() as {
      employeeName: string;
      employeeEmail: string;
      jobTitle: string;
      result: LearningPathResult;
    };

    if (!employeeEmail) throw new Error("Employee email is required");

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const html = buildHTML(employeeName, jobTitle, result);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "HRing <onboarding@resend.dev>",
        to: [employeeEmail],
        subject: `📚 نقشه راه آموزشی شما – ${jobTitle}`,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Resend error:", response.status, err);
      throw new Error(`Email service error: ${response.status}`);
    }

    const data = await response.json();
    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-learning-path-email error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "خطای ناشناخته" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
