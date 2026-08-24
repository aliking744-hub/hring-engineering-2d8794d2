import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Calendar, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import AuroraBackground from "@/components/AuroraBackground";
import Navbar from "@/components/Navbar";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const Blog = () => {
  const { siteName, getSetting } = useSiteSettings();
  const canonicalBase = getSetting('seo_canonical_base_url', 'https://hring.ir').replace(/\/+$/, '');
  const blogUrl = canonicalBase + '/blog';
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['blog-posts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('published', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  return (
    <>
      <Helmet>
        <title>بلاگ - {siteName}</title>
        <meta name="description" content="آخرین مقالات و مطالب تخصصی منابع انسانی، استخدام، آنبوردینگ، رهبری سازمان و قانون کار ایران در بلاگ HRing." />
        <link rel="canonical" href={blogUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={blogUrl} />
        <meta property="og:title" content="بلاگ HRing — مقالات تخصصی منابع انسانی" />
        <meta property="og:description" content="آخرین مقالات تخصصی منابع انسانی، استخدام و رهبری سازمان در HRing." />
      </Helmet>
      <div className="relative min-h-screen" dir="rtl">
        <AuroraBackground />
        <Navbar />
        
        <main className="relative z-10 container mx-auto px-4 py-24">
          <div className="flex items-center gap-4 mb-12">
            <Link to="/">
              <Button variant="outline" size="icon" className="border-border bg-secondary/50">
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">بلاگ و مقالات</h1>
              <p className="text-muted-foreground mt-2">آخرین مطالب تخصصی منابع انسانی</p>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="glass-card p-0 overflow-hidden">
                  <Skeleton className="h-48 w-full" />
                  <div className="p-6">
                    <Skeleton className="h-6 w-3/4 mb-3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">هنوز مقاله‌ای منتشر نشده</h2>
              <p className="text-muted-foreground">به زودی مطالب جدید منتشر خواهد شد</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link to={`/blog/${post.slug}`}>
                    <div className="glass-card p-0 overflow-hidden group cursor-pointer h-full">
                      {post.image_url ? (
                        <div className="h-48 overflow-hidden">
                          <img 
                            src={post.image_url} 
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      ) : (
                        <div className="h-48 bg-primary/10 flex items-center justify-center">
                          <BookOpen className="w-16 h-16 text-primary/50" />
                        </div>
                      )}
                      
                      <div className="p-6">
                        <h2 className="text-lg font-semibold text-foreground mb-3 line-clamp-2 group-hover:text-primary transition-colors">
                          {post.title}
                        </h2>
                        
                        <div className="flex items-center gap-1 text-muted-foreground text-sm">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(post.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </main>
        
        <Footer />
      </div>
    </>
  );
};

export default Blog;
