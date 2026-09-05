import { useState, useRef, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { Scale, Send, Paperclip, FileText, X, Loader2, Bot, User, ArrowRight, Sparkles, Plus, MessageSquare, Trash2, Clock, Lock, Shield, MessageCircle, Gavel, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AuroraBackground from "@/components/AuroraBackground";
import Navbar from "@/components/Navbar";
import Footer from "@/components/landing/Footer";
import DefenseBuilder from "@/components/legal/DefenseBuilder";
import LaborComplaintAssistant from "@/components/legal/LaborComplaintAssistant";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useUserContext } from "@/hooks/useUserContext";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";
import { ApiError, apiRequest } from "@/lib/api";
import { useCredits } from "@/hooks/useCredits";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: { type: "image" | "pdf"; name: string; preview?: string }[];
  sources?: { referenceNumber?: number; articleNumber: string | null; category: string; similarity: number; title: string; sourceUrl?: string | null; sourceVersion?: number; publishedAt?: string | null }[];
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const LegalAdvisor = () => {
  const { user } = useAuth();
  const { context } = useUserContext();
  const { credits, getCost } = useCredits();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [attachments, setAttachments] = useState<{ file: File; type: "image" | "pdf"; preview?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const requestKeyRef = useRef<string | null>(null);

  // Check if user can save history (Plus or Corporate users)
  const canSaveHistory = () => {
    if (!context) return false;
    if (context.userType === 'corporate') return true;
    return context.subscriptionTier === 'individual_plus';
  };

  // Load conversations
  useEffect(() => {
    if (user && canSaveHistory()) {
      loadConversations();
    } else {
      setLoadingConversations(false);
    }
  }, [user, context]);

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('legal_conversations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoadingConversations(false);
    }
  };

  // Load messages for a conversation
  const loadMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('legal_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const loadedMessages: Message[] = (data || []).map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        attachments: m.attachments || [],
        sources: m.sources || [],
      }));

      setMessages(loadedMessages);
      setActiveConversationId(conversationId);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('خطا در بارگذاری پیام‌ها');
    }
  };

  // Create new conversation
  const createNewConversation = async () => {
    if (!user || !canSaveHistory()) {
      setMessages([]);
      setActiveConversationId(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('legal_conversations')
        .insert({ user_id: user.id, title: 'مکالمه جدید' })
        .select()
        .single();

      if (error) throw error;

      setConversations(prev => [data, ...prev]);
      setActiveConversationId(data.id);
      setMessages([]);
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  // Delete conversation
  const deleteConversation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('legal_conversations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
      toast.success('مکالمه حذف شد');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('خطا در حذف مکالمه');
    }
  };

  // Save message to database
  const saveMessage = async (conversationId: string, message: Message) => {
    if (!canSaveHistory()) return;

    try {
      await supabase.from('legal_messages').insert({
        conversation_id: conversationId,
        role: message.role,
        content: message.content,
        attachments: message.attachments || [],
        sources: message.sources || [],
      });

      // Update conversation title if first user message
      if (message.role === 'user' && messages.length === 0) {
        const title = message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '');
        await supabase
          .from('legal_conversations')
          .update({ title, updated_at: new Date().toISOString() })
          .eq('id', conversationId);
        
        setConversations(prev => prev.map(c => 
          c.id === conversationId ? { ...c, title, updated_at: new Date().toISOString() } : c
        ));
      } else {
        await supabase
          .from('legal_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId);
      }
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setAttachments((prev) => [...prev, { 
            file, 
            type: "image", 
            preview: e.target?.result as string 
          }]);
        };
        reader.readAsDataURL(file);
      } else if (file.type === "application/pdf") {
        setAttachments((prev) => [...prev, { file, type: "pdf" }]);
      } else {
        toast.error("فقط فایل‌های PDF و تصویر پشتیبانی می‌شوند");
      }
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    if (!input.trim() && attachments.length === 0) return;

    // Create conversation if needed
    let currentConversationId = activeConversationId;
    if (!currentConversationId && canSaveHistory() && user) {
      const { data, error } = await supabase
        .from('legal_conversations')
        .insert({ user_id: user.id, title: 'مکالمه جدید' })
        .select()
        .single();

      if (!error && data) {
        currentConversationId = data.id;
        setConversations(prev => [data, ...prev]);
        setActiveConversationId(data.id);
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      attachments: attachments.map((a) => ({ 
        type: a.type, 
        name: a.file.name, 
        preview: a.preview 
      })),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    const currentAttachments = [...attachments];
    setAttachments([]);
    setIsLoading(true);

    // Save user message
    if (currentConversationId) {
      await saveMessage(currentConversationId, userMessage);
    }

    try {
      let fullQuery = input;
      const attachmentData: { images: string[]; pdfs: string[] } = { images: [], pdfs: [] };
      
      for (const attachment of currentAttachments) {
        if (attachment.type === "image" && attachment.preview) {
          attachmentData.images.push(attachment.preview);
          fullQuery += `\n[تصویر پیوست شده: ${attachment.file.name}]`;
        } else if (attachment.type === "pdf") {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(attachment.file);
          });
          attachmentData.pdfs.push(base64);
          fullQuery += `\n[فایل PDF پیوست شده: ${attachment.file.name}]`;
        }
      }

      const requestKey = requestKeyRef.current || crypto.randomUUID();
      requestKeyRef.current = requestKey;
      const data = await apiRequest<{
        answer: string;
        sources: { referenceNumber?: number; articleNumber: string | null; category: string; similarity: number; title: string; sourceUrl?: string | null; sourceVersion?: number; publishedAt?: string | null }[];
      }>("/legal/advisor/chat", {
        method: "POST",
        headers: { "X-Idempotency-Key": requestKey },
        body: JSON.stringify({
          query: fullQuery,
          images: attachmentData.images,
          pdfs: attachmentData.pdfs,
          conversationHistory: messages.slice(-6).map(m => ({
            role: m.role,
            content: m.content
          }))
        }),
      });
      requestKeyRef.current = null;
      window.dispatchEvent(new Event("hring:credits-changed"));

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer || "پاسخی دریافت نشد",
        sources: data.sources,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      
      // Save assistant message
      if (currentConversationId) {
        await saveMessage(currentConversationId, assistantMessage);
      }
      
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }, 100);

    } catch (error) {
      if (error instanceof ApiError) requestKeyRef.current = null;
      window.dispatchEvent(new Event("hring:credits-changed"));
      console.error("Error:", error);
      toast.error(error instanceof Error ? error.message : "خطا در ارسال پیام");
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "متأسفم، مشکلی در پردازش سوال شما پیش آمد. لطفاً دوباره تلاش کنید.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      labor_law: "قانون کار",
      social_security: "تامین اجتماعی",
      court_rulings: "آرای دیوان",
    };
    return labels[category] || category;
  };

  const sampleQuestions = [
    "حقوق مرخصی زایمان چقدر است؟",
    "شرایط اخراج کارگر چیست؟",
    "ساعت کار قانونی هفتگی چقدر است؟",
    "حق سنوات چگونه محاسبه می‌شود؟",
  ];

  const startNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
  };

  return (
    <div className="relative min-h-screen" dir="rtl">
      <Helmet>
        <title>مشاور حقوقی هوشمند | HRing</title>
        <meta name="description" content="پاسخ به سوالات حقوقی شما در زمینه قانون کار ایران با کمک هوش مصنوعی" />
      </Helmet>

      <AuroraBackground />
      
      <Link to="/dashboard" className="fixed top-24 right-6 z-50">
        <Button variant="outline" className="border-border bg-secondary/80 backdrop-blur-sm shadow-lg">
          <ArrowRight className="w-4 h-4 ml-2" />
          بازگشت به داشبورد
        </Button>
      </Link>
      
      <Navbar />
      
      <main className="pt-32 pb-24 px-2 sm:px-4">
        <div className="container mx-auto max-w-6xl 2xl:max-w-7xl">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">مجهز به هوش مصنوعی</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              مشاور حقوقی هوشمند
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              سوالات حقوقی خود در زمینه قانون کار را بپرسید. می‌توانید تصویر یا PDF نیز پیوست کنید.
            </p>
          </motion.div>

          {/* Mode Tabs */}
          <Tabs defaultValue="chat" className="w-full">
            <TabsList className="grid w-full max-w-xl mx-auto grid-cols-3 mb-6 h-auto">
              <TabsTrigger value="chat" className="gap-1 sm:gap-2 text-xs sm:text-sm py-2 px-1 sm:px-3 flex-col sm:flex-row">
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">مشاور حقوقی</span>
                <span className="sm:hidden">مشاور</span>
              </TabsTrigger>
              <TabsTrigger value="defense" className="gap-1 sm:gap-2 text-xs sm:text-sm py-2 px-1 sm:px-3 flex-col sm:flex-row">
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">دفاع کارفرما</span>
                <span className="sm:hidden">دفاع</span>
              </TabsTrigger>
              <TabsTrigger value="complaint" className="gap-1 sm:gap-2 text-xs sm:text-sm py-2 px-1 sm:px-3 flex-col sm:flex-row">
                <Gavel className="w-4 h-4" />
                <span className="hidden sm:inline">شکایت کارگر</span>
                <span className="sm:hidden">شکایت</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="complaint">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-6"
              >
                <LaborComplaintAssistant />
              </motion.div>
            </TabsContent>

            <TabsContent value="defense">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-6"
              >
                <DefenseBuilder />
              </motion.div>
            </TabsContent>

            <TabsContent value="chat">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Sidebar - Conversation History */}
            {canSaveHistory() && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="hidden lg:flex w-72 glass-card p-4 h-[600px] flex-col"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">تاریخچه مکالمات</h3>
                  <Button variant="ghost" size="icon" onClick={startNewChat}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <ScrollArea className="flex-1">
                  {loadingConversations ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>هنوز مکالمه‌ای ندارید</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {conversations.map((conv) => (
                        <div
                          key={conv.id}
                          onClick={() => loadMessages(conv.id)}
                          className={`p-3 rounded-lg cursor-pointer group transition-colors ${
                            activeConversationId === conv.id
                              ? 'bg-primary/10 border border-primary/30'
                              : 'hover:bg-secondary/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {conv.title}
                              </p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3" />
                                {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true, locale: faIR })}
                              </p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteConversation(conv.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-all"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </motion.div>
            )}

            {/* Chat Container */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex-1 glass-card overflow-hidden"
            >
              {/* Chat Header */}
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Scale className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">مشاور حقوقی</h2>
                    <span className="text-sm text-muted-foreground">
                      پاسخ‌دهی بر اساس قوانین کار ایران
                    </span>
                  </div>
                </div>

                {!canSaveHistory() && (
                  <Badge variant="secondary" className="gap-1">
                    <Lock className="w-3 h-3" />
                    ذخیره تاریخچه: ویژه پلن پلاس
                  </Badge>
                )}
              </div>

              {/* Messages */}
              <ScrollArea className="h-[350px] sm:h-[450px] px-3 sm:px-6 py-4" ref={scrollRef}>
                <div className="space-y-4">
                  {messages.length === 0 && (
                    <div className="text-center py-12">
                      <Bot className="w-20 h-20 mx-auto text-muted-foreground/20 mb-6" />
                      <p className="text-muted-foreground mb-6">
                        سوال حقوقی خود را بپرسید یا فایل آپلود کنید
                      </p>
                      <div className="flex justify-center gap-2 mb-6 flex-wrap">
                        <Badge variant="secondary">قانون کار</Badge>
                        <Badge variant="secondary">تامین اجتماعی</Badge>
                        <Badge variant="secondary">آرای دیوان</Badge>
                      </div>
                      
                      <div className="max-w-md mx-auto">
                        <p className="text-sm text-muted-foreground mb-3">نمونه سوالات:</p>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {sampleQuestions.map((q, i) => (
                            <button
                              key={i}
                              onClick={() => setInput(q)}
                              className="px-3 py-2 text-sm bg-secondary/50 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <AnimatePresence>
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          message.role === "user" 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-secondary"
                        }`}>
                          {message.role === "user" ? (
                            <User className="w-5 h-5" />
                          ) : (
                            <Bot className="w-5 h-5" />
                          )}
                        </div>
                        <div className={`flex-1 ${message.role === "user" ? "text-left" : "text-right"}`}>
                          {message.attachments && message.attachments.length > 0 && (
                            <div className={`flex gap-2 mb-2 flex-wrap ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                              {message.attachments.map((att, i) => (
                                <div key={i} className="relative">
                                  {att.type === "image" && att.preview ? (
                                    <img 
                                      src={att.preview} 
                                      alt={att.name}
                                      className="w-24 h-24 object-cover rounded-xl border"
                                    />
                                  ) : (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg">
                                      <FileText className="w-4 h-4" />
                                      <span className="text-sm">{att.name}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div className={`inline-block px-5 py-4 rounded-2xl max-w-[85%] ${
                            message.role === "user"
                              ? "bg-primary text-primary-foreground rounded-tl-sm"
                              : "bg-secondary rounded-tr-sm"
                          }`}>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">
                              {message.content}
                            </p>
                          </div>

                          {message.sources && message.sources.length > 0 && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {message.sources.map((source, i) => (
                                <Badge key={i} variant="outline" className="gap-1 text-xs">
                                  <span>[{source.referenceNumber ?? i + 1}]</span>
                                  {source.sourceUrl ? (
                                    <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
                                      {source.title || getCategoryLabel(source.category)}
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  ) : (
                                    <span>{source.title || getCategoryLabel(source.category)}</span>
                                  )}
                                  {source.articleNumber && ` - ماده ${source.articleNumber}`}
                                  {source.sourceVersion ? ` - نسخه ${source.sourceVersion}` : null}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-3"
                    >
                      <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div className="bg-secondary px-5 py-4 rounded-2xl rounded-tr-sm">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    </motion.div>
                  )}
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="border-t border-border px-3 sm:px-6 py-3 sm:py-4 space-y-3 pb-safe">
                {attachments.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {attachments.map((att, index) => (
                      <div key={index} className="relative group">
                        {att.type === "image" && att.preview ? (
                          <img 
                            src={att.preview} 
                            alt="preview" 
                            className="w-16 h-16 object-cover rounded-lg border"
                          />
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg">
                            <FileText className="w-4 h-4" />
                            <span className="text-xs max-w-[100px] truncate">{att.file.name}</span>
                          </div>
                        )}
                        <button
                          onClick={() => removeAttachment(index)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="shrink-0"
                  >
                    <Paperclip className="w-5 h-5" />
                  </Button>
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                    placeholder="سوال حقوقی خود را بنویسید..."
                    disabled={isLoading}
                    className="flex-1 text-base"
                  />
                  <Button 
                    onClick={sendMessage} 
                    disabled={isLoading || credits < getCost('LEGAL_ADVISOR') || (!input.trim() && attachments.length === 0)}
                    className="shrink-0 gap-2"
                  >
                    <Send className="w-5 h-5" />
                    <span>{getCost('LEGAL_ADVISOR')} جم</span>
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default LegalAdvisor;
