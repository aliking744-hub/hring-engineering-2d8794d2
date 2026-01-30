import { useState } from "react";
import { motion } from "framer-motion";
import { 
  FlaskConical,
  Users,
  Shield,
  Milestone,
  Building2,
  CheckCircle2,
  Send,
  Loader2,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UnicornAnalysis } from "../UnicornLabLayout";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Demo Data for Chapter 2
const demoCompanies: Partial<UnicornAnalysis>[] = [
  {
    id: 'demo-1',
    company_name: 'تالیا موبایل',
    u_score: 85,
    chapter: 'chapter_2',
    chapter_1_approved: true,
    chapter_2_stable: false,
    shadow_cabinet: {
      members: [
        { name: 'دکتر علی محمدی', role: 'مشاور مالی', expertise: 'سرمایه‌گذاری خطرپذیر' },
        { name: 'مهندس سارا احمدی', role: 'مشاور فنی', expertise: 'معماری نرم‌افزار' },
        { name: 'استاد حسین کریمی', role: 'مشاور استراتژی', expertise: 'توسعه بازار' },
      ]
    },
    regulatory_shield: {
      status: 'active',
      licenses: ['مجوز پرداخت الکترونیک', 'مجوز فعالیت فین‌تک'],
      pending: ['گواهی امنیت اطلاعات'],
      risks: ['تغییرات قوانین ارز دیجیتال']
    },
    milestone_funding: {
      rounds: [
        { stage: 'Seed', amount: 500, date: '1402/03', status: 'completed' },
        { stage: 'Series A', amount: 5000, date: '1403/06', status: 'completed' },
        { stage: 'Series B', amount: 25000, date: '1404/01', status: 'in_progress' },
      ],
      nextMilestone: 'رسیدن به ۲ میلیون کاربر فعال'
    }
  },
  {
    id: 'demo-2',
    company_name: 'دیجی‌هلث',
    u_score: 78,
    chapter: 'chapter_2',
    chapter_1_approved: true,
    chapter_2_stable: true,
    shadow_cabinet: {
      members: [
        { name: 'دکتر زهرا نوری', role: 'مشاور پزشکی', expertise: 'تله‌مدیسین' },
        { name: 'مهندس رضا حیدری', role: 'مشاور فناوری', expertise: 'AI در سلامت' },
      ]
    },
    regulatory_shield: {
      status: 'active',
      licenses: ['مجوز تله‌مدیسین', 'گواهی حریم خصوصی'],
      pending: [],
      risks: []
    },
    milestone_funding: {
      rounds: [
        { stage: 'Seed', amount: 300, date: '1401/09', status: 'completed' },
        { stage: 'Series A', amount: 3000, date: '1403/02', status: 'completed' },
      ],
      nextMilestone: 'گسترش به کشورهای منطقه'
    }
  }
];

interface Chapter2MutationProps {
  analyses: UnicornAnalysis[];
  onRefresh: () => void;
  loading: boolean;
}

