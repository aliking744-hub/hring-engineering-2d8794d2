import { Helmet } from "react-helmet-async";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Calendar, ArrowRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AuroraBackground from "@/components/AuroraBackground";
import Navbar from "@/components/Navbar";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { siteName, getSetting } = useSiteSettings();
  const canonicalBase = getSetting('seo_canonical_base_url', 'https://hring.ir').replace(/\/+$/, '');
  const articleUrl = canonicalBase + '/blog/' + encodeURIComponent(slug || '');

  const { data: post, isLoading, error } = useQuery({
    queryKey: ['blog-post', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">خطا در بارگذاری</h1>
          <Button onClick={() => navigate('/blog')}>بازگشت به بلاگ</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{post?.title || 'بلاگ'} - {siteName}</title>
        <meta
          name="description"
          content={
            post?.content?.replace(/[#*_`>\-\n]/g, ' ').trim().substring(0, 160) ||
            `مقاله‌ای از بلاگ HRing درباره منابع انسانی، استخدام و رهبری سازمان. برای مطالعه کامل به صفحه مقاله مراجعه کنید.`
          }
        />
        <link rel="canonical" href={articleUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={articleUrl} />
        <meta property="og:title" content={`${post?.title || 'بلاگ'} - ${siteName}`} />
        <meta
          property="og:description"
          content={
            post?.content?.replace(/[#*_`>\-\n]/g, ' ').trim().substring(0, 160) ||
            'مقاله‌ای از بلاگ HRing درباره منابع انسانی و رهبری سازمان.'
          }
        />
        {post?.image_url && <meta property="og:image" content={post.image_url} />}
        {post && (
          <script type="application/ld+json">
            {JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Article',
              headline: post.title,
              image: post.image_url ? [post.image_url] : undefined,
              datePublished: post.created_at,
              dateModified: post.updated_at || post.created_at,
              mainEntityOfPage: articleUrl,
            })}
          </script>
        )}
      </Helmet>
      <div className="relative min-h-screen" dir="rtl">
        <AuroraBackground />
        <Navbar />
        
        <main className="relative z-10 container mx-auto px-4 py-24">
          <div className="max-w-3xl mx-auto">
            <Link to="/blog">
              <Button variant="outline" className="mb-8 gap-2 border-border bg-secondary/50">
                <ArrowRight className="w-4 h-4" />
                بازگشت به بلاگ
              </Button>
            </Link>

            {isLoading ? (
              <div className="glass-card p-8">
                <Skeleton className="h-64 w-full mb-8 rounded-xl" />
                <Skeleton className="h-10 w-3/4 mb-4" />
                <Skeleton className="h-5 w-1/4 mb-8" />
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            ) : !post ? (
              <div className="glass-card p-8 text-center">
                <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-foreground mb-4">مقاله یافت نشد</h1>
                <p className="text-muted-foreground mb-6">این مقاله وجود ندارد یا هنوز منتشر نشده است</p>
                <Button onClick={() => navigate('/blog')}>مشاهده همه مقالات</Button>
              </div>
            ) : (
              <article className="glass-card p-0 overflow-hidden">
                {post.image_url && (
                  <div className="h-64 md:h-80 overflow-hidden">
                    <img 
                      src={post.image_url} 
                      alt={post.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <div className="p-8">
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                    {post.title}
                  </h1>
                  
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-8 pb-8 border-b border-border">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(post.created_at)}</span>
                  </div>
                  
                  <div className="prose prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {post.content || ''}
                    </ReactMarkdown>
                  </div>
                </div>
              </article>
            )}
          </div>
        </main>
        
        <Footer />
      </div>
    </>
  );
};

export default BlogPost;
