import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BarChart3, 
  Users, 
  DollarSign, 
  MapPin,
  Filter,
  RefreshCw,
  Home,
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  Briefcase,
  Megaphone,
  UserPlus,
  FileText,
  Settings,
  Boxes,
  Gem,
  Bell,
  Search,
  PieChart
} from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import AuroraBackground from "@/components/AuroraBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { useSiteName } from "@/hooks/useSiteSettings";
import { generateSampleData } from "@/utils/sampleData";
import { Employee } from "@/types/employee";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  Tooltip,
  AreaChart,
  Area,
} from "recharts";

const sidebarItems = [
  { icon: LayoutDashboard, label: "نمای کلی", path: "/dashboard", external: false },
  { icon: BarChart3, label: "مرکز تحلیل", path: "/analytics", external: false },
  { icon: Boxes, label: "ابزارهای مدیریتی", path: "/hr-dashboard", external: false },
  { icon: Briefcase, label: "موقعیت‌های شغلی", path: "/job-description", external: false },
  { icon: Megaphone, label: "آگهی‌ها", path: "/smart-ad", external: false },
  { icon: Users, label: "مصاحبه‌ها", path: "/interviews", external: false },
  { icon: Boxes, label: "ماژولها", path: "/modules", external: false },
  { icon: UserPlus, label: "آنبوردینگ", path: "/onboarding", external: false },
  { icon: FileText, label: "مستندات", path: "/dashboard#modules", external: false },
  { icon: Settings, label: "تنظیمات", path: "/dashboard", external: false },
];

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(262, 83%, 58%)', 'hsl(330, 81%, 60%)', 'hsl(200, 80%, 50%)', 'hsl(160, 70%, 45%)'];

