import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Star, Loader2, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SupportChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [isTyping, setIsTyping] = useState(false);
  const [feedbackOffered, setFeedbackOffered] = useState(false);
  const [hasReceivedReward, setHasReceivedReward] = useState(false);
  const [awaitingEndConfirmation, setAwaitingEndConfirmation] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const followUpTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const isTypingRef = useRef(false);
  const lastUserActivityRef = useRef<number>(Date.now());
  const { user } = useAuth();

  // Feedback state
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Keep refs in sync
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    isTypingRef.current = isTyping;
  }, [isTyping]);

  // Check if user already received reward
  useEffect(() => {
    const checkRewardStatus = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('site_feedback')
        .select('id')
        .eq('user_id', user.id)
        .eq('rewarded', true)
        .limit(1);
      if (data && data.length > 0) {
        setHasReceivedReward(true);
      }
    };
    checkRewardStatus();
  }, [user]);

  useEffect(() => {
    // ScrollArea viewport is the actual scrollable element
    const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  const clearFollowUpTimer = () => {
    if (followUpTimerRef.current) {
      clearTimeout(followUpTimerRef.current);
      followUpTimerRef.current = null;
    }
  };

  const normalizeFa = (value: string) =>
    value
      .trim()
      .toLowerCase()
      // ZWNJ
      .replace(/[\u200c]/g, ' ')
      // punctuation
      .replace(/[.,!?؛:()"'\[\]{}<>…،؟!]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // Short message threshold for "end of conversation" detection
  const SHORT_MESSAGE_THRESHOLD = 30;

  // Direct end keywords - only trigger on short messages
  const END_KEYWORDS = new Set([
    'نه',
    'نه ممنون',
    'خیر',
    'نخیر',
    'مرسی',
    'ممنون',
    'ممنونم',
    'متشکر',
    'متشکرم',
    'تشکر',
    'سپاس',
    'سپاسگزارم',
  ]);

  // Ambiguous patterns that need confirmation
  const AMBIGUOUS_STARTERS = ['نه', 'خیر', 'نخیر', 'مرسی', 'ممنون', 'متشکر', 'تشکر', 'سپاس'];

  // Confirmation keywords
  const CONFIRMATION_YES = new Set(['آره', 'بله', 'اره', 'yes', 'باشه', 'ok', 'اوکی']);
  const CONFIRMATION_NO = new Set(['نه', 'خیر', 'نخیر', 'no', 'ادامه', 'سوال دارم']);

  const isDirectEndMessage = (value: string) => {
    const v = normalizeFa(value);
    if (!v || v.length > SHORT_MESSAGE_THRESHOLD) return false;
    return END_KEYWORDS.has(v);
  };

  const isAmbiguousEndMessage = (value: string) => {
    const v = normalizeFa(value);
    if (!v) return false;
    // If too long, not ambiguous - it's a real conversation
    if (v.length > 50) return false;
    // If very short and direct, not ambiguous
    if (v.length <= SHORT_MESSAGE_THRESHOLD && END_KEYWORDS.has(v)) return false;
    // Check if starts with end keywords but has more content
    return v.length > SHORT_MESSAGE_THRESHOLD && v.length <= 50 && 
           AMBIGUOUS_STARTERS.some((s) => v === s || v.startsWith(`${s} `));
  };

  const isConfirmationYes = (value: string) => {
    const v = normalizeFa(value);
    return CONFIRMATION_YES.has(v) || v.includes('دیگه نه') || v.includes('همین بود');
  };

  const isConfirmationNo = (value: string) => {
    const v = normalizeFa(value);
    return CONFIRMATION_NO.has(v) || v.includes('ادامه') || v.includes('سوال');
  };

  const isFollowUpMessage = (value: string) => normalizeFa(value).includes('کار دیگه');

  const offerFeedback = () => {
    if (feedbackOffered || hasReceivedReward) return;
    setFeedbackOffered(true);

    if (user) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'ممنون میشم نظرتون در مورد سایت رو با ما به اشتراک بذارین و ۵۰ الماس ناقابل دریافت کنید.',
        },
      ]);
      setShowFeedback(true);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'برای ثبت نظر و دریافت ۵۰ الماس، لطفاً اول وارد حساب کاربری‌تون بشید.',
        },
      ]);
    }
  };

  const handleConversationEnd = (userMessage: string) => {
    // Handle confirmation response if we're waiting for one
    if (awaitingEndConfirmation) {
      setAwaitingEndConfirmation(false);
      clearFollowUpTimer();
      setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);

      if (isConfirmationYes(userMessage)) {
        offerFeedback();
        return true;
      } else if (isConfirmationNo(userMessage)) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'بفرمایید، در خدمتم.' },
        ]);
        return true;
      }
      // Not a clear confirmation - continue to AI
      return false;
    }

    // Direct short end message
    if (isDirectEndMessage(userMessage)) {
      clearFollowUpTimer();
      setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
      offerFeedback();
      return true;
    }

    // Ambiguous end message - ask for confirmation
    if (isAmbiguousEndMessage(userMessage)) {
      clearFollowUpTimer();
      setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'خوشحالم که تونستم کمک کنم! کار دیگه‌ای هست؟' },
      ]);
      setAwaitingEndConfirmation(true);
      return true;
    }

    return false;
  };

  const startFollowUpTimer = () => {
    clearFollowUpTimer();

    // Get last assistant message length
    const lastAssistantMsg = messagesRef.current
      .slice()
      .reverse()
      .find((m) => m.role === 'assistant');
    const lastMsgLength = lastAssistantMsg?.content.length || 0;

    // Determine delay based on message length
    // Long messages (>200 chars) = 10 seconds, short = 5 seconds
    const baseDelay = lastMsgLength > 200 ? 10000 : 5000;

    followUpTimerRef.current = setTimeout(() => {
      const currentMessages = messagesRef.current;
      const currentIsTyping = isTypingRef.current;
      const timeSinceActivity = Date.now() - lastUserActivityRef.current;

      // Don't send if:
      // 1. User is currently typing
      // 2. User was active in the last 3 seconds
      // 3. No messages yet
      if (currentIsTyping || timeSinceActivity < 3000 || currentMessages.length === 0) {
        // Reschedule for later
        startFollowUpTimer();
        return;
      }

      const lastMessage = currentMessages[currentMessages.length - 1];

      // Only ask if last message was from assistant and doesn't already contain follow-up
      if (lastMessage?.role === 'assistant' && !isFollowUpMessage(lastMessage.content)) {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'کار دیگه‌ای هست بتونم براتون انجام بدم؟' }]);
      }
    }, baseDelay);
  };

  const streamChat = async (userMessage: string) => {
    // End-of-conversation -> offer feedback (no AI call)
    if (handleConversationEnd(userMessage)) return;

    // New message: cancel any pending follow-up
    clearFollowUpTimer();

    const newMessages = [...messagesRef.current, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    let assistantContent = '';
    let didStreamAnyContent = false;

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hring-support`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: newMessages,
          sessionId,
          userId: user?.id || null,
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json();
        throw new Error(errorData.error || 'خطا در ارتباط');
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              didStreamAnyContent = true;
              assistantContent += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
                }
                return [...prev, { role: 'assistant', content: assistantContent }];
              });
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      if (didStreamAnyContent) {
        startFollowUpTimer();
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast.error(error instanceof Error ? error.message : 'خطا در ارتباط با پشتیبانی');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'عذر میخوام، مشکلی پیش اومد. لطفاً دوباره امتحان کنید.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear timer when user starts typing and track activity
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    setIsTyping(true);
    lastUserActivityRef.current = Date.now();
    clearFollowUpTimer();
  };

  // Reset typing state after user stops
  useEffect(() => {
    if (!input) {
      setIsTyping(false);
    }
  }, [input]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (followUpTimerRef.current) {
        clearTimeout(followUpTimerRef.current);
      }
    };
  }, []);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    const msg = input.trim();
    setInput('');
    streamChat(msg);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const submitFeedback = async () => {
    if (!user) {
      toast.error('برای ثبت نظر باید وارد شوید');
      return;
    }
    if (rating === 0) {
      toast.error('لطفاً امتیاز دهید');
      return;
    }

    setSubmittingFeedback(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-feedback', {
        body: { userId: user.id, rating, comment },
      });

      if (error) throw error;

      toast.success(data.message);

      // Keep client state in sync so we don't offer the reward again in this session.
      if (data?.isFirstFeedback || (typeof data?.diamondsAwarded === 'number' && data.diamondsAwarded > 0)) {
        setHasReceivedReward(true);
      }

      setShowFeedback(false);
      setRating(0);
      setComment('');
    } catch (error) {
      console.error('Feedback error:', error);
      toast.error('خطا در ثبت نظر');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <>
      {/* Floating Button - Glassy Neon Blue */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full flex items-center justify-center ${isOpen ? 'hidden' : ''}`}
        style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(37, 99, 235, 0.5) 100%)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(59, 130, 246, 0.4)',
          boxShadow: '0 0 20px rgba(59, 130, 246, 0.4), 0 0 40px rgba(59, 130, 246, 0.2), inset 0 0 20px rgba(255, 255, 255, 0.1)',
        }}
        whileHover={{ scale: 1.1, boxShadow: '0 0 30px rgba(59, 130, 246, 0.6), 0 0 60px rgba(59, 130, 246, 0.3)' }}
        whileTap={{ scale: 0.95 }}
      >
        <MessageCircle className="w-6 h-6 text-blue-400" />
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 left-6 z-50 w-[360px] h-[500px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            dir="rtl"
          >
            {/* Header */}
            <div className="bg-primary p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary-foreground" />
                <span className="font-bold text-primary-foreground">پشتیبانی</span>
              </div>
              <div className="flex items-center gap-2">
                {user && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFeedback(true)}
                    className="text-primary-foreground hover:bg-primary-foreground/20 gap-1 text-xs"
                  >
                    <Gift className="w-4 h-4" />
                    ۵۰ الماس
                  </Button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-primary-foreground hover:bg-primary-foreground/20 p-1 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-8" style={{ fontFamily: 'BNazanin, sans-serif' }}>
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm leading-7">سلام! چطور کمکتون کنم؟</p>
                </div>
              )}
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-2xl text-sm leading-7 ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-tr-sm'
                          : 'bg-secondary text-secondary-foreground rounded-tl-sm'
                      }`}
                      style={{ fontFamily: 'BNazanin, sans-serif' }}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role === 'user' && (
                  <div className="flex justify-end">
                    <div className="bg-secondary p-3 rounded-2xl rounded-tl-sm flex items-center gap-1">
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="p-3 border-t border-border">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  placeholder="پیام خود را بنویسید..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feedback Modal */}
      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowFeedback(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm"
              dir="rtl"
            >
              <h3 className="text-lg font-bold mb-4">ثبت نظر و دریافت ۵۰ الماس</h3>
              
              {/* Star Rating */}
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="p-1"
                  >
                    <Star
                      className={`w-8 h-8 transition-colors ${
                        star <= rating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {/* Comment */}
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="نظر خود را بنویسید (اختیاری)..."
                className="mb-4"
                rows={3}
              />

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={submitFeedback}
                  disabled={rating === 0 || submittingFeedback}
                  className="flex-1"
                >
                  {submittingFeedback ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'ثبت نظر'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowFeedback(false)}
                >
                  انصراف
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SupportChatWidget;
