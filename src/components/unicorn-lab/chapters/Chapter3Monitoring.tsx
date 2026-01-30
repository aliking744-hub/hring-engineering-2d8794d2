import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Eye,
  Activity,
  AlertTriangle,
  Plug,
  Power,
  Building2,
  TrendingUp,
  TrendingDown,
  Bell,
  RefreshCw,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { UnicornAnalysis } from "../UnicornLabLayout";

// Demo Data for Chapter 3
const demoCompanies: Partial<UnicornAnalysis>[] = [
  {
    id: 'demo-stable-1',
    company_name: 'دیجی‌هلث',
    u_score: 82,
    chapter: 'chapter_3',
    chapter_2_stable: true,
    health_alerts: [
      { type: 'warning', message: 'کاهش ۵٪ کاربران فعال در ماه گذشته', date: '1404/10/15' },
      { type: 'info', message: 'افزایش رقابت در بخش تله‌مدیسین', date: '1404/10/10' },
    ],
    api_connections: {
      financials: { connected: true, lastSync: '1404/10/20', status: 'healthy' },
      analytics: { connected: true, lastSync: '1404/10/20', status: 'healthy' },
      crm: { connected: false, lastSync: null, status: 'disconnected' },
    },
    pivot_history: [
      { date: '1403/05', from: 'فقط نوبت‌دهی', to: 'نوبت‌دهی + مشاوره آنلاین', impact: 'positive' },
    ]
  },
  {
    id: 'demo-stable-2',
    company_name: 'لرنوس',
    u_score: 75,
    chapter: 'chapter_3',
    chapter_2_stable: true,
    health_alerts: [
      { type: 'critical', message: 'نرخ سوختن بیش از حد انتظار', date: '1404/10/18' },
      { type: 'warning', message: 'تأخیر در جذب سرمایه Series A', date: '1404/10/12' },
    ],
    api_connections: {
      financials: { connected: true, lastSync: '1404/10/19', status: 'warning' },
      analytics: { connected: true, lastSync: '1404/10/20', status: 'healthy' },
      crm: { connected: true, lastSync: '1404/10/18', status: 'healthy' },
    },
    pivot_history: []
  }
];

interface Chapter3MonitoringProps {
  analyses: UnicornAnalysis[];
  onRefresh: () => void;
  loading: boolean;
}

