import { Employee } from '@/types/employee';
import { ChartCard } from './ChartCard';
import { PrintButton, printProfilePDF } from './PrintButton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useState } from 'react';

interface ProfileTabProps {
  data: Employee[];
}

const COLORS = {
  cyan: '#2dd4bf',
  pink: '#f472b6',
  purple: '#a78bfa',
  orange: '#fb923c',
  yellow: '#facc15',
  green: '#22c55e',
};

function GaugeChart({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const percentage = (value / max) * 100;
  const angle = (percentage / 100) * 180;

  return (
    <div className="relative w-full h-32 flex items-center justify-center">
      <svg viewBox="0 0 200 120" className="w-full h-full max-w-[200px]">
        {/* Background arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="15"
          strokeLinecap="round"
        />
        {/* Colored segments */}
        <path
          d="M 20 100 A 80 80 0 0 1 60 35"
          fill="none"
          stroke="#ef4444"
          strokeWidth="15"
          strokeLinecap="round"
        />
        <path
          d="M 60 35 A 80 80 0 0 1 100 20"
          fill="none"
          stroke="#fb923c"
          strokeWidth="15"
          strokeLinecap="round"
        />
        <path
          d="M 100 20 A 80 80 0 0 1 140 35"
          fill="none"
          stroke="#facc15"
          strokeWidth="15"
          strokeLinecap="round"
        />
        <path
          d="M 140 35 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#22c55e"
          strokeWidth="15"
          strokeLinecap="round"
        />

        {/* Needle */}
        <line
          x1="100"
          y1="100"
          x2={100 + 60 * Math.cos(Math.PI - (angle * Math.PI / 180))}
          y2={100 - 60 * Math.sin(Math.PI - (angle * Math.PI / 180))}
          stroke="hsl(var(--foreground))"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="100" cy="100" r="8" fill={color} />

        {/* Labels */}
        <text x="20" y="115" textAnchor="middle" fill="#94a3b8" fontSize="10">0</text>
        <text x="100" y="10" textAnchor="middle" fill="#94a3b8" fontSize="10">50</text>
        <text x="180" y="115" textAnchor="middle" fill="#94a3b8" fontSize="10">100</text>
      </svg>
      <div className="absolute bottom-0 text-2xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

export function ProfileTab({ data }: ProfileTabProps) {
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(data[0] || null);

  if (!selectedEmployee) {
    return <div className="text-center text-muted-foreground">هیچ کارمندی یافت نشد</div>;
  }

  const evaluationData = [
    { name: 'ارزیابی مدیرعامل', value: selectedEmployee.managerEvaluation, color: COLORS.pink },
    { name: 'ارزیابی مدیر مستقیم', value: selectedEmployee.peerEvaluation, color: COLORS.purple },
    { name: 'ارزیابی فردی', value: selectedEmployee.selfEvaluation, color: COLORS.cyan },
    { name: 'ارزیابی معاونت مربوطه', value: selectedEmployee.deputyEvaluation, color: COLORS.orange },
  ];

  const criteriaData = [
    { name: 'عملکرد', value: selectedEmployee.performanceScore, color: COLORS.pink },
    { name: 'دانش و تخصص', value: selectedEmployee.knowledgeScore, color: COLORS.purple },
    { name: 'تعامل و رفتار', value: selectedEmployee.behaviorScore, color: COLORS.cyan },
    { name: 'مسئولیت و وفاداری', value: selectedEmployee.responsibilityScore, color: COLORS.orange },
  ];

  const formatNumber = (num: number) => new Intl.NumberFormat('fa-IR').format(num);

  return (
    <div className="space-y-6 print-area" dir="rtl">
      {/* Print Button */}
      <div className="flex justify-start">
        <PrintButton title="گزارش پروفایل کارمند" onPrint={() => printProfilePDF(selectedEmployee)} />
      </div>

      {/* Employee Selector */}
      <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-4">
        <div className="flex items-center gap-4 justify-end">
          <label className="text-sm text-muted-foreground">کد پرسنلی:</label>
          <Select
            value={selectedEmployee.id}
            onValueChange={(value) => {
              const emp = data.find(e => e.id === value);
              if (emp) setSelectedEmployee(emp);
            }}
          >
            <SelectTrigger className="w-[200px] bg-primary text-primary-foreground border-primary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {data.map((emp) => (
                <SelectItem key={emp.id} value={emp.id} className="text-right">
                  {emp.fullName ? `${emp.fullName} - ` : ''}{emp.personnelCode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Profile Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card/50 backdrop-blur-sm border border-accent/30 rounded-lg p-4 text-center">
          <div className="text-xs text-muted-foreground mb-1">کد پرسنلی</div>
          <div className="text-lg font-bold text-pink-400">{selectedEmployee.personnelCode}</div>
        </div>
        {selectedEmployee.fullName && (
          <div className="bg-card/50 backdrop-blur-sm border border-purple-500/30 rounded-lg p-4 text-center">
            <div className="text-xs text-muted-foreground mb-1">نام و نام خانوادگی</div>
            <div className="text-lg font-bold text-purple-400">{selectedEmployee.fullName}</div>
          </div>
        )}
        <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-4 text-center">
          <div className="text-xs text-muted-foreground mb-1">تاریخ تولد</div>
          <div className="text-lg font-bold text-foreground">{selectedEmployee.birthDate}</div>
        </div>
        <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-4 text-center">
          <div className="text-xs text-muted-foreground mb-1">وضعیت تاهل</div>
          <div className="text-lg font-bold text-foreground">{selectedEmployee.maritalStatus}</div>
        </div>
        <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-4 text-center">
          <div className="text-xs text-muted-foreground mb-1">تعداد فرزندان</div>
          <div className="text-lg font-bold text-foreground">{selectedEmployee.childrenCount}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-4 text-center">
          <div className="text-xs text-muted-foreground mb-1">مدرک تحصیلی</div>
          <div className="text-sm font-bold text-foreground">{selectedEmployee.education}</div>
        </div>
        <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-4 text-center">
          <div className="text-xs text-muted-foreground mb-1">رشته تحصیلی</div>
          <div className="text-sm font-bold text-foreground">{selectedEmployee.educationField}</div>
        </div>
        <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-4 text-center">
          <div className="text-xs text-muted-foreground mb-1">معاونت</div>
          <div className="text-sm font-bold text-foreground">{selectedEmployee.department}</div>
        </div>
        <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-4 text-center">
          <div className="text-xs text-muted-foreground mb-1">جایگاه شغلی</div>
          <div className="text-sm font-bold text-foreground">{selectedEmployee.position}</div>
        </div>
        <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-4 text-center">
          <div className="text-xs text-muted-foreground mb-1">نوع استخدام</div>
          <div className="text-sm font-bold text-foreground">{selectedEmployee.employmentType}</div>
        </div>
        <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-4 text-center">
          <div className="text-xs text-muted-foreground mb-1">تاریخ استخدام</div>
          <div className="text-sm font-bold text-foreground">{selectedEmployee.employmentDate}</div>
        </div>
        <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-4 text-center col-span-2 md:col-span-1">
          <div className="text-xs text-muted-foreground mb-1">حقوق قراردادی</div>
          <div className="text-sm font-bold text-cyan-400">{formatNumber(selectedEmployee.contractSalary)}</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Gauge */}
        <ChartCard title="وضعیت ارزشیابی">
          <GaugeChart value={selectedEmployee.evaluationScore} color={COLORS.cyan} />
        </ChartCard>

        {/* Evaluation Breakdown */}
        <ChartCard title="به تفکیک امتیازدهندگان">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={evaluationData}>
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 8 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {evaluationData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Overtime */}
        <ChartCard title="میزان اضافه کاری">
          <div className="flex items-center justify-center h-[180px]">
            <div className="w-16 h-16 rounded-full bg-cyan-400 flex items-center justify-center">
              <span className="text-lg font-bold text-background">{selectedEmployee.overtimeHours}</span>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Criteria Breakdown */}
      <ChartCard title="به تفکیک معیارهای ارزیابی">
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={criteriaData}>
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {criteriaData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
