import { Helmet } from 'react-helmet-async';
import { Crosshair, LockKeyhole, Sparkles } from 'lucide-react';
import AuroraBackground from '@/components/AuroraBackground';
import WorkspaceHeader from '@/components/WorkspaceHeader';
import { Card, CardContent } from '@/components/ui/card';

const HeadhuntingComingSoon = () => (
  <>
    <Helmet>
      <title>هدهانتینگ هوشمند | به‌زودی در HRing</title>
      <meta name="description" content="هدهانتینگ هوشمند HRing برای جست‌وجو و ارزیابی مدیران ارشد در حال آماده‌سازی است." />
      <meta name="robots" content="noindex, nofollow" />
    </Helmet>
    <div className="relative min-h-screen" dir="rtl">
      <AuroraBackground />
      <main className="container relative z-10 mx-auto max-w-4xl px-4 py-8">
        <WorkspaceHeader
          title="هدهانتینگ هوشمند"
          subtitle="این بخش در حال تکمیل و کنترل کیفیت نهایی است."
          icon={<Crosshair className="h-7 w-7" />}
        />
        <Card className="mt-8 overflow-hidden border-primary/20 bg-card/80 backdrop-blur">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <div className="mb-5 rounded-full bg-primary/10 p-4 text-primary"><Sparkles className="h-9 w-9" /></div>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-sm font-semibold text-primary">به‌زودی</span>
            <h1 className="mt-5 text-2xl font-bold">شکار هدفمند مدیران، بعد از تأیید نهایی کیفیت</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
              برای اینکه خروجی جست‌وجو، ارزیابی و معرفی مدیران قابل اتکا باشد، این ماژول فعلاً در دسترس نیست. سایر ابزارهای آماده HRing بدون محدودیت در داشبورد قابل استفاده‌اند.
            </p>
            <div className="mt-7 flex items-center gap-2 text-sm text-muted-foreground"><LockKeyhole className="h-4 w-4" />اطلاعات و مسیرهای قبلی این قابلیت محفوظ مانده‌اند.</div>
          </CardContent>
        </Card>
      </main>
    </div>
  </>
);

export default HeadhuntingComingSoon;
