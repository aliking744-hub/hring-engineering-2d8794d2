import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Building2, TrendingUp, Calendar, Briefcase, 
  Target, BarChart3, UserPlus, Gem, Settings, Coins, Radar, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCompany } from '@/hooks/useCompany';
import { useUserContext } from '@/hooks/useUserContext';
import { ROLE_NAMES, TIER_NAMES } from '@/types/multiTenant';
import LegalAdvisorWidget from '@/components/LegalAdvisorWidget';

const CorporateDashboard = () => {
  const navigate = useNavigate();
  const { context } = useUserContext();
  const { company, members, isCEO } = useCompany();

  const corporateStats = [
    { label: "اعضای فعال", value: members.length.toString(), icon: Users, color: "text-blue-400" },
    { label: "پروژه‌های استراتژیک", value: "۸", icon: Target, color: "text-green-400" },
    { label: "جلسات هفته", value: "۱۲", icon: Calendar, color: "text-yellow-400" },
    { label: "رشد ماهانه", value: "٪۲۳", icon: TrendingUp, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      {/* Company Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-primary/20 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {company?.name || 'شرکت شما'}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary">
                  {context?.companyRole ? ROLE_NAMES[context.companyRole] : '-'}
                </Badge>
                <Badge className="bg-primary/20 text-primary">
                  {company?.subscription_tier ? TIER_NAMES[company.subscription_tier] : '-'}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Show Credit Pool if enabled */}
            {company?.credit_pool_enabled ? (
              <div className="flex items-center gap-2 px-4 py-2 glass-card rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                <Coins className="w-5 h-5 text-amber-500" />
                <span className="font-bold text-foreground">
                  {company.credit_pool}
                </span>
                <span className="text-sm text-muted-foreground">مخزن تیم</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 glass-card rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
                <Gem className="w-5 h-5 text-primary" />
                <span className="font-bold text-foreground">
                  {company ? company.monthly_credits - company.used_credits : 0}
                </span>
                <span className="text-sm text-muted-foreground">اعتبار تیم</span>
              </div>
            )}
            {isCEO && (
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => navigate('/company-settings')}
              >
                <Settings className="w-4 h-4" />
                تنظیمات شرکت
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {corporateStats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * index }}
            className="glass-card p-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm">{stat.label}</p>
                <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions & Team */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card p-6"
        >
          <h2 className="text-lg font-semibold text-foreground mb-4">اقدامات سریع</h2>
          <div className="grid grid-cols-2 gap-3">
            <Button 
              className="glow-button text-foreground h-12"
              onClick={() => navigate('/strategic-compass')}
            >
              <Target className="w-4 h-4 ml-2" />
              قطب‌نمای استراتژی
            </Button>
            <Button 
              variant="outline" 
              className="border-border bg-secondary/50 h-12"
              onClick={() => navigate('/job-description')}
            >
              <Briefcase className="w-4 h-4 ml-2" />
              موقعیت جدید
            </Button>
            <Button 
              variant="outline" 
              className="border-border bg-secondary/50 h-12"
              onClick={() => navigate('/hr-dashboard')}
            >
              <BarChart3 className="w-4 h-4 ml-2" />
              داشبورد HR
            </Button>
            {isCEO && (
              <Button 
                variant="outline" 
                className="border-border bg-secondary/50 h-12"
                onClick={() => navigate('/company-members')}
              >
                <UserPlus className="w-4 h-4 ml-2" />
                مدیریت اعضا
              </Button>
            )}
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

        {/* Team Members */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-card p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">اعضای تیم</h2>
            <Badge variant="secondary">{members.length} نفر</Badge>
          </div>
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {members.slice(0, 5).map((member, i) => (
              <div key={member.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">
                      {member.profile?.full_name?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {member.profile?.full_name || member.profile?.email || 'کاربر'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {member.profile?.title || ROLE_NAMES[member.role]}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {ROLE_NAMES[member.role]}
                </Badge>
              </div>
            ))}
            {members.length > 5 && (
              <Button 
                variant="ghost" 
                className="w-full text-muted-foreground"
                onClick={() => navigate('/company-members')}
              >
                مشاهده همه اعضا
              </Button>
            )}
          </div>
        </motion.div>
      </div>

      {/* Strategic Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="glass-card p-6"
      >
        <h2 className="text-lg font-semibold text-foreground mb-4">نمای استراتژیک</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
            <p className="text-sm text-muted-foreground">نیت‌های فعال</p>
            <p className="text-2xl font-bold text-green-400 mt-1">۵</p>
          </div>
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-sm text-muted-foreground">رفتارهای ثبت‌شده</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">۲۸</p>
          </div>
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <p className="text-sm text-muted-foreground">امتیاز همراستایی</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">٪۸۷</p>
          </div>
        </div>
      </motion.div>

      {/* Legal Advisor Widget - for Decision Support and Decision Making tiers */}
      {(company?.subscription_tier === 'corporate_decision_support' || 
        company?.subscription_tier === 'corporate_decision_making') && (
        <LegalAdvisorWidget />
      )}
    </div>
  );
};

export default CorporateDashboard;
