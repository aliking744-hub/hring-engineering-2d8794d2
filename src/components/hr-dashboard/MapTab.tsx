import { useState } from 'react';
import { Employee } from '@/types/employee';
import { ChartCard } from './ChartCard';
import { PrintButton, printMapPDF } from './PrintButton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users } from 'lucide-react';
import tehranMap from '@/assets/tehran-map.png';

interface MapTabProps {
  data: Employee[];
}

// Position of each region on the Tehran map (percentage-based)
const regionPositions: Record<number, { top: string; left: string }> = {
  1: { top: '12%', left: '72%' },
  2: { top: '18%', left: '45%' },
  3: { top: '12%', left: '55%' },
  4: { top: '22%', left: '82%' },
  5: { top: '22%', left: '32%' },
  6: { top: '32%', left: '48%' },
  7: { top: '32%', left: '58%' },
  8: { top: '35%', left: '72%' },
  9: { top: '45%', left: '38%' },
  10: { top: '45%', left: '48%' },
  11: { top: '45%', left: '56%' },
  12: { top: '48%', left: '65%' },
  13: { top: '38%', left: '82%' },
  14: { top: '52%', left: '78%' },
  15: { top: '62%', left: '75%' },
  16: { top: '58%', left: '55%' },
  17: { top: '55%', left: '40%' },
  18: { top: '48%', left: '15%' },
  19: { top: '68%', left: '35%' },
  20: { top: '75%', left: '62%' },
  21: { top: '38%', left: '15%' },
  22: { top: '22%', left: '15%' },
};

const COLORS = ['#1e3a5f', '#234b6e', '#2a5c7d', '#316d8c', '#387e9b', '#3f8faa', '#46a0b9', '#4db1c8'];

export function MapTab({ data }: MapTabProps) {
  const [selectedRegion, setSelectedRegion] = useState<number | null>(null);

  // Count employees per region
  const regionCounts: Record<number, number> = {};
  data.forEach(e => {
    regionCounts[e.region] = (regionCounts[e.region] || 0) + 1;
  });

  // Filter employees by selected region
  const filteredEmployees = selectedRegion
    ? data.filter(e => e.region === selectedRegion)
    : data;

  const formatNumber = (num: number) => new Intl.NumberFormat('fa-IR').format(num);

  return (
    <div className="space-y-4 print-area">
      {/* Print Button */}
      <div className="flex justify-end">
        <PrintButton title="گزارش نقشه مناطق" onPrint={() => printMapPDF(data)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" dir="rtl">
        {/* Employee List */}
        <ChartCard title={selectedRegion ? `لیست پرسنل منطقه ${formatNumber(selectedRegion)}` : "لیست تمام پرسنل"}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>تعداد: {formatNumber(filteredEmployees.length)} نفر</span>
            </div>
            {selectedRegion && (
              <button
                onClick={() => setSelectedRegion(null)}
                className="text-sm text-primary hover:text-primary/80"
              >
                نمایش همه
              </button>
            )}
          </div>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-right text-foreground">کد پرسنلی</TableHead>
                  <TableHead className="text-right text-foreground">نام و نام خانوادگی</TableHead>
                  <TableHead className="text-right text-foreground">منطقه</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.sort((a, b) => a.region - b.region).map((employee) => (
                  <TableRow key={employee.id} className="border-border hover:bg-muted/50">
                    <TableCell className="text-foreground">{employee.id}</TableCell>
                    <TableCell className="text-foreground">{employee.fullName}</TableCell>
                    <TableCell className="text-foreground">{formatNumber(employee.region)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </ChartCard>

        {/* Tehran Map */}
        <ChartCard title="نقشه پراکندگی پرسنل در مناطق تهران">
          <div className="relative w-full rounded-lg overflow-hidden">
            <img 
              src={tehranMap} 
              alt="نقشه تهران" 
              className="w-full h-auto"
            />
            
            {/* Region Labels */}
            {Object.entries(regionPositions).map(([regionStr, pos]) => {
              const regionNum = parseInt(regionStr);
              const count = regionCounts[regionNum] || 0;
              const isSelected = selectedRegion === regionNum;

              return (
                <button
                  key={regionNum}
                  onClick={() => setSelectedRegion(isSelected ? null : regionNum)}
                  className={`absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full flex flex-col items-center justify-center transition-all duration-300 ${
                    isSelected
                      ? 'bg-primary text-primary-foreground scale-125 shadow-lg shadow-primary/50 z-20'
                      : 'bg-background/90 text-foreground hover:scale-110 hover:bg-primary hover:text-primary-foreground z-10'
                  }`}
                  style={{
                    top: pos.top,
                    left: pos.left,
                    width: count > 0 ? '2.5rem' : '2rem',
                    height: count > 0 ? '2.5rem' : '2rem',
                  }}
                  title={`منطقه ${formatNumber(regionNum)} - ${formatNumber(count)} نفر`}
                >
                  <span className="font-bold text-xs">
                    {formatNumber(regionNum)}
                  </span>
                  {count > 0 && (
                    <span className="text-[10px] opacity-80">
                      ({formatNumber(count)})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Instructions */}
          <div className="mt-4 text-center bg-muted/50 px-3 py-2 rounded-lg">
            <span className="text-muted-foreground text-sm">برای مشاهده لیست پرسنل روی هر منطقه کلیک کنید</span>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
