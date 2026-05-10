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

  return (
    <>
      <Helmet>
        <title>{siteName} - نرم افزار جامع منابع انسانی</title>
        <meta 
          name="description" 
          content={`${siteName} سیستم مدیریت منابع انسانی نسل جدید. استخدام هوشمند، مصاحبه خودکار و آنبوردینگ حرفه‌ای با قدرت هوش مصنوعی. راهکار یکپارچه برای تیم‌های HR.`}
        />
        <meta name="keywords" content="منابع انسانی, استخدام, مصاحبه, آنبوردینگ, HR, هوش مصنوعی, نرم افزار منابع انسانی" />
        <link rel="canonical" href="https://hring.ir/" />
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
