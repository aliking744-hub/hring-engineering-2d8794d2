import { Employee } from '@/types/employee';
import { KPICard } from './KPICard';
import { ChartCard } from './ChartCard';
import { PrintButton, printOverviewPDF } from './PrintButton';
import { Users, Building2, Banknote, Clock, Calendar } from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Area, AreaChart
} from 'recharts';

interface OverviewTabProps {
  data: Employee[];
}

const COLORS = {
  cyan: '#2dd4bf',
  pink: '#f472b6',
  purple: '#a78bfa',
  orange: '#fb923c',
  yellow: '#facc15',
  green: '#22c55e',
  blue: '#3b82f6',
};

const tooltipContentStyle = {
  backgroundColor: 'hsl(var(--chart-tooltip-bg))',
  color: 'hsl(var(--chart-tooltip-foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  direction: 'rtl' as const,
};

const tooltipTextStyle = { color: 'hsl(var(--chart-tooltip-foreground))' };

const CURRENT_PERSIAN_YEAR = 1403;

const persianToEnglish = (str: string) => str.replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)]);

function calculateAgeFromPersianDate(birthDate: string): number | null {
  if (!birthDate || birthDate.trim() === '') return null;
  const normalizedDate = persianToEnglish(birthDate);
  const parts = normalizedDate.split('/');
  if (parts.length !== 3) return null;
  const birthYear = parseInt(parts[0]);
  if (isNaN(birthYear) || birthYear < 1300 || birthYear > 1410) return null;
  const age = CURRENT_PERSIAN_YEAR - birthYear;
  return age > 0 && age < 100 ? age : null;
}

function calculateTenureFromPersianDate(hireDate: string): number | null {
  if (!hireDate || hireDate.trim() === '') return null;
  const normalizedDate = persianToEnglish(hireDate);
  const parts = normalizedDate.split('/');
  if (parts.length !== 3) return null;
  const hireYear = parseInt(parts[0]);
  if (isNaN(hireYear) || hireYear < 1350 || hireYear > CURRENT_PERSIAN_YEAR) return null;
  const tenure = CURRENT_PERSIAN_YEAR - hireYear;
  return tenure >= 0 && tenure < 60 ? tenure : null;
}

function cleanChartLabel(value: string): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function countByValue(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    const label = cleanChartLabel(value);
    if (!label) return counts;
    counts[label] = (counts[label] || 0) + 1;
    return counts;
  }, {});
}

