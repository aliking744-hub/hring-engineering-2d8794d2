import { Download, FileText, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import ScrollReveal from "@/components/ScrollReveal";
import { Button } from "@/components/ui/button";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useDigitalProducts } from "@/hooks/useDigitalProducts";

const ShopTeaser = () => {
  const { getSetting } = useSiteSettings();
  const { products, loading } = useDigitalProducts();

  const shopTitle = getSetting('shop_title', 'فروشگاه اسناد HR');
  const shopSubtitle = getSetting('shop_subtitle', 'قالب‌های آماده قرارداد و مستندات منابع انسانی');
  const publishedProducts = products
    .filter((product) => product.is_active)
    .slice(0, 6);

  return (
    <section className="py-24 px-4" dir="rtl">
      <div className="container mx-auto">
        <ScrollReveal>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-4">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                {shopTitle}
              </h2>
              <p className="text-muted-foreground text-lg">
                {shopSubtitle}
              </p>
            </div>
            <Link to="/shop">
              <Button variant="outline" className="border-border bg-secondary/50 hover:bg-secondary">
                مشاهده همه
              </Button>
            </Link>
          </div>
        </ScrollReveal>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="ml-2 h-5 w-5 animate-spin" />
            <span>در حال دریافت محصولات منتشرشده...</span>
          </div>
        ) : publishedProducts.length > 0 ? (
          <div className="horizontal-scroll pb-4">
            {publishedProducts.map((product, index) => (
              <ScrollReveal key={product.id} delay={index * 0.05}>
                <Link to="/shop" className="block">
                  <motion.div
                    whileHover={{ y: -5 }}
                    className="glass-card p-6 w-72 cursor-pointer group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>

                    <span className="text-xs text-primary font-medium">
                      {product.category || 'عمومی'}
                    </span>

                    <h3 className="text-lg font-semibold text-foreground mt-1 mb-3">
                      {product.name}
                    </h3>

                    <div className="flex items-center gap-1 text-muted-foreground text-sm">
                      <Download className="w-4 h-4" />
                      <span>{product.download_count.toLocaleString('fa-IR')} دانلود</span>
                    </div>
                  </motion.div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        ) : (
          <p className="py-12 text-center text-muted-foreground">
            هنوز محصولی برای نمایش عمومی منتشر نشده است.
          </p>
        )}
      </div>
    </section>
  );
};

export default ShopTeaser;
