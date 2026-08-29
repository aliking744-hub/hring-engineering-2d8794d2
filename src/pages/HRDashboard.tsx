import { useState, useEffect, useCallback } from 'react';
import { Employee, FilterState, TabType } from '@/types/employee';
import { FilterBar } from '@/components/hr-dashboard/FilterBar';
import { OverviewTab } from '@/components/hr-dashboard/OverviewTab';
import { BirthdaysTab } from '@/components/hr-dashboard/BirthdaysTab';
import { SalaryTab } from '@/components/hr-dashboard/SalaryTab';
import { MapTab } from '@/components/hr-dashboard/MapTab';
import { ProfileTab } from '@/components/hr-dashboard/ProfileTab';
import { OvertimeTab } from '@/components/hr-dashboard/OvertimeTab';
import { UploadPage } from '@/components/hr-dashboard/UploadPage';
import { UploadHistorySheet } from '@/components/hr-dashboard/UploadHistorySheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowRight, LayoutDashboard, Cake, Banknote, MapPin, User, Clock, RefreshCw, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AuroraBackground from '@/components/AuroraBackground';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export default function HRDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<Employee[] | null>(null);
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [restoring, setRestoring] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    gender: [],
    education: [],
    department: [],
    location: [],
    position: [],
  });
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Restore most recent upload on login
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setRestoring(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const rows = await apiRequest<Array<{ id: string }>>('/hr-dashboard/uploads');
      const latest = rows[0];
      const row = latest
        ? await apiRequest<{ id: string; data: Employee[] }>(`/hr-dashboard/uploads/${latest.id}`)
        : null;
      if (cancelled) return;
      if (row) {
        setData((row.data as unknown as Employee[]) || []);
        setCurrentUploadId(row.id);
      }
      setRestoring(false);
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  const persistUpload = useCallback(async (employees: Employee[], name: string) => {
    if (!user) return null;
    let row: { id: string };
    try {
      row = await apiRequest<{ id: string }>('/hr-dashboard/uploads', {
        method: 'POST',
        body: JSON.stringify({ name, data: employees }),
      });
    } catch {
      toast({ title: 'ذخیره نشد', description: 'بارگذاری در تاریخچه ذخیره نشد', variant: 'destructive' });
      return null;
    }
    setHistoryRefresh(k => k + 1);
    return row?.id ?? null;
  }, [user]);

  const handleDataLoaded = useCallback(async (employees: Employee[], name: string) => {
    setData(employees);
    const id = await persistUpload(employees, name);
    setCurrentUploadId(id);
  }, [persistUpload]);

  const handleLoadFromHistory = useCallback((employees: Employee[], id: string) => {
    setData(employees);
    setCurrentUploadId(id);
  }, []);

  if (authLoading || restoring) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show upload page if no data
  if (!data) {
    return (
      <UploadPage
        onDataLoaded={handleDataLoaded}
        historySlot={
          user ? (
            <UploadHistorySheet
              onLoad={handleLoadFromHistory}
              currentUploadId={currentUploadId}
              refreshKey={historyRefresh}
            />
          ) : null
        }
      />
    );
  }

  const filterOptions = {
    genders: [...new Set(data.map(e => e.gender))],
    educations: [...new Set(data.map(e => e.education))].filter(Boolean),
    departments: [...new Set(data.map(e => e.department))].filter(Boolean),
    locations: [...new Set(data.map(e => e.location))].filter(Boolean),
    positions: [...new Set(data.map(e => e.position))].filter(Boolean),
  };

  const filteredData = data.filter(e => {
    if (filters.gender.length > 0 && !filters.gender.includes(e.gender)) return false;
    if (filters.education.length > 0 && !filters.education.includes(e.education)) return false;
    if (filters.department.length > 0 && !filters.department.includes(e.department)) return false;
    if (filters.location.length > 0 && !filters.location.includes(e.location)) return false;
    if (filters.position.length > 0 && !filters.position.includes(e.position)) return false;
    return true;
  });

  const handleFilterChange = (key: keyof FilterState, value: string[]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const tabs = [
    { id: 'overview' as TabType, label: 'نمای کلی', icon: LayoutDashboard },
    { id: 'birthdays' as TabType, label: 'تولدها', icon: Cake },
    { id: 'salary' as TabType, label: 'حقوق', icon: Banknote },
    { id: 'map' as TabType, label: 'نقشه', icon: MapPin },
    { id: 'profile' as TabType, label: 'پروفایل', icon: User },
    { id: 'overtime' as TabType, label: 'اضافه کار', icon: Clock },
  ];

  return (
    <div className="relative min-h-screen" dir="rtl">
      <AuroraBackground />
      <div className="relative z-10 p-3 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-6">
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2" onClick={() => navigate('/dashboard')}>
              <ArrowRight className="h-5 w-5" />
              بازگشت به داشبورد
            </Button>
            <div>
              <h1 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">داشبورد منابع انسانی</h1>
              <p className="text-muted-foreground text-xs md:text-sm mt-1 hidden sm:block">تحلیل و گزارش‌گیری اطلاعات پرسنلی</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <UploadHistorySheet
                onLoad={handleLoadFromHistory}
                currentUploadId={currentUploadId}
                refreshKey={historyRefresh}
              />
            )}
            <Button variant="outline" size="sm" onClick={() => setData(null)} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              <span>بارگذاری مجدد</span>
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <FilterBar filters={filters} onFilterChange={handleFilterChange} options={filterOptions} />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="space-y-6">
          <TabsList className="bg-card/50 backdrop-blur-sm p-1 h-auto flex flex-wrap gap-1 justify-center border border-border">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2 px-4 py-2">
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            <OverviewTab data={filteredData} />
          </TabsContent>

          <TabsContent value="birthdays" className="mt-0">
            <BirthdaysTab data={filteredData} />
          </TabsContent>

          <TabsContent value="salary" className="mt-0">
            <SalaryTab data={filteredData} />
          </TabsContent>

          <TabsContent value="map" className="mt-0">
            <MapTab data={filteredData} />
          </TabsContent>

          <TabsContent value="profile" className="mt-0">
            <ProfileTab data={filteredData} />
          </TabsContent>

          <TabsContent value="overtime" className="mt-0">
            <OvertimeTab data={filteredData} />
          </TabsContent>
        </Tabs>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          <p>تعداد رکوردهای نمایش داده شده: {filteredData.length} از {data.length}</p>
        </div>
      </div>
    </div>
  );
}