export function OverviewTab({ data }: OverviewTabProps) {
  const totalStaff = data.length;
  const departments = [...new Set(data.map(e => e.department))].length;
  const avgSalary = Math.round(data.reduce((sum, e) => sum + e.salary, 0) / totalStaff);

  const tenures = data.map(e => calculateTenureFromPersianDate(e.employmentDate)).filter((t): t is number => t !== null);
  const avgTenureNum = tenures.length > 0
    ? (tenures.reduce((sum, t) => sum + t, 0) / tenures.length).toFixed(2)
    : '0';
  const avgTenure = avgTenureNum.toString().replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d)]);

  const ages = data.map(e => calculateAgeFromPersianDate(e.birthDate)).filter((age): age is number => age !== null);
  const avgAgeNum = ages.length > 0
    ? (ages.reduce((sum, age) => sum + age, 0) / ages.length).toFixed(2)
    : '0';
  const avgAge = avgAgeNum.toString().replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d)]);

  const genderData = [
    { name: 'مرد', value: data.filter(e => e.gender === 'مرد').length, color: COLORS.cyan },
    { name: 'زن', value: data.filter(e => e.gender === 'زن').length, color: COLORS.pink },
  ];

  const maritalData = [
    { name: 'متاهل', value: data.filter(e => e.maritalStatus === 'متاهل').length, color: COLORS.purple },
    { name: 'مجرد', value: data.filter(e => e.maritalStatus === 'مجرد').length, color: COLORS.orange },
  ];

  const locationCounts: Record<string, number> = {};
  data.forEach(e => {
    const loc = (e.location || '').trim();
    if (!loc) return;
    locationCounts[loc] = (locationCounts[loc] || 0) + 1;
  });
  const locationPalette = [COLORS.cyan, COLORS.yellow, COLORS.purple, COLORS.pink, COLORS.green, COLORS.orange, COLORS.blue];
  const locationData = Object.entries(locationCounts).map(([name, value], i) => ({
    name,
    value,
    color: locationPalette[i % locationPalette.length],
  }));

  const educationCounts: Record<string, number> = {};
  data.forEach(e => {
    educationCounts[e.education] = (educationCounts[e.education] || 0) + 1;
  });
  const educationData = Object.entries(educationCounts).map(([name, value], i) => ({
    name,
    value,
    color: Object.values(COLORS)[i % Object.values(COLORS).length],
  }));

  const ageGroupOrder = ['۲۰-۳۰', '۳۰-۴۰', '۴۰-۵۰', '۵۰+'];
  const ageGroupMapping: Record<string, string> = {
    '20-30': '۲۰-۳۰',
    '30-40': '۳۰-۴۰',
    '40-50': '۴۰-۵۰',
    '50+': '۵۰+',
  };
  const ageCounts: Record<string, number> = {};
  data.forEach(e => {
    if (e.ageGroup && e.ageGroup !== 'blank' && e.ageGroup !== '') {
      const persianAgeGroup = ageGroupMapping[e.ageGroup] || e.ageGroup;
      ageCounts[persianAgeGroup] = (ageCounts[persianAgeGroup] || 0) + 1;
    }
  });
  const ageData = ageGroupOrder.map(group => ({ name: group, value: ageCounts[group] || 0 }));

  const deptCounts: Record<string, number> = {};
  data.forEach(e => {
    deptCounts[e.department] = (deptCounts[e.department] || 0) + 1;
  });
  const deptData = Object.entries(deptCounts).map(([name, value]) => ({ name, value }));

  const posCounts: Record<string, number> = {};
  data.forEach(e => {
    posCounts[e.position] = (posCounts[e.position] || 0) + 1;
  });
  const posData = Object.entries(posCounts).map(([name, value]) => ({ name, value }));

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fa-IR').format(num);
  };

  return (
    <div className="space-y-4 md:space-y-6 print-area">
      {/* Print Button */}
      <div className="flex justify-end">
        <PrintButton title="گزارش نمای کلی" onPrint={() => printOverviewPDF(data)} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4">
        <KPICard title="تعداد معاونت" value={formatNumber(departments)} icon={Building2} color="cyan" />
        <KPICard title="تعداد پرسنل" value={formatNumber(totalStaff)} icon={Users} color="pink" />
        <KPICard title="میانگین سنی" value={String(avgAge)} icon={Calendar} color="orange" />
        <KPICard title="میانگین حقوق" value={formatNumber(avgSalary)} icon={Banknote} color="green" />
        <KPICard title="میانگین سابقه کاری" value={avgTenure} icon={Clock} color="purple" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <ChartCard title="تعداد پرسنل براساس رده سنی">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={ageData}>
              <defs>
                <linearGradient id="colorAge" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.cyan} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={COLORS.cyan} stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} width={25} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
              <Area type="monotone" dataKey="value" stroke={COLORS.cyan} fillOpacity={1} fill="url(#colorAge)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="پرسنل به تفکیک جنسیت">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={genderData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {genderData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="وضعیت تاهل">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={maritalData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {maritalData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="محل فعالیت">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={locationData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {locationData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <ChartCard title="مدرک تحصیلی">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={educationData}
                cx="50%"
                cy="40%"
                innerRadius={40}
                outerRadius={65}
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {educationData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
              <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '10px' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="توزیع پرسنل در معاونت ها">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={deptData} layout="vertical">
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 9 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} width={70} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
              <Bar dataKey="value" fill={COLORS.purple} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="پرسنل به تفکیک جایگاه شغلی">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={posData} layout="vertical">
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 9 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} width={50} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
              <Bar dataKey="value" fill={COLORS.pink} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