const Chapter3Monitoring = ({ analyses, onRefresh, loading }: Chapter3MonitoringProps) => {
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [killSwitchEnabled, setKillSwitchEnabled] = useState<Record<string, boolean>>({});

  // Combine real and demo data
  const allCompanies = analyses.length > 0 ? analyses : demoCompanies as UnicornAnalysis[];
  const selectedData = allCompanies.find(c => c.id === selectedCompany);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'warning': return <Bell className="w-4 h-4 text-amber-400" />;
      default: return <Activity className="w-4 h-4 text-blue-400" />;
    }
  };

  const getConnectionStatus = (status: string) => {
    switch (status) {
      case 'healthy': return <Badge className="bg-emerald-500/20 text-emerald-400">سالم</Badge>;
      case 'warning': return <Badge className="bg-amber-500/20 text-amber-400">هشدار</Badge>;
      default: return <Badge className="bg-secondary text-muted-foreground">قطع</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Chapter Info Banner */}
      <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
              <Eye className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-foreground mb-1">مانیتورینگ عصبی و Kill Switch</h2>
              <p className="text-muted-foreground text-sm mb-3">
                نظارت مداوم بر سلامت یونیکورن‌ها با سیستم هشدار هوشمند و قابلیت توقف اضطراری.
                اتصال API برای دریافت داده‌های مالی و تحلیلی در لحظه.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-amber-500/50 text-amber-400">
                  {allCompanies.length} یونیکورن تحت نظارت
                </Badge>
                <Badge variant="outline" className="border-red-500/50 text-red-400">
                  {allCompanies.filter(a => (a.health_alerts as any)?.some((h: any) => h.type === 'critical')).length} هشدار بحرانی
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Company List */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="font-semibold text-foreground">یونیکورن‌ها</h3>
          {allCompanies.map((company) => {
            const alerts = (company.health_alerts as any) || [];
            const criticalCount = alerts.filter((a: any) => a.type === 'critical').length;
            
            return (
              <motion.div
                key={company.id}
                whileHover={{ scale: 1.02 }}
                className="cursor-pointer"
                onClick={() => setSelectedCompany(company.id)}
              >
                <Card className={`transition-colors ${
                  selectedCompany === company.id ? 'border-primary' : 'hover:border-primary/50'
                } ${criticalCount > 0 ? 'border-red-500/50' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${
                        criticalCount > 0 ? 'from-red-500 to-rose-500' : 'from-amber-500 to-orange-500'
                      } flex items-center justify-center`}>
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
                          {criticalCount > 0 && (
                            <Badge className="bg-red-500/20 text-red-400 text-xs">
                              {criticalCount} بحرانی
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedData ? (
            <Card className="border-dashed h-full">
              <CardContent className="py-12 text-center">
                <Eye className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">یک یونیکورن انتخاب کنید</h3>
                <p className="text-muted-foreground text-sm">
                  برای مشاهده وضعیت سلامت و هشدارها، روی یک شرکت کلیک کنید.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Health Overview */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{selectedData.company_name}</CardTitle>
                    <div className="flex items-center gap-4">
                      <Button variant="outline" size="sm">
                        <RefreshCw className="w-4 h-4 ml-2" />
                        بروزرسانی
                      </Button>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Kill Switch</span>
                        <Switch
                          checked={killSwitchEnabled[selectedData.id] || false}
                          onCheckedChange={(checked) => 
                            setKillSwitchEnabled(prev => ({ ...prev, [selectedData.id]: checked }))
                          }
                        />
                        <Power className={`w-5 h-5 ${
                          killSwitchEnabled[selectedData.id] ? 'text-red-400' : 'text-muted-foreground'
                        }`} />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">U-Score</p>
                      <p className={`text-2xl font-bold ${
                        (selectedData.u_score || 0) >= 80 ? 'text-emerald-400' :
                        (selectedData.u_score || 0) >= 60 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {selectedData.u_score}
                      </p>
                    </div>
                    <div className="flex-1">
                      <Progress value={selectedData.u_score || 0} className="h-3" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Alerts */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    هشدارهای سلامت
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {((selectedData.health_alerts as any) || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      هشداری وجود ندارد
                    </p>
                  ) : (
                    ((selectedData.health_alerts as any) || []).map((alert: any, i: number) => (
                      <div key={i} className={`p-3 rounded-lg border ${
                        alert.type === 'critical' ? 'border-red-500/50 bg-red-500/5' :
                        alert.type === 'warning' ? 'border-amber-500/50 bg-amber-500/5' :
                        'border-blue-500/50 bg-blue-500/5'
                      }`}>
                        <div className="flex items-start gap-3">
                          {getAlertIcon(alert.type)}
                          <div className="flex-1">
                            <p className="text-sm text-foreground">{alert.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">{alert.date}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* API Connections */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Plug className="w-5 h-5" />
                    اتصالات API
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {Object.entries((selectedData.api_connections as any) || {}).map(([key, value]: [string, any]) => (
                      <Card key={key} className="bg-secondary/30">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-foreground capitalize">{key}</span>
                            {getConnectionStatus(value.status)}
                          </div>
                          {value.lastSync && (
                            <p className="text-xs text-muted-foreground">
                              آخرین همگام‌سازی: {value.lastSync}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Pivot History */}
              {((selectedData.pivot_history as any) || []).length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Zap className="w-5 h-5" />
                      تاریخچه پیوت
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {((selectedData.pivot_history as any) || []).map((pivot: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg border border-border bg-secondary/30">
                        <div className="flex items-center gap-3">
                          {pivot.impact === 'positive' ? (
                            <TrendingUp className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <TrendingDown className="w-5 h-5 text-red-400" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm text-foreground">
                              <span className="text-muted-foreground">از:</span> {pivot.from}
                              <span className="mx-2">→</span>
                              <span className="text-muted-foreground">به:</span> {pivot.to}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">{pivot.date}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chapter3Monitoring;