const AnalyticsHub = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [employees] = useState<Employee[]>(() => generateSampleData(100));
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { credits, loading: creditsLoading } = useCredits();
  const siteName = useSiteName();

  // Filter states
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [positionFilter, setPositionFilter] = useState<string>("all");

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  // Filter options derived from data
  const filterOptions = useMemo(() => ({
    departments: [...new Set(employees.map(e => e.department))],
    locations: [...new Set(employees.map(e => e.location))],
    genders: [...new Set(employees.map(e => e.gender))],
    positions: [...new Set(employees.map(e => e.position))],
  }), [employees]);

  // Filtered data
  const filteredData = useMemo(() => {
    return employees.filter(emp => {
      if (departmentFilter !== "all" && emp.department !== departmentFilter) return false;
      if (locationFilter !== "all" && emp.location !== locationFilter) return false;
      if (genderFilter !== "all" && emp.gender !== genderFilter) return false;
      if (positionFilter !== "all" && emp.position !== positionFilter) return false;
      return true;
    });
  }, [employees, departmentFilter, locationFilter, genderFilter, positionFilter]);

  // Chart data calculations
  const departmentDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(emp => {
      counts[emp.department] = (counts[emp.department] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  const genderDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(emp => {
      counts[emp.gender] = (counts[emp.gender] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  const salaryByDepartment = useMemo(() => {
    const totals: Record<string, { total: number; count: number }> = {};
    filteredData.forEach(emp => {
      if (!totals[emp.department]) {
        totals[emp.department] = { total: 0, count: 0 };
      }
      totals[emp.department].total += emp.salary;
      totals[emp.department].count += 1;
    });
    return Object.entries(totals).map(([name, data]) => ({
      name,
      average: Math.round(data.total / data.count / 1000000),
    }));
  }, [filteredData]);

  const educationDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(emp => {
      counts[emp.education] = (counts[emp.education] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  const ageGroupDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(emp => {
      counts[emp.ageGroup] = (counts[emp.ageGroup] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  const regionDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(emp => {
      counts[`منطقه ${emp.region}`] = (counts[`منطقه ${emp.region}`] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        const numA = parseInt(a.name.replace('منطقه ', ''));
        const numB = parseInt(b.name.replace('منطقه ', ''));
        return numA - numB;
      });
  }, [filteredData]);

  const resetFilters = () => {
    setDepartmentFilter("all");
    setLocationFilter("all");
    setGenderFilter("all");
    setPositionFilter("all");
  };

  const chartConfig = {
    value: { label: "تعداد", color: "hsl(var(--primary))" },
    average: { label: "میانگین حقوق (میلیون)", color: "hsl(var(--accent))" },
  };

  return (
    <div className="relative min-h-screen flex" dir="rtl">
      <AuroraBackground />

      {/* Back to Dashboard */}
      <Link to="/dashboard" className="hidden lg:block fixed top-4 right-4 z-50">
        <Button variant="outline" className="border-border bg-secondary/80 backdrop-blur-sm shadow-lg gap-2">
          <Home className="w-4 h-4" />
          بازگشت به داشبورد
        </Button>
      </Link>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="lg:hidden fixed top-4 right-4 z-50 w-12 h-12 glass-card flex items-center justify-center rounded-xl"
      >
        <Menu className="w-6 h-6 text-foreground" />
      </button>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="lg:hidden fixed top-0 right-0 bottom-0 w-72 glass-card z-50 p-4 flex flex-col overflow-y-auto"
            >
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="absolute top-4 left-4 w-10 h-10 flex items-center justify-center rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <X className="w-5 h-5 text-foreground" />
              </button>

              <Link to="/" className="text-2xl font-bold gradient-text-primary mb-4">
                {siteName}
              </Link>

              <Link 
                to="/" 
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 mb-4 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors border border-border/50"
              >
                <Home className="w-5 h-5" />
                <span className="font-medium">بازگشت به صفحه اصلی</span>
              </Link>

              <nav className="flex-1 space-y-2">
                {sidebarItems.map((item) => (
                  <Link
                    key={item.label}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-right ${
                      isActive(item.path)
                        ? "bg-primary/10 text-primary" 
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                ))}
              </nav>

              <button 
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">خروج</span>
              </button>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
      
      {/* Sidebar */}
      <motion.aside
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-64 glass-card m-4 p-4 hidden lg:flex flex-col"
      >
        <Link to="/" className="text-2xl font-bold gradient-text-primary mb-4">
          {siteName}
        </Link>

        <Link 
          to="/" 
          className="flex items-center gap-3 px-4 py-3 mb-4 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors border border-border/50"
        >
          <Home className="w-5 h-5" />
          <span className="font-medium">بازگشت به صفحه اصلی</span>
        </Link>

        <nav className="flex-1 space-y-2">
          {sidebarItems.map((item) => (
            <Link
              key={item.label}
              to={item.path}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-right ${
                isActive(item.path)
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">خروج</span>
        </button>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 p-4 lg:pr-0 pt-20 lg:pt-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="glass-card h-full p-6 overflow-auto"
        >
          {/* Header */}
          <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                <BarChart3 className="w-7 h-7 text-primary" />
                مرکز تحلیل
              </h1>
              <p className="text-muted-foreground">تحلیل جامع داده‌های منابع انسانی</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 glass-card rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
                <Gem className="w-5 h-5 text-primary" />
                <span className="font-bold text-foreground">
                  {creditsLoading ? "..." : credits}
                </span>
                <span className="text-sm text-muted-foreground">GEM</span>
              </div>
              
              <Button size="icon" variant="outline" className="relative border-border bg-secondary/50">
                <Bell className="w-5 h-5" />
              </Button>
            </div>
          </header>

          {/* Filter Bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-4 mb-6 rounded-xl"
          >
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Filter className="w-5 h-5" />
                <span className="font-medium">فیلترها:</span>
              </div>
              
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-40 bg-background/50">
                  <SelectValue placeholder="معاونت" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه معاونت‌ها</SelectItem>
                  {filterOptions.departments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-32 bg-background/50">
                  <SelectValue placeholder="محل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه</SelectItem>
                  {filterOptions.locations.map(loc => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={genderFilter} onValueChange={setGenderFilter}>
                <SelectTrigger className="w-28 bg-background/50">
                  <SelectValue placeholder="جنسیت" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه</SelectItem>
                  {filterOptions.genders.map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger className="w-32 bg-background/50">
                  <SelectValue placeholder="سمت" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه سمت‌ها</SelectItem>
                  {filterOptions.positions.map(pos => (
                    <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={resetFilters}
                className="bg-background/50"
              >
                <RefreshCw className="w-4 h-4 ml-2" />
                بازنشانی
              </Button>

              <div className="mr-auto text-sm text-muted-foreground">
                <span className="font-bold text-foreground">{filteredData.length}</span> نفر از {employees.length} کارمند
              </div>
            </div>
          </motion.div>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="glass-card p-1 w-full justify-start gap-1 flex-wrap">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <PieChart className="w-4 h-4" />
                نمای کلی
              </TabsTrigger>
              <TabsTrigger value="salary" className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                حقوق و دستمزد
              </TabsTrigger>
              <TabsTrigger value="demographics" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                دموگرافیک
              </TabsTrigger>
              <TabsTrigger value="geo" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                نقشه جغرافیایی
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Department Distribution */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="glass-card p-6 rounded-xl"
                >
                  <h3 className="text-lg font-semibold text-foreground mb-4">توزیع بر اساس معاونت</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={departmentDistribution} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis dataKey="name" type="category" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} width={100} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            color: 'hsl(var(--foreground))'
                          }}
                        />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>

                {/* Gender Distribution */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="glass-card p-6 rounded-xl"
                >
                  <h3 className="text-lg font-semibold text-foreground mb-4">توزیع جنسیتی</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={genderDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {genderDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            color: 'hsl(var(--foreground))'
                          }}
                        />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              </div>
            </TabsContent>

            {/* Salary Tab */}
            <TabsContent value="salary" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="glass-card p-6 rounded-xl"
              >
                <h3 className="text-lg font-semibold text-foreground mb-4">میانگین حقوق بر اساس معاونت (میلیون تومان)</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salaryByDepartment}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--foreground))'
                        }}
                        formatter={(value: number) => [`${value} میلیون`, 'میانگین حقوق']}
                      />
                      <Bar dataKey="average" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </TabsContent>

            {/* Demographics Tab */}
            <TabsContent value="demographics" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Education Distribution */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="glass-card p-6 rounded-xl"
                >
                  <h3 className="text-lg font-semibold text-foreground mb-4">توزیع تحصیلات</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={educationDistribution}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {educationDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            color: 'hsl(var(--foreground))'
                          }}
                        />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>

                {/* Age Group Distribution */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="glass-card p-6 rounded-xl"
                >
                  <h3 className="text-lg font-semibold text-foreground mb-4">توزیع سنی</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ageGroupDistribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            color: 'hsl(var(--foreground))'
                          }}
                        />
                        <Bar dataKey="value" fill="hsl(262, 83%, 58%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              </div>
            </TabsContent>

            {/* Geo Tab */}
            <TabsContent value="geo" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="glass-card p-6 rounded-xl"
              >
                <h3 className="text-lg font-semibold text-foreground mb-4">توزیع جغرافیایی بر اساس منطقه تهران</h3>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={regionDistribution}>
                      <defs>
                        <linearGradient id="colorRegion" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--foreground))'
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke="hsl(var(--primary))" 
                        fillOpacity={1} 
                        fill="url(#colorRegion)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
};

export default AnalyticsHub;
