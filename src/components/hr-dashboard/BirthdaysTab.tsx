import { useState } from 'react';
import { Employee } from '@/types/employee';
import { ChartCard } from './ChartCard';
import { PrintButton, printBirthdaysPDF } from './PrintButton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BirthdaysTabProps {
  data: Employee[];
}

const persianMonths = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

const COLORS = ['#f472b6', '#fb923c', '#facc15', '#a78bfa', '#2dd4bf', '#22c55e', '#f472b6', '#fb923c', '#facc15', '#a78bfa', '#2dd4bf', '#22c55e'];

export function BirthdaysTab({ data }: BirthdaysTabProps) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const monthCounts: Record<string, number> = {};
  persianMonths.forEach(m => monthCounts[m] = 0);
  data.forEach(e => {
    if (e.birthMonth && monthCounts[e.birthMonth] !== undefined) {
      monthCounts[e.birthMonth]++;
    }
  });

  const chartData = persianMonths.map((month, i) => ({
    name: month,
    value: monthCounts[month],
    color: COLORS[i],
  }));

  const filteredEmployees = selectedMonth
    ? data.filter(e => e.birthMonth === selectedMonth)
    : data;

  return (
    <div className="space-y-4 print-area">
      {/* Print Button */}
      <div className="flex justify-end">
        <PrintButton title="گزارش تولدها" onPrint={() => printBirthdaysPDF(data)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Month Selector & Chart */}
        <div className="space-y-4">
          <ChartCard title="ماه تولد">
            <div className="grid grid-cols-6 gap-2 mb-4">
              {persianMonths.map((month) => (
                <button
                  key={month}
                  onClick={() => setSelectedMonth(selectedMonth === month ? null : month)}
                  className={`px-2 py-1.5 text-xs rounded transition-colors ${
                    selectedMonth === month
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-primary/20 text-foreground'
                  }`}
                >
                  {month}
                </button>
              ))}
            </div>
          </ChartCard>

          <ChartCard title="تعداد متولدین هرماه">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Employee List */}
        <ChartCard title={selectedMonth ? `لیست پرسنل متولد ${selectedMonth}` : 'لیست پرسنل'}>
          <ScrollArea className="h-[450px]">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-right text-muted-foreground">نام</TableHead>
                  <TableHead className="text-right text-muted-foreground">نام خانوادگی</TableHead>
                  <TableHead className="text-right text-muted-foreground">تاریخ تولد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id} className="border-border hover:bg-muted/50">
                    <TableCell className="text-foreground">{employee.name}</TableCell>
                    <TableCell className="text-foreground">{employee.lastName}</TableCell>
                    <TableCell className="text-foreground">{employee.birthDate}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </ChartCard>
      </div>
    </div>
  );
}
