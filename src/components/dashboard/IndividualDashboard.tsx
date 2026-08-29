import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Briefcase, Users, Megaphone,
  FileDown, Gem, Radar, BookOpen
} from 'lucide-react';
import logo from '@/assets/logo.png';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUserContext } from '@/hooks/useUserContext';
import { useCredits } from '@/hooks/useCredits';
import { useCampaigns } from '@/hooks/useCampaigns';
import { TIER_NAMES } from '@/types/multiTenant';
import LegalAdvisorWidget from '@/components/LegalAdvisorWidget';

const PRINT_STYLES = `
  @media print {
    @page { size: A4 portrait; margin: 14mm 12mm; }
    body * { visibility: hidden !important; }
    #dashboard-print-area,
    #dashboard-print-area * { visibility: visible !important; }
    #dashboard-print-area {
      position: fixed !important;
      inset: 0 !important;
      width: 100% !important;
      background: white !important;
      color: #111 !important;
      direction: rtl;
      font-family: 'BNAZANIN', Tahoma, Arial, sans-serif !important;
    }
    .no-print { display: none !important; }
  }
`;

const IndividualDashboard = () => {
  const navigate = useNavigate();
  const { context } = useUserContext();
  const { credits, loading: creditsLoading } = useCredits();
  const { campaigns, loading: campaignsLoading } = useCampaigns();

  const totalCandidates = campaigns.reduce((sum, campaign) => sum + (campaign.candidatesCount || 0), 0);
  const weightedMatchTotal = campaigns.reduce(
    (sum, campaign) => sum + (campaign.avgMatchScore || 0) * (campaign.candidatesCount || 0),
    0,
  );
  const hiringHealth = totalCandidates > 0 ? Math.round(weightedMatchTotal / totalCandidates) : 0;
  const stats = [
    { label: "کمپین‌های ثبت‌شده", value: campaignsLoading ? "…" : campaigns.length.toLocaleString('fa-IR'), icon: Briefcase },
    { label: "کل کاندیداها", value: campaignsLoading ? "…" : totalCandidates.toLocaleString('fa-IR'), icon: Users },
    { label: "کمپین‌های خودکار", value: campaignsLoading ? "…" : campaigns.filter((campaign) => campaign.auto_headhunting).length.toLocaleString('fa-IR'), icon: Radar },
  ];
  const currentDate = new Date().toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });

  const handleExportPDF = () => {
    let styleEl = document.getElementById('dashboard-print-styles') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dashboard-print-styles';
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = PRINT_STYLES;

    const area = document.getElementById('dashboard-print-area');
    if (area) area.style.display = 'block';

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        if (area) area.style.display = 'none';
      }, 800);
    }, 120);
  };

  return (
    <div className="space-y-6">

      {/* ─── Hidden Print Area ─── */}
      <div id="dashboard-print-area" style={{ display: 'none' }} dir="rtl">
        <style>{`
          #dashboard-print-area {
            font-family: 'BNAZANIN', Tahoma, Arial, sans-serif;
            color: #111;
            background: #fff;
          }
          #dashboard-print-area h1 {
            font-size: 20px;
            font-weight: bold;
            color: #1e3a5f;
            margin: 0 0 3px;
          }
          #dashboard-print-area .ph {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #1e3a5f;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          #dashboard-print-area .ph img { height: 44px; object-fit: contain; }
          #dashboard-print-area .ph p { font-size: 12px; color: #666; margin: 0; }
          #dashboard-print-area .sec-title {
            font-size: 13px;
            font-weight: bold;
            color: #1e3a5f;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
            margin: 18px 0 10px;
          }
          #dashboard-print-area .health-row {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 12px 14px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            margin-bottom: 4px;
          }
          #dashboard-print-area .hbar-wrap {
            flex: 1;
            height: 12px;
            background: #eee;
            border-radius: 99px;
            overflow: hidden;
          }
          #dashboard-print-area .hbar-fill {
            height: 100%;
            background: #1e3a5f;
            border-radius: 99px;
          }
          #dashboard-print-area .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
          }
          #dashboard-print-area .stat-box {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 12px 10px;
            text-align: center;
          }
          #dashboard-print-area .stat-val {
            display: block;
            font-size: 26px;
            font-weight: bold;
            color: #1e3a5f;
          }
          #dashboard-print-area .stat-lbl {
            display: block;
            font-size: 11px;
            color: #555;
            margin-top: 3px;
          }
          #dashboard-print-area .stat-chg {
            display: block;
            font-size: 11px;
            color: #16a34a;
            margin-top: 3px;
          }
          #dashboard-print-area .iv-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          #dashboard-print-area .iv-table th {
            background: #f5f5f5;
            color: #1e3a5f;
            padding: 8px 12px;
            text-align: right;
            border: 1px solid #ddd;
            font-size: 12px;
          }
          #dashboard-print-area .iv-table td {
            padding: 9px 12px;
            border: 1px solid #ddd;
            color: #222;
          }
          #dashboard-print-area .pf {
            margin-top: 28px;
            border-top: 1px solid #ddd;
            padding-top: 8px;
            text-align: center;
            font-size: 10px;
            color: #aaa;
          }
        `}</style>

        {/* Header */}
        <div className="ph">
          <div>
            <h1>گزارش داشبورد استخدام</h1>
            <p>تاریخ: {currentDate}</p>
          </div>
          <img src={logo} alt="hring" />
        </div>

        {/* Health */}
        <div className="sec-title">میانگین تطابق کاندیداها</div>
        <div className="health-row">
          <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#1e3a5f', minWidth: '56px' }}>٪{hiringHealth}</span>
          <div className="hbar-wrap">
            <div className="hbar-fill" style={{ width: `${hiringHealth}%` }} />
          </div>
          <span style={{ fontSize: '12px', color: '#555' }}>{totalCandidates > 0 ? 'بر اساس داده‌های ثبت‌شده' : 'بدون داده'}</span>
        </div>

        {/* Stats */}
        <div className="sec-title">آمار کلی این هفته</div>
        <div className="stats-grid">
          {stats.map((stat) => (
            <div key={stat.label} className="stat-box">
              <span className="stat-val">{stat.value}</span>
              <span className="stat-lbl">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Interviews */}
        <div className="sec-title">مصاحبه‌ها</div>
        <p style={{ fontSize: '12px', color: '#555', border: '1px solid #ddd', borderRadius: '8px', padding: '12px' }}>
          تقویم مصاحبه هنوز به داده عملیاتی متصل نشده است؛ هیچ مصاحبه نمونه‌ای در این گزارش درج نشده.
        </p>

        <div className="pf">این گزارش توسط پلتفرم hring تولید شده است — hring.ir</div>
      </div>
      {/* ─── End Print Area ─── */}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">نمای کلی</h1>
          <p className="text-muted-foreground">خوش آمدید! اینجا خلاصه‌ای از وضعیت استخدام شماست.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 glass-card rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
            <Gem className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground">
              {creditsLoading ? "..." : credits}
            </span>
            <span className="text-sm text-muted-foreground">GEM</span>
          </div>
          <Badge className="bg-primary/20 text-primary">
            {context?.subscriptionTier ? TIER_NAMES[context.subscriptionTier] : 'رایگان'}
          </Badge>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Hiring Health */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-5 flex flex-col items-center justify-center"
        >
          <p className="text-muted-foreground text-sm mb-3">میانگین تطابق</p>
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-secondary"
                strokeWidth="3"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-primary"
                strokeWidth="3"
                strokeDasharray={`${hiringHealth}, 100`}
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-foreground">٪{hiringHealth}</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">{totalCandidates > 0 ? "بر اساس کاندیداهای ثبت‌شده" : "بدون داده"}</p>
        </motion.div>

        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + (index + 1) * 0.1 }}
            className="glass-card p-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm">{stat.label}</p>
                <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <stat.icon className="w-5 h-5 text-primary" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="glass-card p-6"
        >
          <h2 className="text-lg font-semibold text-foreground mb-4">اقدامات سریع</h2>
          <div className="grid grid-cols-2 gap-3">
            <Button 
              className="glow-button text-foreground h-12"
              onClick={() => navigate('/job-description')}
            >
              <Briefcase className="w-4 h-4 ml-2" />
              موقعیت جدید
            </Button>
            <Button 
              variant="outline" 
              className="border-border bg-secondary/50 h-12"
              onClick={() => navigate('/smart-ad-generator')}
            >
              <Megaphone className="w-4 h-4 ml-2" />
              آگهی جدید
            </Button>
            <Button 
              variant="outline" 
              className="border-border bg-secondary/50 h-12"
              onClick={() => navigate('/hr-dashboard')}
            >
              <Users className="w-4 h-4 ml-2" />
              داشبورد منابع انسانی
            </Button>
            <Button 
              variant="outline" 
              className="border-border bg-secondary/50 h-12"
              onClick={handleExportPDF}
            >
              <FileDown className="w-4 h-4 ml-2" />
              گزارش PDF
            </Button>
            <Button 
              variant="outline" 
              className="border-cyan-500/50 bg-cyan-950/30 h-12 hover:bg-cyan-900/50 text-cyan-300"
              onClick={() => navigate('/learning-path')}
            >
              <BookOpen className="w-4 h-4 ml-2" />
              مسیر یادگیری
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="glass-card p-6"
        >
          <h2 className="text-lg font-semibold text-foreground mb-3">مصاحبه‌ها</h2>
          <p className="mb-4 text-sm leading-6 text-muted-foreground">
            تقویم مصاحبه هنوز به داده عملیاتی متصل نشده است؛ برای ساخت راهنمای یک مصاحبه از دستیار مصاحبه استفاده کنید.
          </p>
          <Button variant="outline" onClick={() => navigate('/interview-assistant')}>
            ورود به دستیار مصاحبه
          </Button>
        </motion.div>
      </div>

      {/* Legal Advisor Widget - for Pro and Plus users */}
      {(context?.subscriptionTier === 'individual_pro' || context?.subscriptionTier === 'individual_plus') && (
        <LegalAdvisorWidget />
      )}
    </div>
  );
};

export default IndividualDashboard;