const Chapter2Mutation = ({ analyses, onRefresh, loading }: Chapter2MutationProps) => {
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('shadow_cabinet');
  const [stabilizing, setStabilizing] = useState(false);
  const { toast } = useToast();

  // Combine real and demo data
  const allCompanies = analyses.length > 0 ? analyses : demoCompanies as UnicornAnalysis[];
  const selectedData = allCompanies.find(c => c.id === selectedCompany);

  const handleStabilize = async (company: UnicornAnalysis) => {
    if (company.id.startsWith('demo-')) {
      toast({
        title: "داده دمو",
        description: "این یک شرکت نمونه است و قابل تغییر نیست",
      });
      return;
    }

    setStabilizing(true);
    try {
      const { error } = await supabase
        .from('unicorn_analyses')
        .update({
          chapter: 'chapter_3',
          chapter_2_stable: true,
          chapter_2_stable_at: new Date().toISOString()
        })
        .eq('id', company.id);

      if (error) throw error;

      toast({
        title: "استیبل شد",
        description: "شرکت به فصل ۳ (مانیتورینگ عصبی) منتقل شد",
      });

      onRefresh();
    } catch (err: any) {
      toast({
        title: "خطا",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setStabilizing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Chapter Info Banner */}
      <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center flex-shrink-0">
              <FlaskConical className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-foreground mb-1">آزمایشگاه جهش</h2>
              <p className="text-muted-foreground text-sm mb-3">
                در این مرحله شرکت‌های تأیید شده با سه ابزار کلیدی پرورش داده می‌شوند:
                کابینه سایه (شبکه مشاوران)، سپر تنظیم‌گری (مجوزها)، و تأمین مالی مایلستونی.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-violet-500/50 text-violet-400">
                  {allCompanies.filter(a => !a.chapter_2_stable).length} در حال پرورش
                </Badge>
                <Badge variant="outline" className="border-violet-500/50 text-violet-400">
                  {allCompanies.filter(a => a.chapter_2_stable).length} استیبل شده
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Company List */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="font-semibold text-foreground">شرکت‌ها</h3>
          {allCompanies.map((company) => (
            <motion.div
              key={company.id}
              whileHover={{ scale: 1.02 }}
              className="cursor-pointer"
              onClick={() => setSelectedCompany(company.id)}
            >
              <Card className={`transition-colors ${
                selectedCompany === company.id ? 'border-primary' : 'hover:border-primary/50'
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-foreground truncate">
                          {company.company_name}
                        </h4>
                        {company.id.startsWith('demo-') && (
                          <Badge variant="outline" className="text-xs">دمو</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-muted-foreground">
                          U-Score: {company.u_score}
                        </span>
                        {company.chapter_2_stable && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">
                            استیبل
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2">
          {!selectedData ? (
            <Card className="border-dashed h-full">
              <CardContent className="py-12 text-center">
                <FlaskConical className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">یک شرکت انتخاب کنید</h3>
                <p className="text-muted-foreground text-sm">
                  برای مشاهده جزئیات و ابزارهای پرورش، روی یک شرکت کلیک کنید.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedData.company_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">U-Score: {selectedData.u_score}</p>
                  </div>
                  {!selectedData.chapter_2_stable && (
                    <Button
                      onClick={() => handleStabilize(selectedData)}
                      disabled={stabilizing}
                      className="bg-gradient-to-r from-violet-500 to-purple-500 text-white"
                    >
                      {stabilizing ? (
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 ml-2" />
                      )}
                      استیبل و ارسال به فصل ۳
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid grid-cols-3 mb-4">
                    <TabsTrigger value="shadow_cabinet" className="gap-2">
                      <Users className="w-4 h-4" />
                      کابینه سایه
                    </TabsTrigger>
                    <TabsTrigger value="regulatory" className="gap-2">
                      <Shield className="w-4 h-4" />
                      سپر تنظیم‌گری
                    </TabsTrigger>
                    <TabsTrigger value="funding" className="gap-2">
                      <Milestone className="w-4 h-4" />
                      تأمین مالی
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="shadow_cabinet" className="space-y-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      شبکه مشاوران و متخصصان پشتیبان
                    </p>
                    {(selectedData.shadow_cabinet as any)?.members?.map((member: any, i: number) => (
                      <Card key={i} className="bg-secondary/30">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                              <Users className="w-5 h-5 text-violet-400" />
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">{member.name}</p>
                              <p className="text-sm text-muted-foreground">{member.role} - {member.expertise}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="regulatory" className="space-y-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      وضعیت مجوزها و ریسک‌های قانونی
                    </p>
                    <div className="grid gap-3">
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-2">مجوزهای فعال</h4>
                        <div className="flex flex-wrap gap-2">
                          {(selectedData.regulatory_shield as any)?.licenses?.map((license: string, i: number) => (
                            <Badge key={i} className="bg-emerald-500/20 text-emerald-400">
                              <CheckCircle2 className="w-3 h-3 ml-1" />
                              {license}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {(selectedData.regulatory_shield as any)?.pending?.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-foreground mb-2">در انتظار</h4>
                          <div className="flex flex-wrap gap-2">
                            {(selectedData.regulatory_shield as any)?.pending?.map((item: string, i: number) => (
                              <Badge key={i} variant="outline" className="border-amber-500/50 text-amber-400">
                                {item}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="funding" className="space-y-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      تاریخچه و برنامه تأمین مالی
                    </p>
                    {(selectedData.milestone_funding as any)?.rounds?.map((round: any, i: number) => (
                      <Card key={i} className="bg-secondary/30">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                round.status === 'completed' ? 'bg-emerald-500/20' : 'bg-amber-500/20'
                              }`}>
                                <Milestone className={`w-5 h-5 ${
                                  round.status === 'completed' ? 'text-emerald-400' : 'text-amber-400'
                                }`} />
                              </div>
                              <div>
                                <p className="font-semibold text-foreground">{round.stage}</p>
                                <p className="text-sm text-muted-foreground">{round.date}</p>
                              </div>
                            </div>
                            <div className="text-left">
                              <p className="font-bold text-foreground">{round.amount.toLocaleString()} میلیون</p>
                              <Badge className={
                                round.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                              }>
                                {round.status === 'completed' ? 'تکمیل' : 'در جریان'}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chapter2Mutation;
