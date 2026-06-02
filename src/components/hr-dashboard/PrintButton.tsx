import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PrintButtonProps {
  title?: string;
  onPrint?: () => void;
}

export function PrintButton({ title = 'گزارش داشبورد منابع انسانی', onPrint }: PrintButtonProps) {
  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handlePrint}
      className="gap-2"
    >
      <Printer className="w-4 h-4" />
      دانلود PDF
    </Button>
  );
}

// ─── Shared PDF helpers ─────────────────────────────────────────────────────

const FONT_FACE = `
  @font-face {
    font-family: 'BNazanin';
    src: url('/fonts/BNAZANIN.TTF') format('truetype');
  }
  @font-face {
    font-family: 'IRANSans';
    src: url('/fonts/IRANSansBold-Edit.ttf') format('truetype');
  }
`;

const BASE_STYLES = `
  ${FONT_FACE}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'BNazanin', 'IRANSans', Tahoma, Arial, sans-serif;
    direction: rtl;
    background: #fff;
    color: #1a1a2e;
    font-size: 13px;
  }
  @page { size: A4 portrait; margin: 12mm; }
  .page { width: 100%; }
  .pdf-header {
    background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
    color: white;
    padding: 16px 20px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .pdf-header h1 { font-size: 20px; font-weight: bold; }
  .pdf-header .date { font-size: 11px; opacity: 0.8; margin-top: 4px; }
  .pdf-header img { height: 48px; width: 48px; object-fit: contain; }
  .section-title {
    font-size: 14px;
    font-weight: bold;
    color: #1e3a5f;
    border-right: 4px solid #2563eb;
    padding-right: 10px;
    margin: 18px 0 10px;
  }
  .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; }
  .kpi-card {
    background: #f0f4ff;
    border: 1px solid #c7d7f8;
    border-radius: 8px;
    padding: 12px 8px;
    text-align: center;
  }
  .kpi-card .kpi-value { font-size: 18px; font-weight: bold; color: #1e3a5f; }
  .kpi-card .kpi-label { font-size: 10px; color: #64748b; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
  th { background: #1e3a5f; color: white; padding: 8px 10px; text-align: right; font-weight: bold; }
  td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; }
  tr:nth-child(even) td { background: #f8faff; }
  .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
  .chart-box {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px;
    background: #fafbff;
  }
  .chart-box h3 { font-size: 11px; color: #1e3a5f; font-weight: bold; margin-bottom: 8px; }
  .bar-item { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 11px; }
  .bar-label { min-width: 90px; text-align: right; color: #374151; }
  .bar-track { flex: 1; height: 16px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 4px; display: flex; align-items: center; justify-content: flex-end; padding-right: 4px; color: white; font-size: 9px; }
  .pie-legend { display: flex; flex-direction: column; gap: 6px; }
  .pie-row { display: flex; align-items: center; gap: 6px; font-size: 11px; }
  .pie-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .profile-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
  .profile-card { background: #f0f4ff; border: 1px solid #c7d7f8; border-radius: 8px; padding: 10px; text-align: center; }
  .profile-card .p-label { font-size: 10px; color: #64748b; }
  .profile-card .p-value { font-size: 13px; font-weight: bold; color: #1e3a5f; margin-top: 4px; }
  .eval-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .eval-label { min-width: 120px; font-size: 11px; color: #374151; }
  .eval-track { flex: 1; height: 18px; background: #e2e8f0; border-radius: 6px; overflow: hidden; }
  .eval-fill { height: 100%; border-radius: 6px; display: flex; align-items: center; padding: 0 8px; color: white; font-size: 10px; font-weight: bold; }
  .footer {
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;
    text-align: center;
    font-size: 10px;
    color: #94a3b8;
  }
`;

