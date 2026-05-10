import { ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { EyeOff, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSectionVisible } from '@/hooks/useSectionVisible';
import AuroraBackground from '@/components/AuroraBackground';

interface PageVisibilityGateProps {
  sectionId: string;
  children: ReactNode;
}

/**
 * Wraps a page route. If the section is hidden via admin settings,
 * renders a friendly placeholder instead of the page content.
 */
const PageVisibilityGate = ({ sectionId, children }: PageVisibilityGateProps) => {
  const visible = useSectionVisible(sectionId);

  if (visible) return <>{children}</>;

  return (
    <>
      <Helmet>
        <title>این صفحه فعلاً در دسترس نیست</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="relative min-h-screen flex items-center justify-center" dir="rtl">
        <AuroraBackground />
        <div className="relative z-10 glass-card max-w-md w-full mx-4 p-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
            <EyeOff className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold">این صفحه در حال حاضر غیرفعال است</h1>
          <p className="text-muted-foreground">
            مدیر سایت نمایش این بخش را موقتاً غیرفعال کرده است. لطفاً بعداً مراجعه کنید.
          </p>
          <Button asChild className="gap-2">
            <Link to="/">
              <Home className="w-4 h-4" />
              بازگشت به صفحه اصلی
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
};

export default PageVisibilityGate;
