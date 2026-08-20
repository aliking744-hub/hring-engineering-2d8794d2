import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  FileSpreadsheet, 
  Download, 
  ExternalLink, 
  Search,
  Filter,
  ShoppingBag,
  Loader2,
  Lock,
  Unlock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import SpotlightCard from '@/components/SpotlightCard';
import ScrollReveal from '@/components/ScrollReveal';
import { DigitalProduct, useDigitalProducts } from '@/hooks/useDigitalProducts';
import { useAdmin } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const categories = ['همه', 'قراردادها', 'قانونی', 'ارزیابی', 'آنبوردینگ', 'آموزش', 'عمومی'];

const UserMarketplace = () => {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { 
    products, 
    loading, 
    hasPurchased, 
    downloadFile, 
    incrementDownloadCount 
  } = useDigitalProducts();
  
  const [activeCategory, setActiveCategory] = useState('همه');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fa-IR').format(price);
  };

  const getFileIcon = (filePath: string | null) => {
    if (!filePath) return <FileText className="w-8 h-8 text-primary" />;
    if (filePath.includes('.xlsx') || filePath.includes('.xls')) {
      return <FileSpreadsheet className="w-8 h-8 text-emerald-400" />;
    }
    return <FileText className="w-8 h-8 text-sky-400" />;
  };

  const activeProducts = products.filter(p => p.is_active);

  const filteredProducts = activeProducts.filter((product) => {
    const matchesCategory = activeCategory === 'همه' || product.category === activeCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (product.description?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const canDownload = (product: DigitalProduct) => {
    return isAdmin || hasPurchased(product.id);
  };

  const handlePurchase = (product: DigitalProduct) => {
    if (!product.payment_link) {
      toast.error('لینک پرداخت تنظیم نشده است');
      return;
    }
    window.open(product.payment_link, '_blank');
  };

  const handleDownload = async (product: DigitalProduct) => {
    if (!product.has_file) {
      toast.error('فایلی برای دانلود وجود ندارد');
      return;
    }

    try {
      setDownloadingId(product.id);
      await downloadFile(product.id, product.name);
      await incrementDownloadCount(product.id);
      toast.success('دانلود شروع شد');
    } catch (error) {
      console.error('Error downloading:', error);
      toast.error('خطا در دانلود فایل');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <ScrollReveal>
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            فروشگاه اسناد دیجیتال
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            قالب‌های حرفه‌ای و آماده استفاده برای تمام نیازهای منابع انسانی شما
          </p>
        </div>
      </ScrollReveal>

      {/* Filters */}
      <ScrollReveal delay={0.1}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="جستجوی محصولات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 bg-secondary/50 border-border"
            />
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
            <Filter className="w-5 h-5 text-muted-foreground shrink-0" />
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={activeCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCategory(cat)}
                className={activeCategory === cat 
                  ? "glow-button text-foreground shrink-0" 
                  : "border-border bg-secondary/50 shrink-0"
                }
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>
      </ScrollReveal>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product, index) => (
          <ScrollReveal key={product.id} delay={index * 0.05}>
            <SpotlightCard className="h-full flex flex-col">
              {/* Purchased Badge */}
              {canDownload(product) && (
                <span className="absolute top-4 left-4 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full flex items-center gap-1">
                  <Unlock className="w-3 h-3" />
                  آنلاک شده
                </span>
              )}
              
              {/* Icon */}
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                {getFileIcon(product.file_ext)}
              </div>
              
              {/* Category */}
              <Badge variant="outline" className="w-fit bg-secondary/50 border-border mb-2">
                {product.category || 'عمومی'}
              </Badge>
              
              {/* Title */}
              <h3 className="text-lg font-semibold text-foreground mb-2 flex-1">
                {product.name}
              </h3>
              
              {/* Description */}
              {product.description && (
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {product.description}
                </p>
              )}
              
              {/* Downloads */}
              <div className="flex items-center gap-1 text-muted-foreground text-sm mb-4">
                <Download className="w-4 h-4" />
                <span>{product.download_count} دانلود</span>
              </div>
              
              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <span className="text-xl font-bold text-foreground">
                  {formatPrice(product.price)}{' '}
                  <span className="text-sm font-normal text-muted-foreground">T</span>
                </span>
                
                {canDownload(product) ? (
                  <Button
                    size="sm"
                    onClick={() => handleDownload(product)}
                    disabled={downloadingId === product.id}
                    className="bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30"
                  >
                    {downloadingId === product.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Download className="w-4 h-4 ml-1" />
                        دانلود فایل
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handlePurchase(product)}
                    className="glow-button text-foreground"
                  >
                    <Lock className="w-4 h-4 ml-1" />
                    خرید و آنلاک
                  </Button>
                )}
              </div>
            </SpotlightCard>
          </ScrollReveal>
        ))}
      </div>

      {/* Empty State */}
      {filteredProducts.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">
            محصولی یافت نشد
          </h3>
          <p className="text-muted-foreground">
            فیلترها را تغییر دهید یا عبارت جستجو را اصلاح کنید
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default UserMarketplace;
