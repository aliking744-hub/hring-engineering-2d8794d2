# 🎯 Strategic Radar - Complete Export Package v2.0

> **برای ایجاد پروژه مستقل رادار اطلاعات استراتژیک**

---

## 📁 ساختار کلی

```
src/
├── pages/
│   └── StrategicRadar.tsx           # Entry point
├── components/strategic-radar/
│   ├── RadarDashboard.tsx           # Main dashboard
│   ├── RadarInputPhase.tsx          # Search input
│   ├── VerificationPhase.tsx        # Data verification
│   ├── StrategicConfigWizard.tsx    # Manual config wizard
│   └── sections/                     # 16 dashboard sections
│       ├── CompetitorAnatomy.tsx
│       ├── CompetitorComparison.tsx
│       ├── DailyMonitor.tsx
│       ├── DataSources.tsx
│       ├── FundingTracker.tsx
│       ├── GapFitAnalysis.tsx
│       ├── GlobalBenchmarkEngine.tsx
│       ├── GlobalTrends.tsx
│       ├── MarketAlerts.tsx
│       ├── MarketPosition.tsx
│       ├── OverallScore.tsx
│       ├── StrategicRecommendations.tsx
│       ├── StrategyPrescription.tsx
│       ├── TechStackComparison.tsx
│       ├── TechnologyEdge.tsx
│       └── ValueChainMap.tsx

supabase/functions/
├── fetch-company-intel/
├── analyze-competitor/
├── analyze-competitor-swot/
├── analyze-market-position/
├── analyze-global-trends/
├── analyze-tech-edge/
├── analyze-value-chain/
├── track-funding/
├── search-competitor-news/
├── daily-competitor-monitor/
└── generate-strategic-recommendations/
```

---

## 🔑 Secrets مورد نیاز

| Secret | توضیح |
|--------|-------|
| `PERPLEXITY_API_KEY` | جستجوی هوشمند وب |
| `FIRECRAWL_API_KEY` | Scraping اخبار |

---

## 📦 Dependencies

```
framer-motion
recharts
date-fns-jalali
@tanstack/react-query
sonner
react-helmet-async
lucide-react
```

---

## 🗄️ Database Migration

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

CREATE POLICY "Users can view own" ON public.strategic_radar_analyses 
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own" ON public.strategic_radar_analyses 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own" ON public.strategic_radar_analyses 
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own" ON public.strategic_radar_analyses 
FOR DELETE USING (auth.uid() = user_id);
```

---

## 🎨 CompanyProfile Interface

```typescript
export interface CompanyProfile {
  id?: string;
  name: string;
  ticker: string;
  logo: string;
  industry: string;
  sector: string;
  competitors: Array<{
    name: string;
    marketShare: number;
    innovation: number;
    source?: string;
  }>;
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
  citations?: string[];
  researchMeta?: {
    queriesRun: number;
    sourcesFound: number;
    processingTimeMs: number;
  };
}
```

---

## 📋 لیست فایل‌ها و حجم

| فایل | خطوط | وضعیت |
|------|------|-------|
| StrategicRadar.tsx (page) | 454 | ✅ بالا موجوده |
| RadarDashboard.tsx | 254 | در پروژه |
| RadarInputPhase.tsx | 423 | در پروژه |
| VerificationPhase.tsx | 383 | در پروژه |
| StrategicConfigWizard.tsx | 710 | در پروژه |
| sections/CompetitorAnatomy.tsx | 360 | در پروژه |
| sections/CompetitorComparison.tsx | 383 | در پروژه |
| sections/DailyMonitor.tsx | 400 | در پروژه |
| sections/DataSources.tsx | 128 | در پروژه |
| sections/FundingTracker.tsx | 783 | در پروژه |
| sections/GapFitAnalysis.tsx | 190 | در پروژه |
| sections/GlobalBenchmarkEngine.tsx | 176 | در پروژه |
| sections/GlobalTrends.tsx | 292 | در پروژه |
| sections/MarketAlerts.tsx | 411 | در پروژه |
| sections/MarketPosition.tsx | 431 | در پروژه |
| sections/OverallScore.tsx | 127 | در پروژه |
| sections/StrategicRecommendations.tsx | 299 | در پروژه |
| sections/StrategyPrescription.tsx | 289 | در پروژه |
| sections/TechStackComparison.tsx | 416 | در پروژه |
| sections/TechnologyEdge.tsx | 260 | در پروژه |
| sections/ValueChainMap.tsx | 452 | در پروژه |

**مجموع:** ~6,600+ خط کد

---

## 🚀 دستورالعمل ایجاد پروژه جدید

### مرحله 1: ایجاد پروژه
- به Lovable برو و پروژه جدید بساز
- Cloud رو فعال کن

### مرحله 2: Migration
- از منوی Cloud وارد Database شو
- Migration SQL بالا رو اجرا کن

### مرحله 3: Secrets
- `PERPLEXITY_API_KEY` اضافه کن
- `FIRECRAWL_API_KEY` اضافه کن

### مرحله 4: کپی فایل‌ها
- از من بخواه هر فایل رو جداگانه بفرستم
- یا از پروژه فعلی fork بگیر

---

## ❓ برای دریافت کد کامل

بگو:
- **"کد StrategicRadar.tsx رو بده"**
- **"کد FundingTracker.tsx رو بفرست"**
- **"همه Edge Functions رو بده"**

و من کد کامل رو برات می‌فرستم! 🎯
