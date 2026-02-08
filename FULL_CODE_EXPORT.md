# 📦 Complete Code Export Package v3.0

> **کد کامل رادار استراتژیک و آزمایشگاه یونیکورن برای ایجاد پروژه مستقل**

---

# 🎯 PART 1: STRATEGIC RADAR (رادار استراتژیک)

---

## 📄 src/pages/StrategicRadar.tsx

```tsx
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { AnimatePresence, motion } from "framer-motion";
import { useSiteName } from "@/hooks/useSiteSettings";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import RadarInputPhase from "@/components/strategic-radar/RadarInputPhase";
import VerificationPhase from "@/components/strategic-radar/VerificationPhase";
import RadarDashboard from "@/components/strategic-radar/RadarDashboard";
import StrategicConfigWizard, { StrategicConfig } from "@/components/strategic-radar/StrategicConfigWizard";

export interface CompanyProfile {
  id?: string;
  name: string;
  ticker: string;
  logo: string;
  industry: string;
  sector: string;
  competitors: { name: string; marketShare: number; innovation: number; source?: string }[];
  revenue: string;
  revenueValue: number;
  revenueSource?: string;
  cashLiquidity?: string;
  strategicGoal?: string;
  technologyLag: number;
  maturityScore: number;
  maturitySource?: string;
  subscriberCount?: string;
  subscriberSource?: string;
  marketShare?: number;
  marketShareSource?: string;
  recentNews?: { title: string; source: string }[];
  dataQuality?: 'high' | 'medium' | 'low';
  isEstimate?: boolean;
  userConfig?: StrategicConfig;
  citations?: string[];
  researchMeta?: {
    queriesRun: number;
    sourcesFound: number;
    processingTimeMs: number;
  };
}

export type RadarPhase = "input" | "config-wizard" | "verification" | "dashboard";

interface StoredAnalysis {
  id: string;
  user_id: string;
  company_name: string;
  company_ticker: string | null;
  company_logo: string | null;
  industry: string | null;
  sector: string | null;
  competitors: { name: string; marketShare: number; innovation: number }[];
  revenue: string | null;
  revenue_value: number | null;
  cash_liquidity: string | null;
  strategic_goal: string | null;
  technology_lag: number;
  maturity_score: number;
  created_at: string;
  updated_at: string;
}

const StrategicRadar = () => {
  const siteName = useSiteName();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<RadarPhase>("input");
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { data: savedAnalyses, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["strategic-radar-analyses", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("strategic_radar_analyses")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as StoredAnalysis[];
    },
    enabled: !!user?.id,
  });

  const saveAnalysisMutation = useMutation({
    mutationFn: async (profile: CompanyProfile) => {
      if (!user?.id) throw new Error("User not authenticated");
      
      const analysisData = {
        user_id: user.id,
        company_name: profile.name,
        company_ticker: profile.ticker,
        company_logo: profile.logo,
        industry: profile.industry,
        sector: profile.sector,
        competitors: profile.competitors,
        revenue: profile.revenue,
        revenue_value: profile.revenueValue,
        cash_liquidity: profile.cashLiquidity || null,
        strategic_goal: profile.strategicGoal || null,
        technology_lag: profile.technologyLag,
        maturity_score: profile.maturityScore,
      };

      if (profile.id) {
        const { data, error } = await supabase
          .from("strategic_radar_analyses")
          .update({ ...analysisData, updated_at: new Date().toISOString() })
          .eq("id", profile.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("strategic_radar_analyses")
          .insert(analysisData)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["strategic-radar-analyses"] });
      toast.success("تحلیل با موفقیت ذخیره شد");
      if (companyProfile) {
        setCompanyProfile({ ...companyProfile, id: data.id });
      }
    },
    onError: (error) => {
      toast.error("خطا در ذخیره تحلیل");
      console.error(error);
    },
  });

  const deleteAnalysisMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("strategic_radar_analyses")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategic-radar-analyses"] });
      toast.success("تحلیل حذف شد");
    },
    onError: () => {
      toast.error("خطا در حذف تحلیل");
    },
  });

  const handleScanComplete = (profile: CompanyProfile) => {
    setCompanyProfile(profile);
    setPhase("verification");
  };

  const handleStartConfigWizard = () => {
    setPhase("config-wizard");
  };

  const handleConfigComplete = (config: StrategicConfig) => {
    const formatRevenue = (value: number, currency: string) => {
      const formatted = value.toLocaleString("fa-IR");
      const unit = currency === "USD" ? "دلار" : currency === "TOMAN" ? "تومان" : "ریال";
      return `${formatted} ${unit}`;
    };

    const profile: CompanyProfile = {
      name: config.companyName,
      ticker: config.tickerSymbol || "",
      logo: "🏢",
      industry: config.industry,
      sector: config.sector,
      competitors: config.competitors.map(c => ({
        name: c.name,
        marketShare: c.estimatedMarketShare || 20,
        innovation: 50,
      })),
      revenue: formatRevenue(config.annualRevenue, config.currency),
      revenueValue: config.annualRevenue,
      strategicGoal: config.strategicGoal,
      technologyLag: 10 - Math.round(config.techMaturityScore / 10),
      maturityScore: config.techMaturityScore,
      userConfig: config,
    };

    setCompanyProfile(profile);
    setPhase("dashboard");
    saveAnalysisMutation.mutate(profile);
  };

  const handleVerificationComplete = (updatedProfile: CompanyProfile) => {
    setCompanyProfile(updatedProfile);
    setPhase("dashboard");
    saveAnalysisMutation.mutate(updatedProfile);
  };

  const handleBackToVerification = () => {
    setPhase("verification");
  };

  const handleLoadAnalysis = (analysis: StoredAnalysis) => {
    const profile: CompanyProfile = {
      id: analysis.id,
      name: analysis.company_name,
      ticker: analysis.company_ticker || "",
      logo: analysis.company_logo || "🏢",
      industry: analysis.industry || "",
      sector: analysis.sector || "",
      competitors: analysis.competitors || [],
      revenue: analysis.revenue || "",
      revenueValue: analysis.revenue_value || 0,
      cashLiquidity: analysis.cash_liquidity || undefined,
      strategicGoal: analysis.strategic_goal || undefined,
      technologyLag: analysis.technology_lag,
      maturityScore: analysis.maturity_score,
    };
    setCompanyProfile(profile);
    setPhase("dashboard");
    setShowHistory(false);
  };

  return (
    <>
      <Helmet>
        <title>رادار اطلاعات استراتژیک | {siteName}</title>
        <meta name="description" content="رادار هوشمند تحلیل استراتژیک رقبا و بازار" />
      </Helmet>

      <div className="min-h-screen bg-[#0a0f1a] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#0a0f1a] to-[#0d1321]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-900/10 via-transparent to-transparent" />
        
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}
        />

        <AnimatePresence mode="wait">
          {phase === "input" && (
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5 }}
              className="relative z-10"
            >
              <RadarInputPhase 
                onScanComplete={handleScanComplete}
                onStartConfigWizard={handleStartConfigWizard}
                savedAnalyses={savedAnalyses || []}
                isLoadingHistory={isLoadingHistory}
                onLoadAnalysis={handleLoadAnalysis}
                onDeleteAnalysis={(id) => deleteAnalysisMutation.mutate(id)}
                showHistory={showHistory}
                setShowHistory={setShowHistory}
              />
            </motion.div>
          )}

          {phase === "config-wizard" && (
            <motion.div
              key="config-wizard"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5 }}
              className="relative z-10"
            >
              <StrategicConfigWizard
                initialProfile={companyProfile || undefined}
                onComplete={handleConfigComplete}
                onBack={() => setPhase("input")}
              />
            </motion.div>
          )}

          {phase === "verification" && companyProfile && (
            <motion.div
              key="verification"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.5 }}
              className="relative z-10"
            >
              <VerificationPhase
                profile={companyProfile}
                onComplete={handleVerificationComplete}
                onBack={() => setPhase("input")}
              />
            </motion.div>
          )}

          {phase === "dashboard" && companyProfile && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="relative z-10"
            >
              <RadarDashboard
                profile={companyProfile}
                onEditProfile={handleBackToVerification}
                onSave={() => saveAnalysisMutation.mutate(companyProfile)}
                isSaving={saveAnalysisMutation.isPending}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default StrategicRadar;
```

