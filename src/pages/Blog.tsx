import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, Calendar, PenLine } from 'lucide-react';
import AuroraBackground from '@/components/AuroraBackground';
import Navbar from '@/components/Navbar';
import Footer from '@/components/landing/Footer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/api';
import { useSiteSettings } from '@/hooks/useSiteSettings';

interface Article {
  id: string; title: string; slug: string; excerpt: string; image_url: string | null;
  author_name: string; published_at: string | null; created_at: string;
}

const Blog = () => {
  const { siteName, getSetting } = useSiteSettings();
  const canonicalBase = getSetting('seo_canonical_base_url', 'https://hring.ir').replace(/\/+$/, '');
  const { data: posts = [], isLoading, isError } = useQuery({
    queryKey: ['content-posts'],
    queryFn: () => apiRequest<Article[]>('/content/posts?limit=60', {}, { auth: false, retryAuth: false }),
  });
  const date = (value: string) => new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));

  return <><Helmet><title>بلاگ منابع انسانی | {siteName}</title><meta name="description" content="تحلیل تازه‌ترین پژوهش‌ها و روندهای معتبر منابع انسانی، آینده کار، استخدام و تجربه کارکنان در تحریریه HRing." /><link rel="canonical" href={`${canonicalBase}/blog`} /><meta property="og:type" content="website" /><meta property="og:url" content={`${canonicalBase}/blog`} /></Helmet>
    <div className="relative min-h-screen" dir="rtl"><AuroraBackground /><Navbar /><main className="container relative z-10 mx-auto px-4 py-24">
      <div className="mb-12 flex items-center gap-4"><Button asChild variant="outline" size="icon"><Link to="/"><ArrowRight className="h-5 w-5" /></Link></Button><div><h1 className="text-3xl font-bold md:text-4xl">بلاگ و مقالات</h1><p className="mt-2 text-muted-foreground">تحلیل چندمنبعی روندهای روز منابع انسانی</p></div></div>
      {isLoading ? <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{[1,2,3,4,5,6].map(i => <div key={i} className="glass-card overflow-hidden"><Skeleton className="h-48" /><div className="p-6"><Skeleton className="mb-3 h-6" /><Skeleton className="h-4" /></div></div>)}</div>
      : isError ? <div className="glass-card p-8 text-center"><p>دریافت مقالات موقتاً ممکن نیست.</p></div>
      : posts.length === 0 ? <div className="glass-card p-12 text-center"><BookOpen className="mx-auto mb-4 h-14 w-14 text-muted-foreground" /><h2 className="text-xl font-bold">اولین مقالات تحریریه در راه‌اند</h2></div>
      : <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{posts.map(post => <article key={post.id} className="glass-card flex overflow-hidden p-0"><Link to={`/blog/${post.slug}`} className="flex w-full flex-col">{post.image_url && <img src={post.image_url} alt="" className="h-48 w-full object-cover" loading="lazy" />}<div className="flex flex-1 flex-col p-6"><h2 className="mb-3 text-xl font-bold leading-8">{post.title}</h2><p className="mb-5 line-clamp-3 text-sm leading-7 text-muted-foreground">{post.excerpt}</p><div className="mt-auto flex flex-wrap items-center gap-4 border-t pt-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><PenLine className="h-3.5 w-3.5" />{post.author_name}</span><span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{date(post.published_at || post.created_at)}</span></div></div></Link></article>)}</div>}
    </main><Footer /></div></>;
};

export default Blog;

