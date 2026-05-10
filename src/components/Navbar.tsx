import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLogos, useFonts, useSiteName, useSiteSettings } from "@/hooks/useSiteSettings";
import defaultLogo from "@/assets/logo.png";

const allNavLinks = [
  { href: "/", label: "خانه", id: "nav_home" },
  { href: "/upgrade", label: "پلن‌ها", id: "nav_plans" },
  { href: "/shop", label: "فروشگاه", id: "nav_shop" },
  { href: "/blog", label: "بلاگ", id: "nav_blog" },
  { href: "/dashboard", label: "داشبورد", id: "nav_dashboard" },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const logos = useLogos();
  const fonts = useFonts();
  const siteName = useSiteName();
  const { getSetting } = useSiteSettings();
  const isVisible = (id: string) => getSetting(`section_visible_${id}`, 'true') !== 'false';
  const navLinks = allNavLinks.filter((l) => isVisible(l.id));
  const showLogin = isVisible('nav_login');

  // Use dynamic logo or fallback to default
  const logo = logos.main || defaultLogo;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50" dir="rtl">
      <div className="glass-card mx-4 mt-4 md:mx-8">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <motion.img
              src={logo}
              alt={`${siteName} - سیستم مدیریت منابع انسانی`}
              className="h-8 w-8 object-contain"
              whileHover={{ scale: 1.05 }}
            />
            <motion.div
              className="text-2xl font-bold gradient-text-primary"
              style={{ fontFamily: fonts.heading }}
              whileHover={{ scale: 1.05 }}
            >
              {siteName}
            </motion.div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="text-muted-foreground hover:text-foreground transition-colors duration-200 text-sm font-medium"
                style={{ fontFamily: fonts.nav }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            {showLogin && (
              <Link to="/auth">
                <Button className="glow-button text-foreground font-medium px-6">
                  ورود
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-foreground"
            aria-label="Toggle menu"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm md:hidden"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-80 glass-card md:hidden p-6"
            >
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-2">
                  <img src={logo} alt={`${siteName} - سیستم مدیریت منابع انسانی`} className="h-6 w-6 object-contain" />
                  <span 
                    className="text-xl font-bold gradient-text-primary"
                    style={{ fontFamily: fonts.heading }}
                  >
                    {siteName}
                  </span>
                </div>
                <button onClick={() => setIsOpen(false)}>
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex flex-col gap-4">
                {navLinks.map((link, index) => (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Link
                      to={link.href}
                      onClick={() => setIsOpen(false)}
                      className="block text-lg py-3 text-muted-foreground hover:text-foreground transition-colors border-b border-border"
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                ))}
                
                {showLogin && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-4"
                  >
                    <Link to="/auth" onClick={() => setIsOpen(false)}>
                      <Button className="glow-button w-full text-foreground font-medium">
                        ورود / ثبت‌نام
                      </Button>
                    </Link>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