function openPrintWindow(title: string, bodyHTML: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  const persianDate = new Date().toLocaleDateString('fa-IR');
  w.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
<div class="page">
  <div class="pdf-header">
    <div>
      <div class="h1">${title}</div>
      <h1>${title}</h1>
      <div class="date">تاریخ تهیه گزارش: ${persianDate}</div>
    </div>
    <img src="/favicon.ico" alt="logo" onerror="this.style.display='none'" />
  </div>
  ${bodyHTML}
  <div class="footer">این گزارش توسط سامانه منابع انسانی hring تهیه شده است &mdash; ${persianDate}</div>
</div>
<script>
  window.onload = function() { window.print(); };
<\/script>
</body>
</html>`);
  w.document.close();
}

// Color palette
const PALETTE = ['#2563eb', '#f472b6', '#2dd4bf', '#a78bfa', '#fb923c', '#facc15', '#22c55e', '#ef4444'];

function barChart(items: { name: string; value: number }[], maxVal?: number) {
  const max = maxVal ?? Math.max(...items.map(i => i.value), 1);
  return items.map((item, i) => {
    const pct = Math.round((item.value / max) * 100);
    const color = PALETTE[i % PALETTE.length];
    return `
      <div class="bar-item">
        <div class="bar-label">${item.name}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%; background:${color};">${item.value}</div>
        </div>
      </div>`;
  }).join('');
}

function pieTable(items: { name: string; value: number }[]) {
  const total = items.reduce((s, i) => s + i.value, 0);
  return `<div class="pie-legend">${items.map((item, i) => {
    const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
    return `<div class="pie-row">
      <div class="pie-dot" style="background:${PALETTE[i % PALETTE.length]};"></div>
      <span>${item.name}</span>
      <span style="margin-right:auto;color:#64748b;">${item.value} نفر (${pct}٪)</span>
    </div>`;
  }).join('')}</div>`;
}

// ─── Tab-specific PDF generators ──────────────────────────────────────────────

import type { Employee } from '@/types/employee';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function printOverviewPDF(elementId: string) {
  const el = document.getElementById(elementId);
  if (!el) {
    console.error('Overview PDF root element not found');
    return;
  }

  // Capture the dashboard exactly as it appears
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: getComputedStyle(document.body).backgroundColor || '#0b1020',
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
  });

  // Landscape A4: 297 x 210 mm
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = 297;
  const pageH = 210;
  const margin = 6;
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2;

  // Scale image to fit entirely on one page preserving aspect ratio
  const imgRatio = canvas.width / canvas.height;
  let drawW = availW;
  let drawH = drawW / imgRatio;
  if (drawH > availH) {
    drawH = availH;
    drawW = drawH * imgRatio;
  }
  const offsetX = (pageW - drawW) / 2;
  const offsetY = (pageH - drawH) / 2;

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  pdf.addImage(imgData, 'JPEG', offsetX, offsetY, drawW, drawH);
  pdf.save(`گزارش-نمای-کلی-${new Date().toLocaleDateString('fa-IR')}.pdf`);
}



export function printBirthdaysPDF(data: Employee[]) {
  const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(n);
  const persianMonths = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  const monthCounts: Record<string, number> = {};
  persianMonths.forEach(m => monthCounts[m] = 0);
  data.forEach(e => { if (e.birthMonth && monthCounts[e.birthMonth] !== undefined) monthCounts[e.birthMonth]++; });

  const rows = data.map(e => `
    <tr>
      <td>${e.personnelCode || ''}</td>
      <td>${e.name || ''}</td>
      <td>${e.lastName || ''}</td>
      <td>${e.birthDate || ''}</td>
      <td>${e.birthMonth || ''}</td>
    </tr>`).join('');

  const body = `
    <div class="section-title">تعداد متولدین به تفکیک ماه</div>
    ${barChart(persianMonths.map(name => ({ name, value: monthCounts[name] })))}

    <div class="section-title">لیست کامل پرسنل (${fmt(data.length)} نفر)</div>
    <table>
      <thead><tr><th>کد پرسنلی</th><th>نام</th><th>نام خانوادگی</th><th>تاریخ تولد</th><th>ماه تولد</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  openPrintWindow('گزارش تولدها', body);
}