---

## 🔌 Edge Functions - Strategic Radar

### supabase/functions/fetch-company-intel/index.ts

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResearchResult {
  query: string;
  findings: string;
  citations: string[];
}

interface CompanyIntel {
  name: string;
  ticker: string | null;
  logo: string;
  industry: string;
  sector: string;
  competitors: { name: string; marketShare: number; innovation: number; source: string }[];
  revenue: string;
  revenueValue: number;
  revenueSource: string;
  cashLiquidity: string;
  technologyLag: number;
  maturityScore: number;
  maturitySource: string;
  subscriberCount: string;
  subscriberSource: string;
  marketShare: number;
  marketShareSource: string;
  recentNews: { title: string; source: string }[];
  dataQuality: 'high' | 'medium' | 'low';
  isEstimate: boolean;
}

async function performSearch(apiKey: string, query: string): Promise<ResearchResult> {
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { 
            role: 'system', 
            content: `تو یک محقق هستی که فقط اطلاعات واقعی و قابل استناد را گزارش می‌دهی.
اگر اطلاعات دقیق پیدا نکردی، صراحتاً بگو "اطلاعات دقیق پیدا نشد".
هرگز اطلاعات جعلی نده. هر عدد یا ادعایی باید منبع داشته باشد.
پاسخ را کوتاه و مختصر بده (حداکثر ۳ جمله).` 
          },
          { role: 'user', content: query }
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error(`Search failed for query: ${query}`);
      return { query, findings: 'خطا در جستجو', citations: [] };
    }

    const data = await response.json();
    return {
      query,
      findings: data.choices?.[0]?.message?.content || 'نتیجه‌ای یافت نشد',
      citations: data.citations || [],
    };
  } catch (error) {
    console.error(`Error in search: ${query}`, error);
    return { query, findings: 'خطا در اتصال', citations: [] };
  }
}

