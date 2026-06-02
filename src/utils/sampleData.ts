import { Employee } from '@/types/employee';

const persianMonths = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

const departments = ['مالی', 'فنی و اجرایی', 'برنامه ریزی و توسعه', 'بازرگانی', 'حقوقی', 'دفتر مدیرعامل'];
const positions = ['کارشناس', 'مدیر', 'معاون', 'مشاور', 'خدمات'];
const educations = ['دیپلم و زیردیپلم', 'کاردانی', 'کارشناسی', 'ارشد', 'دکترا'];
const educationFields = ['مدیریت بازرگانی', 'حسابداری', 'مهندسی عمران', 'مهندسی صنایع', 'مهندسی برق', 'حقوق', 'اقتصاد', 'مدیریت صنعتی', 'مهندسی کامپیوتر', 'معماری', 'مهندسی مکانیک', 'علوم سیاسی'];
const locations = ['پروژه', 'ستاد'];
const regions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const ageGroups = ['20-30', '30-40', '40-50', '50+'];

const firstNames = ['امیر', 'محمد', 'علی', 'حسین', 'رضا', 'مهدی', 'احمد', 'جواد', 'مسعود', 'داود', 'محمود', 'جلال', 'بهنام', 'نوید', 'سیدآرمین', 'علی اکبر'];
const femaleNames = ['زهرا', 'فاطمه', 'مریم', 'سارا', 'الهه', 'ریحانه', 'سیده فاطمه'];
const lastNames = ['پایدار', 'صفاری', 'مختاری', 'شهیدی', 'پدرامی', 'مهدوی', 'عامری', 'فرهانی', 'صبوری', 'صفری', 'حامدی', 'شادی', 'مریدی', 'کاظمی', 'تاهدی', 'مقدمی', 'میثایی', 'باقی', 'لامعی', 'نمینی', 'سعیدی', 'فدایی', 'وارسته', 'نوری', 'احسنی', 'واعظی', 'پورمند', 'کتایی'];

function randomPersianDate() {
  const year = 1350 + Math.floor(Math.random() * 30);
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;
  return `${year}/${month}/${day}`;
}

function randomEmploymentDate() {
  const year = 1395 + Math.floor(Math.random() * 8);
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;
  return `${year}/${month}/${day}`;
}

export function generateSampleData(count: number = 78): Employee[] {
  const employees: Employee[] = [];

  for (let i = 0; i < count; i++) {
    const isFemale = Math.random() > 0.8;
    const firstName = isFemale
      ? femaleNames[Math.floor(Math.random() * femaleNames.length)]
      : firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const birthDate = randomPersianDate();
    const monthIndex = parseInt(birthDate.split('/')[1]) - 1;

    const baseSalary = 100000000 + Math.random() * 200000000;

    employees.push({
      id: `emp-${i + 1}`,
      personnelCode: `${10001 + i}`,
      name: firstName,
      lastName: lastName,
      fullName: `${firstName} ${lastName}`,
      gender: isFemale ? 'زن' : 'مرد',
      birthDate: birthDate,
      birthMonth: persianMonths[monthIndex],
      education: educations[Math.floor(Math.random() * educations.length)],
      educationField: educationFields[Math.floor(Math.random() * educationFields.length)],
      maritalStatus: Math.random() > 0.3 ? 'متاهل' : 'مجرد',
      childrenCount: Math.floor(Math.random() * 4),
      department: departments[Math.floor(Math.random() * departments.length)],
      position: positions[Math.floor(Math.random() * positions.length)],
      employmentType: Math.random() > 0.5 ? 'قراردادی' : 'رسمی',
      employmentDate: randomEmploymentDate(),
      location: locations[Math.floor(Math.random() * locations.length)],
      region: regions[Math.floor(Math.random() * regions.length)],
      salary: Math.round(baseSalary),
      contractSalary: Math.round(baseSalary * 0.8),
      overtimeHours: Math.floor(Math.random() * 100),
      evaluationScore: 60 + Math.floor(Math.random() * 40),
      managerEvaluation: 15 + Math.floor(Math.random() * 10),
      selfEvaluation: 15 + Math.floor(Math.random() * 10),
      deputyEvaluation: 12 + Math.floor(Math.random() * 8),
      peerEvaluation: 10 + Math.floor(Math.random() * 10),
      performanceScore: 15 + Math.floor(Math.random() * 10),
      knowledgeScore: 12 + Math.floor(Math.random() * 8),
      behaviorScore: 10 + Math.floor(Math.random() * 10),
      responsibilityScore: 10 + Math.floor(Math.random() * 8),
      ageGroup: ageGroups[Math.floor(Math.random() * ageGroups.length)],
      tenure: 1 + Math.floor(Math.random() * 10),
    });
  }

  return employees;
}

