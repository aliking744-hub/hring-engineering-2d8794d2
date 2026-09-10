import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Calendar, PenLine, ShieldCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AuroraBackground from '@/components/AuroraBackground';
import Navbar from '@/components/Navbar';
import Footer from '@/components/landing/Footer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/api';
import { useSiteSettings } from '@/hooks/useSiteSettings';

interface Source {
  url: string;
  title: string | null;
  published_at: string | null;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content_markdown: string;
  seo_title: string;
  meta_description: string;
  focus_keyword: string;
  related_keywords: string[];
  image_url: string | null;
  author_name: string;
  author_disclosure: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  sources: Source[];
  credibility_score: number;
}

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { siteName, getSetting } = useSiteSettings();
  const canonicalBase = getSetting('seo_canonical_base_url', 'https://hring.ir').replace(/\/+$/, '');
  const articleUrl = `${canonicalBase}/blog/${encodeURIComponent(slug || '')}`;
  const { data: post, isLoading, isError } = useQuery({
    queryKey: ['content-post', slug],
    enabled: Boolean(slug),
    retry: false,
    queryFn: () => apiRequest<Article>(
      `/content/posts/${encodeURIComponent(slug || '')}`,
      {},
      { auth: false, retryAuth: false },
    ),
  });
  const formatDate = (value: string) => new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value));

  if (isError) {
    return <div className="flex min-h-screen items-center justify-center" dir="rtl">
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold">مقاله یافت نشد</h1>
        <Button onClick={() => navigate('/blog')}>بازگشت به بلاگ</Button>
      </div>
    </div>;
  }

  return <>
    <Helmet>
      <title>{post?.seo_title || post?.title || 'بلاگ'} | {siteName}</title>
      <meta name="description" content={post?.meta_description || post?.excerpt || 'مقاله تخصصی منابع انسانی در HRing'} />
      <link rel="canonical" href={articleUrl} />
      <meta property="og:type" content="article" />
      <meta property="og:url" content={articleUrl} />
      <meta property="og:title" content={post?.seo_title || post?.title || 'بلاگ HRing'} />
      <meta property="og:description" content={post?.meta_description || post?.excerpt || ''} />
      {post?.image_url && <meta property="og:image" content={post.image_url} />}
      {post && <script type="application/ld+json">{JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description: post.meta_description,
        datePublished: post.published_at || post.created_at,
        dateModified: post.updated_at,
        author: { '@type': 'Organization', name: post.author_name },
        publisher: { '@type': 'Organization', name: 'HRing', url: canonicalBase },
        mainEntityOfPage: articleUrl,
        citation: post.sources.map(source => source.url),
        keywords: [post.focus_keyword, ...post.related_keywords].join(', '),
      })}</script>}
    </Helmet>
    <div className="relative min-h-screen" dir="rtl">
      <AuroraBackground />
      <Navbar />
      <main className="container relative z-10 mx-auto px-4 py-24">
        <div className="mx-auto max-w-4xl">
          <Button asChild variant="outline" className="mb-8">
            <Link to="/blog"><ArrowRight className="ml-2 h-4 w-4" />بازگشت به بلاگ</Link>
          </Button>
          {isLoading || !post ? (
            <div className="glass-card p-8">
              <Skeleton className="mb-8 h-64" />
              <Skeleton className="mb-4 h-10" />
              <Skeleton className="h-5" />
            </div>
          ) : (
            <article className="glass-card overflow-hidden p-0">
              {post.image_url && <img src={post.image_url} alt="" className="h-72 w-full object-cover" />}
              <div className="p-7 md:p-10">
                <h1 className="mb-5 text-3xl font-bold leading-[1.6] md:text-4xl">{post.title}</h1>
                <p className="mb-6 text-lg leading-8 text-muted-foreground">{post.excerpt}</p>
                <div className="mb-8 flex flex-wrap gap-5 border-y py-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2"><PenLine className="h-4 w-4" />{post.author_name}</span>
                  <span className="flex items-center gap-2"><Calendar className="h-4 w-4" />{formatDate(post.published_at || post.created_at)}</span>
                  <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />اعتبار منابع: {post.credibility_score} از ۱۰۰</span>
                </div>
                <div className="prose prose-invert max-w-none leading-8">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content_markdown}</ReactMarkdown>
                </div>
                <div className="mt-10 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-7 text-muted-foreground">
                  {post.author_disclosure}
                </div>
              </div>
            </article>
          )}
        </div>
      </main>
      <Footer />
    </div>
  </>;
};

export default BlogPost;
