import { Employee } from '@/types/employee';
import { ChartCard } from './ChartCard';
import { PrintButton, printOvertimePDF } from './PrintButton';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts';

interface OvertimeTabProps {
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

const months = ['مرداد', 'شهریور', 'مهر', 'آبان'];

export function OvertimeTab({ data }: OvertimeTabProps) {
  // Staff count and salary by month (simulated)
  const monthlyData = months.map((month, i) => {
    const factor = 0.8 + (i * 0.1);
    return {
      name: month,
      staff: Math.round(data.length * factor),
      salary: Math.round(data.reduce((sum, e) => sum + e.salary, 0) * factor / 1000000),
    };
  });

  // Overtime by department
  const deptOvertime: Record<string, { total: number; salary: number; count: number }> = {};
  data.forEach(e => {
    if (!deptOvertime[e.department]) {
      deptOvertime[e.department] = { total: 0, salary: 0, count: 0 };
    }
    deptOvertime[e.department].total += e.overtimeHours;
    deptOvertime[e.department].salary += e.salary;
    deptOvertime[e.department].count++;
  });

  const deptData = Object.entries(deptOvertime).map(([name, { total, salary, count }]) => ({
    name,
    avgOvertimeSalary: Math.round(salary / count),
    contractSalary: Math.round((salary * 0.8) / count),
    count,
  }));

  const formatNumber = (num: number) => new Intl.NumberFormat('fa-IR').format(num);

  return (
    <div className="space-y-4 md:space-y-6 print-area">
      {/* Print Button */}
      <div className="flex justify-end">
        <PrintButton title="گزارش اضافه کار" onPrint={() => printOvertimePDF(data)} />
      </div>

      {/* Monthly Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <ChartCard title="تعداد نفرات شاغل و حقوق پرداختی">
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={monthlyData}>
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 9 }} width={40} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 9 }} width={40} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                formatter={(value: number, name: string) => [
                  formatNumber(value),
                  name === 'staff' ? 'تعداد نفرات' : 'حقوق (میلیون)'
                ]}
              />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Bar yAxisId="left" dataKey="salary" name="حقوق پرداختی" radius={[4, 4, 0, 0]}>
                {monthlyData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={[COLORS.green, COLORS.cyan, COLORS.pink, COLORS.purple][index]}
                  />
                ))}
              </Bar>
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="staff"
                name="تعداد نفرات"
                stroke={COLORS.green}
                strokeWidth={2}
                dot={{ fill: COLORS.green, r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="مجموع اضافه کار پرداختی ماهانه">
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={monthlyData}>
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} width={40} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
              />
              <Line
                type="monotone"
                dataKey="salary"
                stroke={COLORS.cyan}
                strokeWidth={3}
                strokeDasharray="5 5"
                dot={{ fill: COLORS.cyan, r: 6, stroke: COLORS.cyan, strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Department Comparison */}
      <ChartCard title="مقایسه میانگین خالص پرداختی و تعداد پرسنل در هر معاونت">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={deptData}>
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} angle={-30} textAnchor="end" height={60} />
            <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 9 }} width={50} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 9 }} width={40} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
              formatter={(value: number, name: string) => [
                formatNumber(value),
                name === 'avgOvertimeSalary' ? 'میانگین حقوق پرداختی' :
                name === 'contractSalary' ? 'میانگین حقوق قراردادی' : 'تعداد کارستان'
              ]}
            />
            <Legend wrapperStyle={{ fontSize: '10px' }} />
            <Bar yAxisId="left" dataKey="avgOvertimeSalary" name="میانگین حقوق پرداختی" fill={COLORS.pink} radius={[4, 4, 0, 0]} />
            <Bar yAxisId="left" dataKey="contractSalary" name="میانگین حقوق قراردادی" fill={COLORS.cyan} radius={[4, 4, 0, 0]} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="count"
              name="تعداد کارستان"
              stroke={COLORS.purple}
              strokeWidth={2}
              dot={{ fill: COLORS.purple, r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