export function printSalaryPDF(data: Employee[]) {
  const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(n);

  const deptSalaries: Record<string, { total: number; count: number }> = {};
  data.forEach(e => {
    if (!deptSalaries[e.department]) deptSalaries[e.department] = { total: 0, count: 0 };
    deptSalaries[e.department].total += e.salary;
    deptSalaries[e.department].count++;
  });

  const eduSalaries: Record<string, { total: number; count: number }> = {};
  data.forEach(e => {
    if (!eduSalaries[e.education]) eduSalaries[e.education] = { total: 0, count: 0 };
    eduSalaries[e.education].total += e.salary;
    eduSalaries[e.education].count++;
  });

  const genderSalaries: Record<string, { total: number; count: number }> = {};
  data.forEach(e => {
    if (!genderSalaries[e.gender]) genderSalaries[e.gender] = { total: 0, count: 0 };
    genderSalaries[e.gender].total += e.salary;
    genderSalaries[e.gender].count++;
  });

  const deptAvgs = Object.entries(deptSalaries).map(([name, { total, count }]) => ({ name, value: Math.round(total / count) }));
  const eduAvgs = Object.entries(eduSalaries).map(([name, { total, count }]) => ({ name, value: Math.round(total / count) }));
  const genderAvgs = Object.entries(genderSalaries).map(([name, { total, count }]) => ({ name, value: Math.round(total / count) }));

  const deptRows = deptAvgs.sort((a,b) => b.value - a.value).map(d => `
    <tr><td>${d.name}</td><td>${fmt(d.value)}</td><td>${deptSalaries[d.name].count}</td></tr>`).join('');

  const body = `
    <div class="section-title">میانگین حقوق به تفکیک معاونت</div>
    ${barChart(deptAvgs.sort((a,b) => b.value - a.value))}

    <div class="chart-grid">
      <div class="chart-box">
        <h3>میانگین حقوق به تفکیک مدرک تحصیلی</h3>
        ${barChart(eduAvgs.sort((a,b) => b.value - a.value))}
      </div>
      <div class="chart-box">
        <h3>میانگین حقوق به تفکیک جنسیت</h3>
        ${pieTable(genderAvgs)}
      </div>
    </div>

    <div class="section-title">جدول تفصیلی حقوق معاونت‌ها</div>
    <table>
      <thead><tr><th>معاونت</th><th>میانگین حقوق (ریال)</th><th>تعداد پرسنل</th></tr></thead>
      <tbody>${deptRows}</tbody>
    </table>
  `;

  openPrintWindow('گزارش حقوق و دستمزد', body);
}

export function printOvertimePDF(data: Employee[]) {
  const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(n);

  const deptOvertime: Record<string, { totalHours: number; count: number }> = {};
  data.forEach(e => {
    if (!deptOvertime[e.department]) deptOvertime[e.department] = { totalHours: 0, count: 0 };
    deptOvertime[e.department].totalHours += e.overtimeHours;
    deptOvertime[e.department].count++;
  });

  const deptRows = Object.entries(deptOvertime).sort((a,b) => b[1].totalHours - a[1].totalHours).map(([name, { totalHours, count }]) => `
    <tr><td>${name}</td><td>${fmt(totalHours)}</td><td>${count}</td><td>${fmt(Math.round(totalHours / count))}</td></tr>`).join('');

  const body = `
    <div class="section-title">اضافه‌کاری به تفکیک معاونت (ساعت)</div>
    ${barChart(Object.entries(deptOvertime).sort((a,b) => b[1].totalHours - a[1].totalHours).map(([name, { totalHours }]) => ({ name, value: totalHours })))}

    <div class="section-title">جدول تفصیلی اضافه‌کاری</div>
    <table>
      <thead><tr><th>معاونت</th><th>مجموع ساعات</th><th>تعداد پرسنل</th><th>میانگین سرانه</th></tr></thead>
      <tbody>${deptRows}</tbody>
    </table>
  `;

  openPrintWindow('گزارش اضافه کار', body);
}

export function printMapPDF(data: Employee[]) {
  const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(n);

  const regionCounts: Record<number, number> = {};
  data.forEach(e => { regionCounts[e.region] = (regionCounts[e.region] || 0) + 1; });

  const regionRows = Object.entries(regionCounts).sort((a,b) => Number(a[0]) - Number(b[0])).map(([region, count]) => `
    <tr><td>منطقه ${fmt(Number(region))}</td><td>${fmt(count)}</td><td>${Math.round(count / data.length * 100)}٪</td></tr>`).join('');

  const empRows = data.sort((a,b) => a.region - b.region).map(e => `
    <tr><td>${e.personnelCode}</td><td>${e.fullName || ''}</td><td>منطقه ${fmt(e.region)}</td></tr>`).join('');

  const body = `
    <div class="section-title">پراکندگی پرسنل در مناطق تهران</div>
    ${barChart(Object.entries(regionCounts).sort((a,b) => Number(a[0]) - Number(b[0])).map(([r, v]) => ({ name: `منطقه ${r}`, value: v })))}

    <div class="section-title">جدول آماری مناطق</div>
    <table>
      <thead><tr><th>منطقه</th><th>تعداد پرسنل</th><th>درصد</th></tr></thead>
      <tbody>${regionRows}</tbody>
    </table>

    <div class="section-title">لیست پرسنل به تفکیک منطقه</div>
    <table>
      <thead><tr><th>کد پرسنلی</th><th>نام و نام خانوادگی</th><th>منطقه</th></tr></thead>
      <tbody>${empRows}</tbody>
    </table>
  `;

  openPrintWindow('گزارش نقشه پراکندگی', body);
}

