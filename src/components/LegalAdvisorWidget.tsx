import { useState } from 'react';
import { motion } from 'framer-motion';
import { Scale, Send, Loader2, MessageSquare, Bot, User, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ApiError, apiRequest } from '@/lib/api';
import { useCredits } from '@/hooks/useCredits';

interface LegalSource {
  articleNumber?: string | null;
  category: string;
  similarity: number;
  title: string;
  sourceUrl?: string | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: LegalSource[];
}

const LegalAdvisorWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const { credits, getCost } = useCredits();

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || isLoading) return;

    const userMessage = query.trim();
    setQuery('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setIsOpen(true);

    try {
      const key = requestKey || crypto.randomUUID();
      setRequestKey(key);
      const data = await apiRequest<{ answer: string; sources: LegalSource[] }>('/legal/advisor/chat', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': key },
        body: JSON.stringify({ query: userMessage, conversationHistory: messages.slice(-6) }),
      });

      if (data.answer) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.answer, sources: data.sources }]);
        setRequestKey(null);
        window.dispatchEvent(new Event('hring:credits-changed'));
      } else {
        throw new Error('پاسخی دریافت نشد');
      }
    } catch (error) {
      if (error instanceof ApiError) setRequestKey(null);
      console.error('Legal advisor error:', error);
      toast.error('خطا در دریافت پاسخ');
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'متأسفم، در دریافت پاسخ مشکلی پیش آمد. لطفاً دوباره تلاش کنید.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <>
      {/* Widget Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Scale className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">مشاور حقوقی</h3>
            <p className="text-sm text-muted-foreground">سوال حقوقی خود را بپرسید</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="سوال حقوقی خود را اینجا بنویسید..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !query.trim() || credits < getCost('LEGAL_ADVISOR')} className="gap-1">
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <><Send className="w-4 h-4" /><span className="text-xs">{getCost('LEGAL_ADVISOR')} جم</span></>
            )}
          </Button>
        </form>

        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full text-muted-foreground"
            onClick={() => setIsOpen(true)}
          >
            <MessageSquare className="w-4 h-4 ml-2" />
            مشاهده گفتگو ({messages.length} پیام)
          </Button>
        )}
      </motion.div>

      {/* Chat Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-emerald-500" />
              مشاور حقوقی هوشمند
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6">
            <div className="space-y-4 py-4">
              {messages.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>سوال حقوقی خود را بپرسید</p>
                  <p className="text-sm mt-1">پاسخ بر اساس قوانین کار ایران ارائه می‌شود</p>
                </div>
              )}

              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === 'user' 
                      ? 'bg-primary/20' 
                      : 'bg-emerald-500/20'
                  }`}>
                    {msg.role === 'user' ? (
                      <User className="w-4 h-4 text-primary" />
                    ) : (
                      <Bot className="w-4 h-4 text-emerald-500" />
                    )}
                  </div>
                  <div className={`flex-1 p-4 rounded-xl ${
                    msg.role === 'user'
                      ? 'bg-primary/10 mr-8'
                      : 'bg-secondary/50 ml-8'
                  }`}>
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </p>
                    {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-4 border-t border-border/60 pt-3">
                        <p className="mb-2 text-xs font-semibold text-muted-foreground">منابع پاسخ</p>
                        <ul className="space-y-2">
                          {msg.sources.map((source, sourceIndex) => (
                            <li key={`${source.title}-${sourceIndex}`} className="rounded-lg bg-background/60 p-2 text-xs">
                              {source.sourceUrl ? (
                                <a
                                  href={source.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                                >
                                  {source.title}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span className="font-medium">{source.title}</span>
                              )}
                              <span className="mt-1 block text-muted-foreground">
                                {source.category}
                                {source.articleNumber ? ` — ماده ${source.articleNumber}` : ''}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="flex-1 p-4 rounded-xl bg-secondary/50 ml-8">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">در حال جستجو در قوانین...</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </ScrollArea>

          <div className="p-6 pt-0 border-t border-border mt-auto">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="سوال بعدی خود را بنویسید..."
                className="flex-1"
                disabled={isLoading}
              />
              <Button type="submit" disabled={isLoading || !query.trim() || credits < getCost('LEGAL_ADVISOR')} className="gap-1">
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <><Send className="w-4 h-4" /><span className="text-xs">{getCost('LEGAL_ADVISOR')} جم</span></>
                )}
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LegalAdvisorWidget;