const CURRENT_PERSIAN_YEAR = 1403;

const persianDigitsToEnglish = (str: string) =>
  str.replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])
     .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);

function cleanString(v: any): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function parsePersianDateParts(raw: string): { year: number; month: number; day: number } | null {
  if (!raw) return null;
  const normalized = persianDigitsToEnglish(raw).trim();
  const m = normalized.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (!m) return null;
  const year = parseInt(m[1]);
  const month = parseInt(m[2]);
  const day = parseInt(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function deriveBirthMonth(birthDate: string): string {
  const parts = parsePersianDateParts(birthDate);
  if (!parts) return '';
  return persianMonths[parts.month - 1] || '';
}

function deriveAgeGroup(birthDate: string): string {
  const parts = parsePersianDateParts(birthDate);
  if (!parts || parts.year < 1300 || parts.year > 1410) return '';
  const age = CURRENT_PERSIAN_YEAR - parts.year;
  if (age < 20) return '20-30';
  if (age < 30) return '20-30';
  if (age < 40) return '30-40';
  if (age < 50) return '40-50';
  return '50+';
}

export function parseExcelData(data: any[]): Employee[] {
  return data.map((row, index) => {
    const name = cleanString(row['نام'] || row['name']) || undefined;
    const lastName = cleanString(row['نام خانوادگی'] || row['lastName']) || undefined;
    const fullName = (name && lastName) ? `${name} ${lastName}` : undefined;

    const birthDate = cleanString(row['تاریخ تولد'] || row['birthDate']);
    const birthMonthRaw = cleanString(row['ماه تولد'] || row['birthMonth']);
    const birthMonth = birthMonthRaw || deriveBirthMonth(birthDate);
    const ageGroupRaw = cleanString(row['رده سنی'] || row['ageGroup']);
    const ageGroup = ageGroupRaw || deriveAgeGroup(birthDate);

    return {
      id: `emp-${index + 1}`,
      personnelCode: String(row['کد پرسنلی'] || row['personnelCode'] || `${10001 + index}`),
      name,
      lastName,
      fullName,
      gender: cleanString(row['جنسیت'] || row['gender']) || 'مرد',
      birthDate,
      birthMonth,
      education: cleanString(row['مدرک تحصیلی'] || row['education']),
      educationField: cleanString(row['رشته تحصیلی'] || row['educationField']),
      maritalStatus: cleanString(row['وضعیت تاهل'] || row['maritalStatus']),
      childrenCount: parseInt(row['تعداد فرزندان'] || row['childrenCount'] || '0') || 0,
      department: cleanString(row['معاونت'] || row['department']),
      position: cleanString(row['جایگاه شغلی'] || row['position']),
      employmentType: cleanString(row['نوع استخدام'] || row['employmentType']),
      employmentDate: cleanString(row['تاریخ استخدام'] || row['employmentDate']),
      location: cleanString(row['محل فعالیت'] || row['location']),
      region: parseInt(row['منطقه'] || row['region'] || '1') || 1,
      salary: parseFloat(row['حقوق پرداختی'] || row['salary'] || '0') || 0,
      contractSalary: parseFloat(row['حقوق قراردادی'] || row['contractSalary'] || '0') || 0,
      overtimeHours: parseFloat(row['اضافه کار'] || row['overtimeHours'] || '0') || 0,
      evaluationScore: parseFloat(row['امتیاز ارزشیابی'] || row['evaluationScore'] || '0') || 0,
      managerEvaluation: parseFloat(row['ارزیابی مدیرعامل'] || '0') || 0,
      selfEvaluation: parseFloat(row['ارزیابی فردی'] || '0') || 0,
      deputyEvaluation: parseFloat(row['ارزیابی معاونت'] || '0') || 0,
      peerEvaluation: parseFloat(row['ارزیابی مدیر مستقیم'] || '0') || 0,
      performanceScore: parseFloat(row['عملکرد'] || '0') || 0,
      knowledgeScore: parseFloat(row['دانش و تخصص'] || '0') || 0,
      behaviorScore: parseFloat(row['تعامل و رفتار'] || '0') || 0,
      responsibilityScore: parseFloat(row['مسئولیت و وفاداری'] || '0') || 0,
      ageGroup,
      tenure: parseInt(row['سابقه'] || row['tenure'] || '0') || 0,
    };
  });
}