export function printProfilePDF(employee: Employee) {
  const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(n);

  const evalItems = [
    { label: 'ارزیابی مدیرعامل', value: employee.managerEvaluation, color: '#f472b6' },
    { label: 'ارزیابی مدیر مستقیم', value: employee.peerEvaluation, color: '#a78bfa' },
    { label: 'ارزیابی فردی', value: employee.selfEvaluation, color: '#2dd4bf' },
    { label: 'ارزیابی معاونت', value: employee.deputyEvaluation, color: '#fb923c' },
  ];

  const criteriaItems = [
    { label: 'عملکرد', value: employee.performanceScore, color: '#f472b6' },
    { label: 'دانش و تخصص', value: employee.knowledgeScore, color: '#a78bfa' },
    { label: 'تعامل و رفتار', value: employee.behaviorScore, color: '#2dd4bf' },
    { label: 'مسئولیت و وفاداری', value: employee.responsibilityScore, color: '#fb923c' },
  ];

  const evalBars = evalItems.map(item => `
    <div class="eval-bar">
      <div class="eval-label">${item.label}</div>
      <div class="eval-track">
        <div class="eval-fill" style="width:${item.value}%; background:${item.color};">${item.value}</div>
      </div>
    </div>`).join('');

  const critBars = criteriaItems.map(item => `
    <div class="eval-bar">
      <div class="eval-label">${item.label}</div>
      <div class="eval-track">
        <div class="eval-fill" style="width:${item.value}%; background:${item.color};">${item.value}</div>
      </div>
    </div>`).join('');

  const body = `
    <div class="profile-grid">
      <div class="profile-card"><div class="p-label">کد پرسنلی</div><div class="p-value">${employee.personnelCode}</div></div>
      <div class="profile-card"><div class="p-label">نام و نام خانوادگی</div><div class="p-value">${employee.fullName || (employee.name + ' ' + employee.lastName) || '—'}</div></div>
      <div class="profile-card"><div class="p-label">جنسیت</div><div class="p-value">${employee.gender}</div></div>
      <div class="profile-card"><div class="p-label">تاریخ تولد</div><div class="p-value">${employee.birthDate}</div></div>
      <div class="profile-card"><div class="p-label">وضعیت تاهل</div><div class="p-value">${employee.maritalStatus}</div></div>
      <div class="profile-card"><div class="p-label">تعداد فرزندان</div><div class="p-value">${employee.childrenCount}</div></div>
      <div class="profile-card"><div class="p-label">مدرک تحصیلی</div><div class="p-value">${employee.education}</div></div>
      <div class="profile-card"><div class="p-label">رشته تحصیلی</div><div class="p-value">${employee.educationField}</div></div>
      <div class="profile-card"><div class="p-label">معاونت</div><div class="p-value">${employee.department}</div></div>
      <div class="profile-card"><div class="p-label">جایگاه شغلی</div><div class="p-value">${employee.position}</div></div>
      <div class="profile-card"><div class="p-label">نوع استخدام</div><div class="p-value">${employee.employmentType}</div></div>
      <div class="profile-card"><div class="p-label">تاریخ استخدام</div><div class="p-value">${employee.employmentDate}</div></div>
    </div>

    <div class="chart-grid">
      <div class="chart-box" style="background:#f0fff4;border-color:#bbf7d0;">
        <h3>امتیاز کلی ارزیابی</h3>
        <div style="text-align:center;padding:16px 0;">
          <div style="font-size:48px;font-weight:bold;color:#22c55e;">${employee.evaluationScore}</div>
          <div style="font-size:11px;color:#64748b;">از ۱۰۰</div>
        </div>
      </div>
      <div class="chart-box">
        <h3>میزان اضافه‌کاری (ساعت)</h3>
        <div style="text-align:center;padding:16px 0;">
          <div style="font-size:48px;font-weight:bold;color:#2563eb;">${fmt(employee.overtimeHours)}</div>
          <div style="font-size:11px;color:#64748b;">ساعت اضافه‌کاری</div>
        </div>
      </div>
    </div>

    <div class="chart-box" style="margin-bottom:14px;">
      <h3>ارزیابی به تفکیک امتیازدهندگان</h3>
      ${evalBars}
    </div>

    <div class="chart-box">
      <h3>ارزیابی به تفکیک معیارها</h3>
      ${critBars}
    </div>
  `;

  openPrintWindow(`پروفایل کارمند: ${employee.fullName || employee.personnelCode}`, body);
}
