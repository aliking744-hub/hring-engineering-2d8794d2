import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Briefcase, Users, Calendar, TrendingUp, Megaphone,
  FileDown, Gem, Target, Radar, Sparkles
} from 'lucide-react';
import logo from '@/assets/logo.png';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUserContext } from '@/hooks/useUserContext';
import { useCredits } from '@/hooks/useCredits';
import { TIER_NAMES } from '@/types/multiTenant';
import LegalAdvisorWidget from '@/components/LegalAdvisorWidget';

const stats = [
  { label: "موقعیت‌های فعال", value: "۱۲", change: "+۲", icon: Briefcase },
  { label: "متقاضیان جدید", value: "۴۸", change: "+۱۵", icon: Users },
  { label: "مصاحبه این هفته", value: "۸", change: "+۳", icon: Calendar },
  { label: "استخدام این ماه", value: "۳", change: "+۱", icon: TrendingUp },
];

const todayInterviews = [
  { name: "سارا احمدی", position: "طراح UI/UX", time: "۱۰:۳۰" },
  { name: "محمد رضایی", position: "توسعه‌دهنده فرانت‌اند", time: "۱۴:۰۰" },
  { name: "زهرا کریمی", position: "مدیر محصول", time: "۱۶:۳۰" },
];

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
  
  const hiringHealth = 95;
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
        <div className="sec-title">سلامت فرآیند استخدام</div>
        <div className="health-row">
          <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#1e3a5f', minWidth: '56px' }}>٪{hiringHealth}</span>
          <div className="hbar-wrap">
            <div className="hbar-fill" style={{ width: `${hiringHealth}%` }} />
          </div>
          <span style={{ fontSize: '12px', color: '#16a34a' }}>عالی</span>
        </div>

        {/* Stats */}
        <div className="sec-title">آمار کلی این هفته</div>
        <div className="stats-grid">
          {stats.map((stat) => (
            <div key={stat.label} className="stat-box">
              <span className="stat-val">{stat.value}</span>
              <span className="stat-lbl">{stat.label}</span>
              <span className="stat-chg">{stat.change} نسبت به هفته قبل</span>
            </div>
          ))}
        </div>

        {/* Interviews */}
        <div className="sec-title">مصاحبه‌های امروز</div>
        <table className="iv-table">
          <thead>
            <tr>
              <th>نام متقاضی</th>
              <th>موقعیت شغلی</th>
              <th>ساعت</th>
            </tr>
          </thead>
          <tbody>
            {todayInterviews.map((iv, i) => (
              <tr key={i}>
                <td>{iv.name}</td>
                <td>{iv.position}</td>
                <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#1e3a5f' }}>{iv.time}</td>
              </tr>
            ))}
          </tbody>
        </table>

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Hiring Health */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-5 flex flex-col items-center justify-center"
        >
          <p className="text-muted-foreground text-sm mb-3">سلامت استخدام</p>
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
          <p className="text-sm text-green-500 mt-2">عالی</p>
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
            <p className="text-sm text-green-500 mt-2">{stat.change} نسبت به هفته قبل</p>
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
              onClick={() => navigate('/strategic-compass')}
            >
              <Target className="w-4 h-4 ml-2" />
              قطب‌نمای استراتژی
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
              onClick={() => navigate('/strategic-radar')}
            >
              <Radar className="w-4 h-4 ml-2" />
              رادار استراتژیک
            </Button>
            <Button 
              variant="outline" 
              className="border-violet-500/50 bg-violet-950/30 h-12 hover:bg-violet-900/50 text-violet-300"
              onClick={() => navigate('/unicorn-lab')}
            >
              <Sparkles className="w-4 h-4 ml-2" />
              آزمایشگاه یونیکورن
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="glass-card p-6"
        >
          <h2 className="text-lg font-semibold text-foreground mb-4">مصاحبه‌های امروز</h2>
          <div className="space-y-3">
            {todayInterviews.map((interview, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div>
                  <p className="font-medium text-foreground">{interview.name}</p>
                  <p className="text-sm text-muted-foreground">{interview.position}</p>
                </div>
                <span className="text-sm font-medium text-primary">{interview.time}</span>
              </div>
            ))}
          </div>
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
