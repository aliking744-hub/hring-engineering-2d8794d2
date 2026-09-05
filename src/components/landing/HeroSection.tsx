import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useSiteSettings, useSiteName } from "@/hooks/useSiteSettings";
import { useSectionVisible } from "@/hooks/useSectionVisible";

const HeroSection = () => {
  const { fonts, getSetting } = useSiteSettings();
  const showCtaSecondary = useSectionVisible('hero_cta_secondary');
  const siteName = useSiteName();
  
  // Get dynamic texts or use defaults (using siteName as fallback prefix)
  const heroPrefix = getSetting('hero_prefix', `${siteName}:`);
  const heroTitle = getSetting('hero_title', 'سیستم مدیریت منابع انسانی');
  const heroSuffix = getSetting('hero_suffix', 'نسل جدید');
  const heroSubtitle = getSetting('hero_subtitle', 'قدرت گرفته از هوش مصنوعی. استخدام، مصاحبه و آنبوردینگ را به صورت خودکار و هوشمند مدیریت کنید.');
  const ctaPrimary = getSetting('hero_cta_primary', 'شروع کنید');
  const ctaSecondary = getSetting('hero_cta_secondary', 'مشاهده پلن‌ها');

  return (
    <section className="min-h-screen flex items-center justify-center pt-24 pb-16 px-4" dir="rtl">
      <div className="container mx-auto text-center">
        <div className="space-y-6">
          {/* Main Title - Using Dynamic Heading Font */}
          <h1
            className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-relaxed md:leading-loose font-heading"
            style={{ fontFamily: fonts.heading }}
          >
            <span className="text-foreground">{heroPrefix}</span>
            <br />
            <span className="gradient-text-primary">
              {heroTitle}
            </span>
            <br />
            <span className="text-foreground">{heroSuffix}</span>
          </h1>

          {/* Subtitle - Using Dynamic Body Font */}
          <p
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
            style={{ fontFamily: fonts.body }}
          >
            {heroSubtitle}
          </p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8 }}
          >
            <Link to="/auth">
              <Button 
                size="lg" 
                className="glow-button text-foreground font-semibold px-8 py-6 text-lg gap-2"
                style={{ fontFamily: fonts.button }}
              >
                {ctaPrimary}
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            {showCtaSecondary && (
              <Link to="/upgrade">
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="border-primary/50 bg-primary/10 hover:bg-primary/20 text-foreground font-medium px-8 py-6 text-lg shadow-[0_0_15px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_25px_hsl(var(--primary)/0.5)] transition-all duration-500"
                >
                  {ctaSecondary}
                </Button>
              </Link>
            )}
          </motion.div>
        </div>

        {/* Floating Elements */}
        <motion.div
          className="absolute top-1/4 left-10 w-20 h-20 rounded-full bg-primary/10 blur-xl"
          animate={{
            y: [0, -20, 0],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-10 w-32 h-32 rounded-full bg-accent/10 blur-xl"
          animate={{
            y: [0, 20, 0],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
        />
      </div>
    </section>
  );
};

export default HeroSection;
