import { Helmet } from "react-helmet-async";
import AuroraBackground from "@/components/AuroraBackground";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import BentoGrid from "@/components/landing/BentoGrid";
import DashboardPreview from "@/components/landing/DashboardPreview";
import LegalAdvisorSection from "@/components/landing/LegalAdvisorSection";
import ShopTeaser from "@/components/landing/ShopTeaser";
import FAQTeaser from "@/components/landing/FAQTeaser";
import BlogTeaser from "@/components/landing/BlogTeaser";
import PricingSection from "@/components/landing/PricingSection";
import Footer from "@/components/landing/Footer";
import { useSiteName, useSiteSettings } from "@/hooks/useSiteSettings";

const Index = () => {
  const siteName = useSiteName();
  const { getSetting } = useSiteSettings();
  const isVisible = (id: string) => getSetting(`section_visible_${id}`, 'true') !== 'false';
  const seoTitle = getSetting('seo_title', `${siteName} - نرم افزار جامع منابع انسانی`);
  const seoDescription = getSetting(
    'seo_description',
    `${siteName} سیستم مدیریت منابع انسانی نسل جدید؛ استخدام، تحلیل و تصمیم‌یار منابع انسانی با هوش مصنوعی.`,
  );
  const seoKeywords = getSetting(
    'seo_keywords',
    'منابع انسانی, استخدام, مصاحبه, آنبوردینگ, HR, هوش مصنوعی, نرم افزار منابع انسانی',
  );
  const canonicalBase = getSetting('seo_canonical_base_url', 'https://hring.ir').replace(/\/+$/, '');
  const canonicalUrl = `${canonicalBase}/`;
  const openGraphImage = getSetting('seo_og_image', 'https://hring.ir/og-image.png');

  return (
    <>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <meta name="keywords" content={seoKeywords} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        {openGraphImage && <meta property="og:image" content={openGraphImage} />}
      </Helmet>
      <div className="relative min-h-screen overflow-x-hidden">
        <AuroraBackground />
        <Navbar />
        <main className="max-w-[1920px] mx-auto">
          {isVisible('hero') && <HeroSection />}
          {isVisible('dashboard_preview') && <DashboardPreview />}
          {isVisible('bento') && <BentoGrid />}
          {isVisible('legal') && <LegalAdvisorSection />}
          {isVisible('shop') && <ShopTeaser />}
          {isVisible('pricing_landing') && <PricingSection />}
          {isVisible('faq') && <FAQTeaser />}
          {isVisible('testimonials') && <TestimonialsSection />}
          {isVisible('blog') && <BlogTeaser />}
        </main>
        {isVisible('footer') && <Footer />}
      </div>
    </>
  );
};

export default Index;
