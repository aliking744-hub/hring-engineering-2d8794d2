# 🎯 Strategic Radar - Export Package

## 📋 Overview
This document contains all the code files needed to recreate the Strategic Intelligence Radar as a standalone Lovable project.

---

## 🗄️ Database Migration

Run this SQL in your new Lovable Cloud:

```sql
-- Create strategic_radar_analyses table
CREATE TABLE public.strategic_radar_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_name TEXT NOT NULL,
  company_ticker TEXT,
  company_logo TEXT,
  industry TEXT,
  sector TEXT,
  competitors JSONB,
  revenue TEXT,
  revenue_value NUMERIC,
  cash_liquidity TEXT,
  strategic_goal TEXT,
  technology_lag INTEGER DEFAULT 5,
  maturity_score INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.strategic_radar_analyses ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own analyses"
ON public.strategic_radar_analyses FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own analyses"
ON public.strategic_radar_analyses FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses"
ON public.strategic_radar_analyses FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own analyses"
ON public.strategic_radar_analyses FOR DELETE
USING (auth.uid() = user_id);
```

---

## 🔑 Required Secrets

Add these secrets in your Lovable Cloud:

1. **PERPLEXITY_API_KEY** - For intelligent web research
2. **FIRECRAWL_API_KEY** - For web scraping (optional)

---

## 📦 Required Dependencies

```
framer-motion
date-fns-jalali
recharts
@tanstack/react-query
sonner
react-helmet-async
```

---

## 📁 File Structure

```
src/
├── pages/
│   └── StrategicRadar.tsx
├── components/
│   └── strategic-radar/
│       ├── RadarDashboard.tsx
│       ├── RadarInputPhase.tsx
│       ├── StrategicConfigWizard.tsx
│       ├── VerificationPhase.tsx
│       └── sections/
│           ├── CompetitorAnatomy.tsx
│           ├── CompetitorComparison.tsx
│           ├── DailyMonitor.tsx
│           ├── DataSources.tsx
│           ├── FundingTracker.tsx
│           ├── GlobalTrends.tsx
│           ├── MarketAlerts.tsx
│           ├── MarketPosition.tsx
│           ├── OverallScore.tsx
│           ├── StrategicRecommendations.tsx
│           ├── TechStackComparison.tsx
│           ├── TechnologyEdge.tsx
│           └── ValueChainMap.tsx
supabase/
└── functions/
    ├── fetch-company-intel/index.ts
    ├── analyze-competitor/index.ts
    ├── analyze-competitor-swot/index.ts
    ├── analyze-global-trends/index.ts
    ├── analyze-market-position/index.ts
    ├── analyze-tech-edge/index.ts
    ├── analyze-value-chain/index.ts
    ├── daily-competitor-monitor/index.ts
    ├── search-competitor-news/index.ts
    ├── track-funding/index.ts
    └── generate-strategic-recommendations/index.ts
```

---

## 📄 Complete Source Files

### Main Page: src/pages/StrategicRadar.tsx

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

## 📄 Edge Functions

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

خروجی را فقط به صورت JSON بده.`;

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
          { role: 'user', content: `تحلیل "${companyName}":\n${researchSummary}` }
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const jsonMatch = content?.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) throw new Error('No JSON found');
    
    return JSON.parse(jsonMatch[0]);
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
      revenueSource: "خطا",
      cashLiquidity: "نامشخص",
      technologyLag: 5,
      maturityScore: 50,
      maturitySource: "خطا",
      subscriberCount: "نامشخص",
      subscriberSource: "خطا",
      marketShare: 0,
      marketShareSource: "خطا",
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
        JSON.stringify({ success: false, error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const startTime = Date.now();

    const searchQueries = [
      `"${companyName}" درآمد فروش صورت مالی کدال`,
      `"${companyName}" تعداد مشترکین کاربران`,
      `"${companyName}" سهم بازار رقابت`,
      `"${companyName}" اخبار جدید`,
      `رقبای "${companyName}" شرکت‌های مشابه`,
    ];

    const searchResults = await Promise.all(
      searchQueries.map(query => performSearch(apiKey, query))
    );

    const companyIntel = await synthesizeIntel(apiKey, companyName, searchResults);
    const duration = Date.now() - startTime;
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
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## 📝 Notes

1. **useSiteName Hook**: Create a simple hook or replace with your site name
2. **useAuth Hook**: Use your authentication system
3. **Supabase Client**: Import from `@/integrations/supabase/client`
4. **Connectors**: Enable Perplexity connector in Lovable settings

---

## 🚀 Quick Start

1. Create new Lovable project
2. Run the database migration
3. Enable Perplexity connector
4. Copy all component files
5. Copy edge functions
6. Add route to App.tsx

---

**Created for**: Strategic Radar Standalone Project
**Version**: 1.0
**Date**: 2026-02-07