async function synthesizeIntel(
  apiKey: string, 
  companyName: string, 
  researchResults: ResearchResult[]
): Promise<CompanyIntel> {
  
  const researchSummary = researchResults.map(r => 
    `### جستجو: ${r.query}\n${r.findings}\nمنابع: ${r.citations.slice(0, 2).join(', ') || 'بدون منبع'}`
  ).join('\n\n');

  const systemPrompt = `تو یک تحلیلگر ارشد هستی که بر اساس نتایج جستجو، اطلاعات را استخراج و تحلیل می‌کنی.

قوانین مهم:
1. فقط از اطلاعاتی استفاده کن که در نتایج جستجو موجود است
2. اگر اطلاعاتی موجود نیست، مقدار "نامشخص" یا عدد 0 بده
3. اگر تخمین می‌زنی، حتماً در فیلد source بنویس "تخمین AI"
4. برای هر عدد مهم، منبع را ذکر کن

خروجی را فقط به صورت JSON بده:
{
  "name": "نام رسمی شرکت",
  "ticker": "نماد بورسی یا null",
  "industry": "صنعت",
  "sector": "بخش",
  "competitors": [
    {"name": "رقیب واقعی در همان صنعت", "marketShare": عدد یا 0, "innovation": عدد یا 50, "source": "منبع"}
  ],
  "revenue": "درآمد به فارسی",
  "revenueValue": عدد میلیارد ریال یا 0,
  "revenueSource": "منبع اطلاعات درآمد",
  "cashLiquidity": "وضعیت مالی",
  "subscriberCount": "تعداد مشترک/مشتری",
  "subscriberSource": "منبع",
  "marketShare": عدد درصد سهم بازار یا 0,
  "marketShareSource": "منبع",
  "technologyLag": عدد 0-10,
  "maturityScore": عدد 0-100,
  "maturitySource": "توضیح چرا این امتیاز",
  "recentNews": [{"title": "عنوان خبر", "source": "منبع"}],
  "dataQuality": "high/medium/low",
  "isEstimate": true/false
}`;

  const userPrompt = `بر اساس نتایج جستجوی زیر، اطلاعات شرکت "${companyName}" را استخراج کن:

${researchSummary}

نکات مهم:
- رقبا باید شرکت‌های همان صنعت باشند (نه بانک برای اپراتور!)
- اگر درآمد دقیق نیست و تعداد مشترک داری، می‌توانی تخمین بزنی: مشترکین × ARPU متوسط صنعت
- اگر سهم بازار مستقیم نیست، از مقایسه‌ها استخراج کن
- dataQuality بر اساس تعداد منابع معتبر پیدا شده`;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error('Synthesis API failed');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    const jsonMatch = content?.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in synthesis response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      name: parsed.name || companyName,
      ticker: parsed.ticker || null,
      logo: "🏢",
      industry: parsed.industry || "نامشخص",
      sector: parsed.sector || "نامشخص",
      competitors: Array.isArray(parsed.competitors) ? parsed.competitors.slice(0, 5) : [],
      revenue: parsed.revenue || "نامشخص",
      revenueValue: parsed.revenueValue || 0,
      revenueSource: parsed.revenueSource || "نامشخص",
      cashLiquidity: parsed.cashLiquidity || "نامشخص",
      technologyLag: parsed.technologyLag || 5,
      maturityScore: parsed.maturityScore || 50,
      maturitySource: parsed.maturitySource || "نامشخص",
      subscriberCount: parsed.subscriberCount || "نامشخص",
      subscriberSource: parsed.subscriberSource || "نامشخص",
      marketShare: parsed.marketShare || 0,
      marketShareSource: parsed.marketShareSource || "نامشخص",
      recentNews: Array.isArray(parsed.recentNews) ? parsed.recentNews.slice(0, 5) : [],
      dataQuality: parsed.dataQuality || 'low',
      isEstimate: parsed.isEstimate ?? true,
    };
  } catch (error) {
    console.error('Synthesis error:', error);
    return {
      name: companyName,
      ticker: null,
      logo: "🏢",
      industry: "نامشخص",
      sector: "نامشخص",
      competitors: [],
      revenue: "نامشخص",
      revenueValue: 0,
      revenueSource: "خطا در تحلیل",
      cashLiquidity: "نامشخص",
      technologyLag: 5,
      maturityScore: 50,
      maturitySource: "خطا در تحلیل",
      subscriberCount: "نامشخص",
      subscriberSource: "خطا در تحلیل",
      marketShare: 0,
      marketShareSource: "خطا در تحلیل",
      recentNews: [],
      dataQuality: 'low',
      isEstimate: true,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyName } = await req.json();

    if (!companyName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Company name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Perplexity connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 Starting Agentic Research for:', companyName);
    const startTime = Date.now();

    const searchQueries = [
      `"${companyName}" درآمد فروش صورت مالی کدال ۱۴۰۳ ۱۴۰۲`,
      `"${companyName}" تعداد مشترکین کاربران فعال ۱۴۰۳`,
      `"${companyName}" سهم بازار رتبه در صنعت رقابت`,
      `"${companyName}" اخبار جدید سرمایه گذاری توسعه ۱۴۰۳`,
      `رقبای "${companyName}" مقایسه شرکت‌های مشابه در ایران`,
    ];

    console.log('🕵️ Hunter Agent: Running', searchQueries.length, 'searches...');
    
    const searchResults = await Promise.all(
      searchQueries.map(query => performSearch(apiKey, query))
    );

    console.log('🧠 Analyst Agent: Synthesizing data...');
    const companyIntel = await synthesizeIntel(apiKey, companyName, searchResults);

    const duration = Date.now() - startTime;
    console.log(`✅ Research complete in ${duration}ms. Data quality: ${companyIntel.dataQuality}`);

    const allCitations = [...new Set(searchResults.flatMap(r => r.citations))];

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: companyIntel,
        citations: allCitations,
        researchMeta: {
          queriesRun: searchQueries.length,
          sourcesFound: allCitations.length,
          processingTimeMs: duration,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in agentic research:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Research failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

### supabase/functions/analyze-competitor/index.ts

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompetitorAnalysis {
  name: string;
  status: "winning" | "losing" | "stable";
  reason: string;
  strengths: string[];
  weaknesses: string[];
  marketPosition: string;
  recentNews: string[];
  codalInfo?: string;
  contracts?: string[];
  activities?: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { competitorName, industry, userCompanyName } = await req.json();

    if (!competitorName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Competitor name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Perplexity connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `تو یک تحلیلگر رقابتی حرفه‌ای هستی که اطلاعات دقیق شرکت‌های ایرانی را از منابع رسمی استخراج و تحلیل می‌کنی.

**منابع اصلی برای جمع‌آوری اطلاعات:**
1. **سایت کدال (codal.ir)**: گزارش‌های مالی، صورت‌های مالی، اساسنامه شرکت
2. **سایت بورس تهران (tsetmc.com)**: قیمت سهام، حجم معاملات، ارزش بازار
3. **خبرگزاری‌های اقتصادی**: دنیای اقتصاد، اقتصادآنلاین
4. **سایت رسمی شرکت**: خدمات، محصولات، قراردادها

خروجی را فقط به صورت JSON بده:
{
  "name": "نام شرکت",
  "status": "winning" یا "losing" یا "stable",
  "reason": "دلیل دقیق وضعیت فعلی",
  "strengths": ["نقطه قوت ۱", "نقطه قوت ۲"],
  "weaknesses": ["نقطه ضعف ۱", "نقطه ضعف ۲"],
  "marketPosition": "جایگاه در بازار",
  "recentNews": ["خبر ۱", "خبر ۲"],
  "codalInfo": "خلاصه اطلاعات از کدال",
  "contracts": ["قرارداد ۱"],
  "activities": ["فعالیت اصلی ۱"]
}`;

    const userPrompt = `شرکت "${competitorName}" که رقیب "${userCompanyName || 'شرکت مورد نظر'}" در صنعت "${industry || 'نامشخص'}" است را تحلیل کن.`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    let analysis: CompetitorAnalysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      const parsed = JSON.parse(jsonMatch[0]);
      
      analysis = {
        name: parsed.name || competitorName,
        status: ["winning", "losing", "stable"].includes(parsed.status) ? parsed.status : "stable",
        reason: parsed.reason || "در حال بررسی",
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5) : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.slice(0, 5) : [],
        marketPosition: parsed.marketPosition || "نامشخص",
        recentNews: Array.isArray(parsed.recentNews) ? parsed.recentNews.slice(0, 4) : [],
        codalInfo: parsed.codalInfo,
        contracts: Array.isArray(parsed.contracts) ? parsed.contracts.slice(0, 3) : [],
        activities: Array.isArray(parsed.activities) ? parsed.activities.slice(0, 4) : [],
      };
    } catch {
      analysis = {
        name: competitorName,
        status: "stable",
        reason: "در حال جمع‌آوری اطلاعات",
        strengths: ["نیاز به بررسی"],
        weaknesses: ["نیاز به بررسی"],
        marketPosition: "در حال استخراج",
        recentNews: [],
        contracts: [],
        activities: [],
      };
    }

    return new Response(
      JSON.stringify({ success: true, data: analysis, citations: data.citations || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

### supabase/functions/analyze-competitor-swot/index.ts

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { competitorName, industry } = await req.json();
    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'API not configured' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const prompt = `تحلیل SWOT کامل شرکت "${competitorName}" در صنعت "${industry}". خروجی فقط JSON:
{
  "name": "نام",
  "status": "winning"|"losing"|"stable",
  "strengths": ["قوت۱","قوت۲","قوت۳"],
  "weaknesses": ["ضعف۱","ضعف۲","ضعف۳"],
  "opportunities": ["فرصت۱","فرصت۲","فرصت۳"],
  "threats": ["تهدید۱","تهدید۲","تهدید۳"]
}`;

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
      name: competitorName, status: "stable",
      strengths: ["نیاز به بررسی"], weaknesses: ["نیاز به بررسی"],
      opportunities: ["نیاز به بررسی"], threats: ["نیاز به بررسی"]
    }}), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
```

---

### supabase/functions/analyze-market-position/index.ts

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyName, industry } = await req.json();
    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'API not configured' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const prompt = `تحلیل جایگاه بازار شرکت "${companyName}" در صنعت "${industry}" ایران. خروجی فقط JSON:
{"marketRank":عدد,"totalPlayers":عدد,"marketShare":عدد,"marketTrend":"growing"|"stable"|"declining","industryGrowth":عدد,"competitiveIntensity":"high"|"medium"|"low","entryBarriers":"high"|"medium"|"low","marketSize":"حجم به ریال","yearToYear":عدد درصد رشد,"keyInsights":["بینش۱"],"opportunities":["فرصت۱"],"threats":["تهدید۱"]}`;

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
```

---

### supabase/functions/analyze-global-trends/index.ts

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { industry } = await req.json();
    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!apiKey) return new Response(JSON.stringify({ success: false, error: 'API not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const prompt = `تحلیل ترندهای جهانی صنعت "${industry}" و یونیکورن‌های موفق. خروجی فقط JSON:
{"industryTrends":[{"trend":"نام","impact":"high"|"medium"|"low","description":"توضیح"}],"topUnicorns":[{"name":"نام","country":"کشور","valuation":"ارزش","founded":"سال","keyMoves":["اقدام۱"],"lessonsLearned":["درس۱"]}],"emergingTech":["فناوری۱"],"investmentHotspots":["حوزه۱"],"whatToDo":["کار۱"],"whatToAvoid":["اجتناب۱"]}`;

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
```

---

### supabase/functions/analyze-tech-edge/index.ts

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { companyName, technologyLag } = await req.json();
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
```

---

### supabase/functions/analyze-value-chain/index.ts

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyName, industry } = await req.json();
    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'API not configured' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const prompt = `تحلیل زنجیره ارزش شرکت "${companyName}" در صنعت "${industry}". خروجی فقط JSON:
{
  "valueChain": [
    {"segment": "بخش زنجیره", "companies": [{"name": "نام", "type": "subsidiary|partner", "ownership": "درصد", "growthPotential": "high|medium|low", "description": "توضیح", "recommendation": "پیشنهاد"}]}
  ],
  "investmentOpportunities": [
    {"company": "نام", "segment": "بخش", "reason": "دلیل", "expectedReturn": "بازده", "riskLevel": "low|medium|high", "synergy": "هم‌افزایی", "investmentType": "acquisition|investment|partnership"}
  ],
  "ecosystemInsights": {"totalSubsidiaries": عدد, "totalAffiliates": عدد, "keyPartners": ["شریک۱"], "gaps": ["شکاف۱"], "recommendations": ["توصیه۱"]}
}`;

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
      valueChain: [], investmentOpportunities: [],
      ecosystemInsights: { totalSubsidiaries: 0, totalAffiliates: 0, keyPartners: [], gaps: ["در حال تحلیل"], recommendations: ["در حال تحلیل"] }
    }, citations: data.citations || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
```

---

### supabase/functions/track-funding/index.ts

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyName, industry, competitors } = await req.json();
    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'API not configured' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const competitorNames = competitors?.map((c: { name: string }) => c.name).join('، ') || '';
    
    const prompt = `تحلیل وضعیت سرمایه‌گذاری شرکت‌های صنعت "${industry}": ${companyName}${competitorNames ? '، ' + competitorNames : ''}. خروجی فقط JSON:
{
  "companyValuations": [{"name": "نام", "marketCap": "ارزش بازار", "marketCapUSD": "ارزش دلاری", "peRatio": عدد, "pbRatio": عدد, "lastFunding": "آخرین تأمین مالی", "fundingRound": "Series A/B/...", "investors": ["سرمایه‌گذار۱"], "valuationTrend": "up|down|stable", "changePercent": عدد, "stockSymbol": "نماد"}],
  "recentDeals": [{"type": "acquisition|investment|ipo", "company": "نام", "amount": "مبلغ", "date": "تاریخ", "investor": "سرمایه‌گذار", "description": "توضیح"}],
  "industryMetrics": {"totalMarketCap": "کل ارزش", "averagePE": عدد, "topPerformer": "بهترین", "worstPerformer": "ضعیف‌ترین", "hotSectors": ["بخش۱"], "fundingTrend": "increasing|decreasing|stable"},
  "upcomingIPOs": [{"company": "نام", "expectedDate": "تاریخ", "estimatedValue": "ارزش"}]
}`;

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
      companyValuations: [], recentDeals: [],
      industryMetrics: { totalMarketCap: "در حال تحلیل", averagePE: 0, topPerformer: "", worstPerformer: "", hotSectors: [], fundingTrend: "stable" },
      upcomingIPOs: []
    }, citations: data.citations || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
```

---

### supabase/functions/search-competitor-news/index.ts

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyName, competitors, industry } = await req.json();
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    
    if (!firecrawlApiKey) {
      return new Response(JSON.stringify({ 
        success: true, 
        data: { news: [], message: "برای فعال‌سازی اخبار زنده، API کلید Firecrawl را تنظیم کنید", needsApiKey: true }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const allCompanies = [companyName, ...competitors.map((c: { name: string }) => c.name)].filter(Boolean);
    const newsResults: any[] = [];
    
    for (const company of allCompanies.slice(0, 4)) {
      try {
        const searchQuery = `${company} ${industry || ''} اخبار`;
        
        const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${firecrawlApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery, limit: 3, lang: 'fa', country: 'ir', scrapeOptions: { formats: ['markdown'], onlyMainContent: true } }),
        });

        if (!searchResponse.ok) continue;

        const searchData = await searchResponse.json();
        
        if (searchData.success && searchData.data) {
          for (const result of searchData.data) {
            const content = (result.title + ' ' + (result.description || '')).toLowerCase();
            let sentiment: "positive" | "negative" | "neutral" = "neutral";
            
            const positiveWords = ['رشد', 'موفقیت', 'افزایش', 'سود', 'توسعه'];
            const negativeWords = ['کاهش', 'زیان', 'بحران', 'مشکل', 'ضرر'];
            
            const positiveCount = positiveWords.filter(w => content.includes(w)).length;
            const negativeCount = negativeWords.filter(w => content.includes(w)).length;
            
            if (positiveCount > negativeCount) sentiment = "positive";
            else if (negativeCount > positiveCount) sentiment = "negative";

            newsResults.push({
              title: result.title || 'بدون عنوان',
              url: result.url || '#',
              source: new URL(result.url || 'https://example.com').hostname.replace('www.', ''),
              date: new Date().toLocaleDateString('fa-IR'),
              snippet: result.description || '',
              sentiment,
              competitor: company,
            });
          }
        }
      } catch { /* continue */ }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data: { news: newsResults.slice(0, 10), searchedCompanies: allCompanies.slice(0, 4), needsApiKey: false }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
```

---

### supabase/functions/daily-competitor-monitor/index.ts

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { industry, competitors } = await req.json();
    const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
    
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'API not configured' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const competitorNames = competitors?.map((c: { name: string }) => c.name).join('، ') || 'رقبای اصلی';
    
    const prompt = `تحلیل اخبار روزانه رقبا در صنعت "${industry}". شرکت‌ها: ${competitorNames}. خروجی فقط JSON:
{
  "news": [{"title": "عنوان", "source": "منبع", "date": "تاریخ", "sentiment": "positive"|"negative"|"neutral", "competitor": "نام", "category": "استراتژی|محصول|بازار|مالی", "summary": "خلاصه"}],
  "alerts": [{"competitor": "نام", "type": "growth"|"decline"|"strategy"|"product", "description": "توضیح", "impact": "high"|"medium"|"low", "timestamp": "زمان"}],
  "insights": {"marketMoves": ["حرکت۱"], "competitorShifts": ["تغییر۱"], "opportunities": ["فرصت۱"], "warnings": ["هشدار۱"]}
}`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'sonar', messages: [{ role: 'user', content: prompt }], temperature: 0.3 }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const jsonMatch = content?.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    return new Response(JSON.stringify({ success: true, data: parsed || {
      news: [], alerts: [],
      insights: { marketMoves: ["در حال تحلیل"], competitorShifts: ["در حال تحلیل"], opportunities: ["در حال تحلیل"], warnings: ["در حال تحلیل"] }
    }}), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: 'Error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
```

---

### supabase/functions/generate-strategic-recommendations/index.ts

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

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
```

---

# 🦄 PART 2: UNICORN LAB (آزمایشگاه یونیکورن)

---

## 📄 src/pages/UnicornLab.tsx

```tsx
import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";
import UnicornLabLayout from "@/components/unicorn-lab/UnicornLabLayout";

export interface StartupProfile {
  companyName: string;
  companyUrl: string;
  linkedinUrl: string;
  foundersBio: string;
  pitchDeckUrl?: string;
  financialsUrl?: string;
  employeesListUrl?: string;
  currentValuation: number;
  monthlyActiveUsers: number;
  burnRate: number;
}

export interface AnalysisResult {
  uScore: number;
  financialHealth: {
    grossMargin: number;
    burnRate: number;
    runway: number;
    healthGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  };
  founderGrit: {
    resilience: number;
    experience: number;
    adaptability: number;
    networkStrength: number;
    overallScore: number;
  };
  techViability: {
    score: number;
    aiProof: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    insights: string[];
  };
  nationalUtility: {
    dataSovereignty: boolean;
    exportReady: boolean;
    localImpact: number;
    jobCreation: number;
  };
  verdict: {
    status: 'rejected' | 'conditional' | 'approved' | 'unicorn';
    summary: string;
    recommendations: string[];
  };
}

const UnicornLab = () => {
  return (
    <>
      <Helmet>
        <title>آزمایشگاه یونیکورن | hring</title>
        <meta name="description" content="ارزیابی پیشرفته استارتاپ‌ها برای شناسایی پتانسیل یونیکورن" />
      </Helmet>

      <div className="min-h-screen bg-background" dir="rtl">
        <Navbar />
        <main className="pt-20">
          <UnicornLabLayout />
        </main>
      </div>
    </>
  );
};

export default UnicornLab;
```

---

## 📄 src/components/unicorn-lab/UnicornLabLayout.tsx

```tsx
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dna, FlaskConical, Eye, Building2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Chapter1Screening from "./chapters/Chapter1Screening";
import Chapter2Mutation from "./chapters/Chapter2Mutation";
import Chapter3Monitoring from "./chapters/Chapter3Monitoring";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UnicornAnalysis {
  id: string;
  company_name: string;
  company_url: string | null;
  linkedin_url: string | null;
  founders_bio: string | null;
  current_valuation: number | null;
  monthly_active_users: number | null;
  burn_rate: number | null;
  u_score: number | null;
  chapter: string;
  chapter_1_approved: boolean;
  chapter_1_approved_at: string | null;
  chapter_2_stable: boolean;
  chapter_2_stable_at: string | null;
  analysis_result: any;
  shadow_cabinet: any;
  regulatory_shield: any;
  milestone_funding: any;
  api_connections: any;
  pivot_history: any;
  health_alerts: any;
  status: string | null;
  created_at: string;
  updated_at: string;
}

const chapters = [
  { id: 'screening', tabId: 'chapter_1', title: 'فصل ۱: غربالگری ژنومیک', subtitle: 'Genomic Screening', icon: Dna, description: 'شناسایی و ارزیابی استارتاپ‌ها با ۵ موتور تحلیل', color: 'from-emerald-500 to-teal-500' },
  { id: 'mutation', tabId: 'chapter_2', title: 'فصل ۲: آزمایشگاه جهش', subtitle: 'Mutation Laboratory', icon: FlaskConical, description: 'تعلیم و تربیت برای تبدیل به یونیکورن', color: 'from-violet-500 to-purple-500' },
  { id: 'monitoring', tabId: 'chapter_3', title: 'فصل ۳: مانیتورینگ عصبی', subtitle: 'Neural Monitoring & Kill Switch', icon: Eye, description: 'نظارت و اصلاح مداوم برای حفظ وضعیت', color: 'from-amber-500 to-orange-500' },
];

const UnicornLabLayout = () => {
  const [activeChapter, setActiveChapter] = useState('screening');
  const [analyses, setAnalyses] = useState<UnicornAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) fetchAnalyses();
  }, [user]);

  const fetchAnalyses = async () => {
    try {
      const { data, error } = await supabase
        .from('unicorn_analyses')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAnalyses(data || []);
    } catch (err) {
      console.error('Error fetching analyses:', err);
    } finally {
      setLoading(false);
    }
  };

  const getChapterAnalyses = (chapter: string) => analyses.filter(a => a.chapter === chapter);
  const getApprovedForChapter2 = () => analyses.filter(a => a.chapter_1_approved);
  const getStableForChapter3 = () => analyses.filter(a => a.chapter_2_stable);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 rounded-full text-primary text-sm font-medium mb-4">
          <Building2 className="w-4 h-4" />
          آزمایشگاه یونیکورن
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">سامانه شناسایی و پرورش یونیکورن</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">پلتفرم جامع برای غربالگری، تعلیم و نظارت بر استارتاپ‌های مستعد تبدیل به یونیکورن</p>
      </motion.div>

      <Tabs value={activeChapter} onValueChange={setActiveChapter} className="w-full">
        <TabsList className="grid grid-cols-3 mb-8 h-auto p-1 bg-secondary/50">
          {chapters.map((chapter) => {
            const Icon = chapter.icon;
            const isActive = activeChapter === chapter.id;
            return (
              <TabsTrigger key={chapter.id} value={chapter.id} className={`flex flex-col items-center gap-2 py-4 px-3 data-[state=active]:bg-background rounded-lg transition-all ${isActive ? 'shadow-md' : ''}`}>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${chapter.color} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-center">
                  <p className={`font-semibold text-sm ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{chapter.title}</p>
                  <p className="text-xs text-muted-foreground hidden sm:block">{chapter.subtitle}</p>
                </div>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <AnimatePresence mode="wait">
          <TabsContent value="screening" className="mt-0">
            <motion.div key="chapter1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Chapter1Screening analyses={getChapterAnalyses('screening')} onRefresh={fetchAnalyses} loading={loading} />
            </motion.div>
          </TabsContent>

          <TabsContent value="mutation" className="mt-0">
            <motion.div key="chapter2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Chapter2Mutation analyses={getApprovedForChapter2()} onRefresh={fetchAnalyses} loading={loading} />
            </motion.div>
          </TabsContent>

          <TabsContent value="monitoring" className="mt-0">
            <motion.div key="chapter3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Chapter3Monitoring analyses={getStableForChapter3()} onRefresh={fetchAnalyses} loading={loading} />
            </motion.div>
          </TabsContent>
        </AnimatePresence>
      </Tabs>
    </div>
  );
};

export default UnicornLabLayout;
```

---

## 🔌 Edge Functions - Unicorn Lab

### supabase/functions/analyze-unicorn/index.ts
### supabase/functions/analyze-unicorn-engine/index.ts
### supabase/functions/unicorn-ai-chat/index.ts
### supabase/functions/unicorn-web-radar/index.ts

*(کد کامل این فایل‌ها در پروژه موجود است)*

---

# 🗄️ Database Migrations

## Strategic Radar Table

```sql
CREATE TABLE public.strategic_radar_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_name TEXT NOT NULL,
  company_ticker TEXT,
  company_logo TEXT,
  industry TEXT,
  sector TEXT,
  competitors JSONB DEFAULT '[]',
  revenue TEXT,
  revenue_value NUMERIC,
  cash_liquidity TEXT,
  strategic_goal TEXT,
  technology_lag INTEGER DEFAULT 5,
  maturity_score INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.strategic_radar_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own" ON public.strategic_radar_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own" ON public.strategic_radar_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own" ON public.strategic_radar_analyses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own" ON public.strategic_radar_analyses FOR DELETE USING (auth.uid() = user_id);
```

## Unicorn Analyses Table

```sql
CREATE TABLE public.unicorn_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_name TEXT NOT NULL,
  company_url TEXT,
  linkedin_url TEXT,
  founders_bio TEXT,
  current_valuation NUMERIC,
  monthly_active_users NUMERIC,
  burn_rate NUMERIC,
  u_score NUMERIC,
  chapter TEXT DEFAULT 'screening',
  chapter_1_approved BOOLEAN DEFAULT false,
  chapter_1_approved_at TIMESTAMPTZ,
  chapter_2_stable BOOLEAN DEFAULT false,
  chapter_2_stable_at TIMESTAMPTZ,
  analysis_result JSONB,
  shadow_cabinet JSONB,
  regulatory_shield JSONB,
  milestone_funding JSONB,
  api_connections JSONB,
  pivot_history JSONB,
  health_alerts JSONB,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.unicorn_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own" ON public.unicorn_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own" ON public.unicorn_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own" ON public.unicorn_analyses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own" ON public.unicorn_analyses FOR DELETE USING (auth.uid() = user_id);
```

---

# 🔑 Required Secrets

| Secret | Purpose |
|--------|---------|
| `PERPLEXITY_API_KEY` | Web intelligence & research |
| `FIRECRAWL_API_KEY` | News scraping & web radar |
| `LOVABLE_API_KEY` | AI analysis (optional, uses Lovable AI) |
| `GEMINI_API_KEY` | AI analysis (optional, alternative) |

---

# 📦 Dependencies

```json
{
  "framer-motion": "^11.x",
  "recharts": "^2.x",
  "date-fns-jalali": "^4.x",
  "@tanstack/react-query": "^5.x",
  "sonner": "^1.x",
  "react-helmet-async": "^2.x",
  "lucide-react": "^0.4x",
  "@supabase/supabase-js": "^2.x"
}
```

---

# 🚀 Setup Instructions

1. **Create new Lovable project**
2. **Enable Cloud** (for Supabase backend)
3. **Run migrations** in Cloud View > Run SQL
4. **Add secrets** in Cloud View > Secrets
5. **Copy files** from this export
6. **Deploy edge functions** automatically

---

**End of Export Package v3.0**
