import { Link } from "react-router-dom";
import { useLogos, useFonts, useSiteSettings, useSiteName } from "@/hooks/useSiteSettings";
import defaultLogo from "@/assets/logo_zir_white.png";

const Footer = () => {
  const logos = useLogos();
  const fonts = useFonts();
  const { getSetting } = useSiteSettings();
  const siteName = useSiteName();
  
  const footerCredit = getSetting('footer_credit', 'توسعه و معماری');
  const footerAuthor = getSetting('footer_author', 'Ali Dehghani');
  const footerAi = getSetting('footer_ai', '');
  const footerCopyright = getSetting('footer_copyright', 'تمامی حقوق محفوظ است');
  
  // Use dynamic footer logo or fallback
  const footerLogo = logos.footer || defaultLogo;

  return (
    <footer className="py-12 px-4 border-t border-border" dir="rtl">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <img 
              src={footerLogo} 
              alt={siteName} 
              className="h-10 object-contain"
            />
            <span 
              className="text-xl font-bold gradient-text-primary"
              style={{ fontFamily: fonts.heading }}
            >
              {siteName}
            </span>
          </Link>

          {/* Links */}
          <div 
            className="flex items-center gap-6 md:gap-8 text-sm text-muted-foreground flex-wrap justify-center"
            style={{ fontFamily: fonts.nav }}
          >
            <Link to="/" className="hover:text-foreground transition-colors">
              خانه
            </Link>
            <Link to="/shop" className="hover:text-foreground transition-colors">
              فروشگاه
            </Link>
            <Link to="/faq" className="hover:text-foreground transition-colors">
              سوالات متداول
            </Link>
            <Link to="/dashboard" className="hover:text-foreground transition-colors">
              داشبورد
            </Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">
              شرایط استفاده
            </Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              حریم خصوصی
            </Link>
            <Link to="/refund-policy" className="hover:text-foreground transition-colors">
              بازگشت وجه
            </Link>
          </div>

          <div className="flex items-center gap-5">
            {/* eNamad trust seal */}
            <a
              href="https://trustseal.enamad.ir/?id=5400235&Code=jF7dgCBDkRnuxB9WeJSMdwDTI1OlZBTI"
              target="_blank"
              rel="noopener"
              referrerPolicy="origin"
              aria-label="مشاهده نماد اعتماد الکترونیکی HRing"
            >
              <img
                src="https://trustseal.enamad.ir/logo.aspx?id=5400235&Code=jF7dgCBDkRnuxB9WeJSMdwDTI1OlZBTI"
                alt="نماد اعتماد الکترونیکی HRing"
                referrerPolicy="origin"
                className="h-16 w-16 object-contain"
              />
            </a>

            {/* Credit */}
            <p className="text-sm text-muted-foreground text-center md:text-right">
              {footerCredit}{" "}
              <span className="text-foreground">{footerAuthor}</span>
              {footerAi && (
                <>
                  {" "}&{" "}
                  <span className="gradient-text-primary">{footerAi}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {siteName}. {footerCopyright}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
