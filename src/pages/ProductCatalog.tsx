import { Helmet } from "react-helmet-async";
import dashboardOverview from "@/assets/dashboard-overview.png";
import dashboardSalary from "@/assets/dashboard-salary.png";
import dashboardOvertime from "@/assets/dashboard-overtime.png";
import dashboardMap from "@/assets/dashboard-map.png";
import dashboardProfile from "@/assets/dashboard-profile.png";
import dashboardBirthdays from "@/assets/dashboard-birthdays.png";

const ProductCatalog = () => {
  return (
    <>
      <Helmet>
        <title>hring - کاتالوگ محصول</title>
        <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700;900&display=swap" rel="stylesheet" />
      </Helmet>
      <div dir="rtl" style={{ fontFamily: "'Vazirmatn', sans-serif", background: '#0a0e1a', color: '#e2e8f0', lineHeight: 1.8, minHeight: '100vh' }}>
        <style>{`
          .cat-page { max-width: 1000px; margin: 0 auto; padding: 60px 40px; }
          .cat-cover { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; background: linear-gradient(135deg, #0a0e1a 0%, #1a1040 50%, #0a0e1a 100%); }
          .cat-cover h1 { font-size: 72px; font-weight: 900; background: linear-gradient(135deg, #a78bfa, #7c3aed, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 16px; }
          .cat-cover .subtitle { font-size: 28px; color: #94a3b8; margin-bottom: 40px; }
          .cat-cover .tagline { font-size: 18px; color: #64748b; border: 1px solid #334155; padding: 12px 32px; border-radius: 999px; }
          .cat-cover .version { margin-top: 60px; font-size: 14px; color: #475569; }
          .cat-h2 { font-size: 32px; font-weight: 700; margin-bottom: 12px; background: linear-gradient(135deg, #a78bfa, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; display: inline-block; }
          .cat-h3 { font-size: 22px; font-weight: 700; color: #c4b5fd; margin: 24px 0 12px; }
          .cat-desc { font-size: 16px; color: #94a3b8; margin-bottom: 32px; max-width: 700px; }
          .cat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 32px 0; }
          @media (max-width: 768px) { .cat-grid { grid-template-columns: 1fr; } }
          .cat-card { background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%); border: 1px solid #334155; border-radius: 16px; padding: 28px; }
          .cat-card h4 { font-size: 18px; font-weight: 700; color: #e2e8f0; margin-bottom: 8px; }
          .cat-card p { font-size: 14px; color: #94a3b8; line-height: 1.7; }
          .cat-flist { list-style: none; padding: 0; margin: 16px 0; }
          .cat-flist li { padding: 8px 0; border-bottom: 1px solid #1e293b; display: flex; align-items: center; gap: 12px; font-size: 15px; }
          .cat-flist li::before { content: '✦'; color: #7c3aed; font-size: 12px; }
          .cat-tier { background: linear-gradient(90deg, #7c3aed20, transparent); border-right: 4px solid #7c3aed; padding: 16px 24px; border-radius: 0 12px 12px 0; margin: 40px 0 24px; }
          .cat-tier h3 { margin: 0; color: #c4b5fd; font-size: 22px; font-weight: 700; }
          .cat-tier .en { font-size: 13px; color: #64748b; font-weight: 400; }
          .cat-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 32px 0; }
          @media (max-width: 768px) { .cat-stats { grid-template-columns: repeat(2, 1fr); } }
          .cat-stat { background: #1e1b4b; border: 1px solid #334155; border-radius: 12px; padding: 20px; text-align: center; }
          .cat-stat .num { font-size: 36px; font-weight: 900; color: #a78bfa; }
          .cat-stat .lbl { font-size: 13px; color: #94a3b8; margin-top: 4px; }
          .cat-badge { display: inline-block; padding: 4px 14px; border-radius: 999px; font-size: 12px; font-weight: 500; }
          .cat-badge-purple { background: #7c3aed30; color: #a78bfa; border: 1px solid #7c3aed50; }
          .cat-badge-cyan { background: #06b6d430; color: #67e8f9; border: 1px solid #06b6d450; }
          .cat-badge-green { background: #10b98130; color: #6ee7b7; border: 1px solid #10b98150; }
          .cat-badge-orange { background: #f9731630; color: #fdba74; border: 1px solid #f9731650; }
          .cat-divider { height: 1px; background: linear-gradient(90deg, transparent, #334155, transparent); margin: 48px 0; }
          .cat-tech { display: flex; flex-wrap: wrap; gap: 12px; margin: 24px 0; }
          .cat-tag { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 8px 16px; font-size: 13px; color: #94a3b8; }
          .cat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 16px; }
          .cat-screenshot { width: 100%; border-radius: 12px; border: 1px solid #334155; margin: 24px 0; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
          .cat-screenshot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }
          @media (max-width: 768px) { .cat-screenshot-grid { grid-template-columns: 1fr; } }
          .cat-screenshot-grid img { width: 100%; border-radius: 10px; border: 1px solid #334155; box-shadow: 0 4px 16px rgba(0,0,0,0.3); }
          .cat-screenshot-label { text-align: center; font-size: 13px; color: #64748b; margin-top: 8px; }
          .cat-highlight { background: linear-gradient(135deg, #7c3aed10, #06b6d410); border: 1px solid #7c3aed30; border-radius: 16px; padding: 32px; margin: 32px 0; }
          @media print { body { background: white !important; color: #1e293b !important; } .cat-card { border-color: #e2e8f0; background: #f8fafc; } }
        `}</style>

        {/* COVER */}
        <div className="cat-cover">
          <h1>hring</h1>
          <div className="subtitle">دستیار هوشمند منابع انسانی نسل جدید</div>
          <div className="tagline">🚀 مبتنی بر هوش مصنوعی • ابری • امن</div>
          <div className="version">نسخه ۲.۰ — بهمن ۱۴۰۴</div>
        </div>

        {/* OVERVIEW */}
        <div className="cat-page">
          <h2 className="cat-h2">📋 نمای کلی سیستم</h2>
          <p className="cat-desc">
            hring یک پلتفرم جامع مدیریت منابع انسانی مبتنی بر هوش مصنوعی است که تمام فرآیندهای HR را از استخدام تا تحلیل و گزارش‌گیری پرسنلی پوشش می‌دهد.
            این سیستم به مدیران منابع انسانی کمک می‌کند تا با ابزارهای هوشمند، فرآیندهای استخدام، آنبوردینگ، تحلیل حقوق و دستمزد و مدیریت عملکرد کارکنان را بهینه‌سازی کنند.
          </p>
          <div className="cat-stats">
            <div className="cat-stat"><div className="num">۱۰+</div><div className="lbl">ماژول تخصصی HR</div></div>
            <div className="cat-stat"><div className="num">۴</div><div className="lbl">لایه سازمانی</div></div>
            <div className="cat-stat"><div className="num">AI</div><div className="lbl">هوش مصنوعی یکپارچه</div></div>
            <div className="cat-stat"><div className="num">۲۴/۷</div><div className="lbl">دسترسی ابری</div></div>
          </div>

          <div className="cat-divider" />

          <h3 className="cat-h3">معماری ۴ لایه‌ای سیستم</h3>
          <p className="cat-desc">سیستم در چهار لایه سازمانی طراحی شده که هر لایه ابزارهای متناسب با نقش کاربر را ارائه می‌دهد. از کارشناس منابع انسانی تا مدیرعامل، هر نقش ابزار مخصوص خود را دارد.</p>
          <div className="cat-grid">
            <div className="cat-card">
              <div className="cat-icon" style={{ background: '#7c3aed30' }}>💼</div>
              <h4>لایه ۱: میزکار هوشمند</h4>
              <p>ابزارهای روزانه کارشناس HR — تولید شرح شغل حرفه‌ای، نوشتن آگهی استخدامی جذاب، تولید سوالات مصاحبه و ارزیابی کاندیداها</p>
              <span className="cat-badge cat-badge-purple">Smart Workspace</span>
            </div>
            <div className="cat-card">
              <div className="cat-icon" style={{ background: '#06b6d430' }}>👥</div>
              <h4>لایه ۲: سرمایه انسانی و عملیات</h4>
              <p>برنامه آنبوردینگ ۹۰ روزه هوشمند، محاسبه هزینه تمام‌شده نیروی انسانی و مدیریت قانون کار</p>
              <span className="cat-badge cat-badge-cyan">HR Operations</span>
            </div>
            <div className="cat-card">
              <div className="cat-icon" style={{ background: '#10b98130' }}>📊</div>
              <h4>لایه ۳: پنل راهبری و تحلیل</h4>
              <p>داشبورد تحلیلی منابع انسانی با ۶ زیربخش، آپلود اکسل، نمودارهای تعاملی و خروجی PDF</p>
              <span className="cat-badge cat-badge-green">Command Center</span>
            </div>
            <div className="cat-card">
              <div className="cat-icon" style={{ background: '#f9731630' }}>⚖️</div>
              <h4>لایه ۴: مشاوره و حقوق</h4>
              <p>مشاور حقوقی AI تخصصی قانون کار ایران، سازنده لایحه دفاعیه و دستیار شکایت کارگری</p>
              <span className="cat-badge cat-badge-orange">Legal & Advisory</span>
            </div>
          </div>
        </div>

        {/* TIER 1 - DETAILED */}
        <div className="cat-page">
          <div className="cat-tier"><h3>🔹 لایه ۱: میزکار هوشمند <span className="en">Smart Workspace</span></h3></div>
          <p className="cat-desc">مجموعه ابزارهای هوشمند برای کارشناسان و مدیران منابع انسانی که فرآیندهای روزانه استخدام و جذب نیرو را از ساعت‌ها به دقیقه‌ها تبدیل می‌کند.</p>
          
          <div className="cat-card" style={{ marginBottom: 24 }}>
            <h4>📝 مهندسی شغل (Job Engineering)</h4>
            <p>تولید شرح شغل حرفه‌ای و استاندارد با هوش مصنوعی — فقط کافی‌ست عنوان شغلی و صنعت را وارد کنید:</p>
            <ul className="cat-flist">
              <li>تولید خودکار شرح وظایف بر اساس عنوان شغلی و صنعت فعالیت</li>
              <li>تعیین مهارت‌های فنی و نرم مورد نیاز</li>
              <li>شرایط احراز شغل و حداقل تجربه</li>
              <li>تعریف شاخص‌های کلیدی عملکرد (KPI)</li>
              <li>خروجی قابل دانلود، ویرایش و چاپ</li>
              <li>پشتیبانی از فارسی و انگلیسی</li>
            </ul>
          </div>

          <div className="cat-grid">
            <div className="cat-card">
              <h4>📢 آگهی‌نویس هوشمند (Smart Ad Writer)</h4>
              <p>ایجاد آگهی‌های استخدامی جذاب و متناسب با هر پلتفرم:</p>
              <ul className="cat-flist">
                <li>تولید آگهی برای لینکدین، جابینجا، جابویژن و...</li>
                <li>بهینه‌سازی لحن بر اساس فرهنگ سازمانی</li>
                <li>پیشنهاد هشتگ و کلمات کلیدی SEO</li>
                <li>قابلیت تولید آگهی در چند لحن مختلف</li>
              </ul>
            </div>
            <div className="cat-card">
              <h4>🎤 دستیار مصاحبه (Interview Assistant)</h4>
              <p>تولید خودکار پکیج کامل مصاحبه:</p>
              <ul className="cat-flist">
                <li>سوالات رفتاری (Behavioral) بر اساس مدل STAR</li>
                <li>سوالات فنی متناسب با عنوان شغلی</li>
                <li>کارت امتیازدهی (Scorecard) مصاحبه</li>
                <li>تحلیل و مقایسه پاسخ‌های کاندیداها با AI</li>
              </ul>
            </div>
          </div>

          <div className="cat-card" style={{ marginTop: 24 }}>
            <h4>🎯 هدهانتینگ هوشمند (Smart Headhunting)</h4>
            <p>سیستم جامع شناسایی و ارزیابی کاندیداها با تحلیل چندلایه AI:</p>
            <ul className="cat-flist">
              <li>آپلود رزومه (PDF) و استخراج خودکار اطلاعات</li>
              <li>تحلیل ۵ لایه‌ای: تناسب فنی، فرهنگی، تجربه، مهارت نرم و ریسک</li>
              <li>امتیازدهی ۰ تا ۱۰۰ هر کاندیدا</li>
              <li>شناسایی Red Flags (نشانه‌های هشدار) و Green Flags (نقاط قوت)</li>
              <li>تعیین «دمای کاندیدا» — داغ، گرم یا سرد</li>
              <li>توصیه نهایی AI برای هر کاندیدا</li>
            </ul>
          </div>
        </div>

        {/* TIER 2 - DETAILED */}
        <div className="cat-page">
          <div className="cat-tier"><h3>🔹 لایه ۲: سرمایه انسانی و عملیات <span className="en">HR Operations</span></h3></div>
          <p className="cat-desc">ابزارهای عملیاتی برای مدیریت چرخه حیات کارکنان، از روز اول ورود تا محاسبه هزینه‌ها و حقوق.</p>

          <div className="cat-card" style={{ marginBottom: 24 }}>
            <h4>🚀 معمار موفقیت ۹۰ روزه (Success Architect)</h4>
            <p>برنامه جامع آنبوردینگ نیروی جدید — مهم‌ترین ۹۰ روز اول حضور کارمند در سازمان:</p>
            <ul className="cat-flist">
              <li>تولید خودکار برنامه ۹۰ روزه شخصی‌سازی‌شده بر اساس نقش شغلی</li>
              <li>تقسیم‌بندی به ۳ فاز: یادگیری (۳۰ روز)، مشارکت (۶۰ روز)، عملکرد (۹۰ روز)</li>
              <li>اهداف هفتگی و ماهانه قابل پیگیری</li>
              <li>چک‌لیست‌های خودکار برای هر مرحله</li>
              <li>تعیین منتور و مسیر آموزشی</li>
              <li>گزارش پیشرفت قابل ارائه به مدیر</li>
            </ul>
          </div>

          <div className="cat-grid">
            <div className="cat-card">
              <h4>💰 محاسبه‌گر هزینه نیروی انسانی (Cost Calculator)</h4>
              <p>تحلیل دقیق و جامع هزینه‌های نیروی انسانی:</p>
              <ul className="cat-flist">
                <li>محاسبه هزینه تمام‌شده هر پوزیشن</li>
                <li>لحاظ بیمه، مالیات، عیدی، سنوات و مزایا</li>
                <li>مقایسه هزینه بین دپارتمان‌ها</li>
                <li>پیش‌بینی بودجه سالانه نیروی انسانی</li>
                <li>محاسبه مطابق قانون کار ایران</li>
              </ul>
            </div>
            <div className="cat-card">
              <h4>📋 مدیریت قانون ۷۴۴ (King 744)</h4>
              <p>ابزار مدیریت و پیگیری الزامات قانونی:</p>
              <ul className="cat-flist">
                <li>چک‌لیست الزامات قانونی کار</li>
                <li>یادآوری مهلت‌های قانونی</li>
                <li>محاسبه حق بیمه و مالیات</li>
                <li>راهنمای تنظیم قراردادهای کاری</li>
              </ul>
            </div>
          </div>
        </div>

        {/* TIER 3 - HR DASHBOARD - DETAILED WITH SCREENSHOTS */}
        <div className="cat-page">
          <div className="cat-tier"><h3>🔹 لایه ۳: داشبورد تحلیلی منابع انسانی <span className="en">HR Analytics Dashboard</span></h3></div>
          <p className="cat-desc">
            قدرتمندترین بخش سیستم — داشبورد تحلیلی جامع که با آپلود یک فایل اکسل، تمام تحلیل‌های HR را به‌صورت خودکار و بصری ارائه می‌دهد. بدون نیاز به دانش فنی، فقط اکسل پرسنلی خود را آپلود کنید.
          </p>

          <div className="cat-highlight">
            <h4 style={{ color: '#a78bfa', fontSize: 18, marginBottom: 12 }}>✨ ویژگی‌های کلیدی داشبورد</h4>
            <div className="cat-grid" style={{ margin: 0 }}>
              <div><ul className="cat-flist">
                <li>آپلود مستقیم فایل اکسل پرسنلی</li>
                <li>شناسایی خودکار ستون‌ها و داده‌ها</li>
                <li>فیلتر پیشرفته بر اساس جنسیت، تحصیلات، واحد و موقعیت</li>
              </ul></div>
              <div><ul className="cat-flist">
                <li>نمودارهای تعاملی و زنده</li>
                <li>خروجی PDF حرفه‌ای برای گزارش‌دهی</li>
                <li>۶ زیربخش تحلیلی تخصصی</li>
              </ul></div>
            </div>
          </div>

          {/* Overview Tab */}
          <h3 className="cat-h3">📊 ۱. نمای کلی (Overview)</h3>
          <p style={{ color: '#94a3b8', fontSize: 15, marginBottom: 16 }}>
            KPIهای کلیدی سازمان شامل تعداد کل کارکنان، میانگین سن، میانگین سابقه، توزیع جنسیتی و نمودار ترکیب نیروی انسانی بر اساس واحد سازمانی. این بخش یک نگاه سریع و جامع به وضعیت پرسنلی سازمان ارائه می‌دهد.
          </p>
          <img src={dashboardOverview} alt="داشبورد نمای کلی منابع انسانی" className="cat-screenshot" />
          <div className="cat-screenshot-label">نمای کلی داشبورد — KPIهای کلیدی و نمودار ترکیب نیروی انسانی</div>

          <div className="cat-divider" />

          {/* Salary Tab */}
          <h3 className="cat-h3">💰 ۲. تحلیل حقوق و دستمزد (Salary Analysis)</h3>
          <p style={{ color: '#94a3b8', fontSize: 15, marginBottom: 16 }}>
            تحلیل جامع حقوق و دستمزد شامل توزیع حقوق پایه، مقایسه بین واحدها، میانگین حقوق بر اساس سطح تحصیلات و تجربه. ابزاری ضروری برای مدیران HR جهت تصمیم‌گیری در مورد افزایش حقوق و بررسی عدالت درون‌سازمانی.
          </p>
          <img src={dashboardSalary} alt="تحلیل حقوق و دستمزد" className="cat-screenshot" />
          <div className="cat-screenshot-label">تحلیل حقوق — توزیع حقوق، مقایسه واحدها و تحلیل عدالت پرداخت</div>

          <div className="cat-divider" />

          {/* Overtime Tab */}
          <h3 className="cat-h3">⏰ ۳. تحلیل اضافه‌کاری (Overtime Analysis)</h3>
          <p style={{ color: '#94a3b8', fontSize: 15, marginBottom: 16 }}>
            بررسی دقیق ساعات اضافه‌کاری به تفکیک واحد سازمانی و ماه. شناسایی واحدهایی که بیشترین اضافه‌کاری را دارند و تحلیل روند ماهانه. این بخش به مدیران کمک می‌کند تا فشار کاری تیم‌ها را مدیریت و بهینه‌سازی کنند.
          </p>
          <img src={dashboardOvertime} alt="تحلیل اضافه‌کاری" className="cat-screenshot" />
          <div className="cat-screenshot-label">تحلیل اضافه‌کاری — نمودار ماهانه و مقایسه واحدها</div>

          <div className="cat-divider" />

          {/* Map Tab */}
          <h3 className="cat-h3">🗺️ ۴. نقشه پراکندگی نیرو (Workforce Map)</h3>
          <p style={{ color: '#94a3b8', fontSize: 15, marginBottom: 16 }}>
            نمایش جغرافیایی محل سکونت کارکنان روی نقشه تعاملی. شناسایی مناطق تمرکز نیرو، برنامه‌ریزی سرویس ایاب و ذهاب و تحلیل دسترسی به محل کار. ابزاری کلیدی برای سازمان‌هایی با نیروی پراکنده.
          </p>
          <img src={dashboardMap} alt="نقشه پراکندگی نیروی انسانی" className="cat-screenshot" />
          <div className="cat-screenshot-label">نقشه پراکندگی — توزیع جغرافیایی کارکنان</div>

          <div className="cat-divider" />

          {/* Profile Tab */}
          <h3 className="cat-h3">👤 ۵. پروفایل کارکنان (Employee Profile)</h3>
          <p style={{ color: '#94a3b8', fontSize: 15, marginBottom: 16 }}>
            جستجو و مشاهده پروفایل کامل هر کارمند شامل اطلاعات شخصی، شغلی، سابقه کاری، تحصیلات و وضعیت حقوقی. قابلیت فیلتر و جستجوی سریع برای دسترسی فوری به اطلاعات هر فرد.
          </p>
          <img src={dashboardProfile} alt="پروفایل کارکنان" className="cat-screenshot" />
          <div className="cat-screenshot-label">پروفایل کارکنان — اطلاعات جامع هر فرد</div>

          <div className="cat-divider" />

          {/* Birthdays Tab */}
          <h3 className="cat-h3">🎂 ۶. تقویم تولدها (Birthday Calendar)</h3>
          <p style={{ color: '#94a3b8', fontSize: 15, marginBottom: 16 }}>
            تقویم هوشمند تولد کارکنان با نمایش تولدهای امروز، این هفته و این ماه. ابزاری ساده ولی مؤثر برای تقویت فرهنگ سازمانی و ایجاد حس تعلق در کارکنان.
          </p>
          <img src={dashboardBirthdays} alt="تقویم تولدها" className="cat-screenshot" />
          <div className="cat-screenshot-label">تقویم تولدها — یادآوری هوشمند مناسبت‌های پرسنلی</div>
        </div>

        {/* TIER 4 - LEGAL */}
        <div className="cat-page">
          <div className="cat-tier"><h3>🔹 لایه ۴: مشاور حقوقی هوشمند <span className="en">AI Legal Advisor</span></h3></div>
          <p className="cat-desc">
            چت‌بات حقوقی تخصصی قانون کار ایران مبتنی بر هوش مصنوعی — پاسخ‌گویی فوری به سوالات حقوقی HR با استناد به مواد قانونی.
          </p>

          <div className="cat-card" style={{ marginBottom: 24 }}>
            <h4>⚖️ مشاور حقوقی AI (Legal Advisor)</h4>
            <p>سیستم پاسخ‌گویی هوشمند به سوالات حقوقی مرتبط با منابع انسانی:</p>
            <ul className="cat-flist">
              <li>پاسخ‌گویی بر اساس قانون کار جمهوری اسلامی ایران</li>
              <li>استناد دقیق به شماره ماده و بند قانونی</li>
              <li>لینک مستقیم به متن کامل قانون</li>
              <li>پشتیبانی از قانون تأمین اجتماعی</li>
              <li>تاریخچه مکالمات و ذخیره‌سازی</li>
            </ul>
          </div>

          <div className="cat-grid">
            <div className="cat-card">
              <h4>🛡️ سازنده لایحه دفاعیه (Defense Builder)</h4>
              <p>تولید خودکار لایحه دفاعیه برای دعاوی کارگر و کارفرما:</p>
              <ul className="cat-flist">
                <li>تولید لایحه دفاعیه حرفه‌ای با AI</li>
                <li>استناد به مواد قانونی مرتبط</li>
                <li>قابلیت ویرایش و شخصی‌سازی</li>
                <li>خروجی قابل چاپ و ارسال</li>
              </ul>
            </div>
            <div className="cat-card">
              <h4>📋 دستیار شکایت کارگری (Labor Complaint)</h4>
              <p>راهنمای گام‌به‌گام ثبت شکایت در مراجع قانونی:</p>
              <ul className="cat-flist">
                <li>تعیین مرجع رسیدگی مناسب</li>
                <li>تهیه فرم شکایت استاندارد</li>
                <li>راهنمای مدارک مورد نیاز</li>
                <li>پیش‌بینی نتیجه احتمالی</li>
              </ul>
            </div>
          </div>
        </div>

        {/* ADDITIONAL + SECURITY */}
        <div className="cat-page">
          <h2 className="cat-h2">🔧 امکانات جانبی</h2>
          <div className="cat-grid">
            <div className="cat-card">
              <h4>🛒 فروشگاه دیجیتال HR</h4>
              <p>بازارچه محصولات منابع انسانی — قالب‌های آماده شرح شغل، چک‌لیست‌های مصاحبه، فرم‌های ارزیابی و منابع آموزشی تخصصی HR</p>
            </div>
            <div className="cat-card">
              <h4>📝 وبلاگ تخصصی</h4>
              <p>مقالات تخصصی منابع انسانی، آخرین ترندهای HR، راهنماهای عملی و بهترین شیوه‌های مدیریت نیروی انسانی</p>
            </div>
            <div className="cat-card">
              <h4>💬 چت‌بات پشتیبانی ۲۴/۷</h4>
              <p>پشتیبانی هوشمند با AI — پاسخ‌گویی فوری به سوالات کاربران، راهنمای استفاده از سیستم و رفع مشکلات</p>
            </div>
            <div className="cat-card">
              <h4>🏢 مدیریت چندشرکتی (Multi-Tenant)</h4>
              <p>پنل مدیریت سازمانی — مدیریت اعضا، نقش‌ها و دسترسی‌ها، سیستم دعوت‌نامه و مدیریت اعتبار تیمی</p>
            </div>
          </div>

          <div className="cat-divider" />

          <h2 className="cat-h2">🔐 امنیت و حریم خصوصی</h2>
          <p className="cat-desc">امنیت داده‌های پرسنلی اولویت اول ماست. تمام اطلاعات با بالاترین استانداردهای امنیتی محافظت می‌شوند.</p>
          <div className="cat-grid">
            <div className="cat-card">
              <h4>🔒 Row Level Security (RLS)</h4>
              <p>هر کاربر و هر سازمان فقط به داده‌های خود دسترسی دارد — جداسازی کامل داده‌ها در سطح پایگاه داده</p>
            </div>
            <div className="cat-card">
              <h4>🔐 رمزنگاری End-to-End</h4>
              <p>تمام ارتباطات بین کاربر و سرور با پروتکل TLS رمزنگاری می‌شوند</p>
            </div>
            <div className="cat-card">
              <h4>🛡️ احراز هویت امن</h4>
              <p>ورود با ایمیل و رمز عبور، ورود با گوگل (OAuth 2.0) و تأیید ایمیل</p>
            </div>
            <div className="cat-card">
              <h4>📋 Audit Logs</h4>
              <p>ثبت و پیگیری تمام فعالیت‌های کاربران با جزئیات IP و زمان — قابلیت بررسی تاریخچه عملیات</p>
            </div>
          </div>
        </div>

        {/* TECH STACK */}
        <div className="cat-page">
          <h2 className="cat-h2">🏗️ زیرساخت فناوری</h2>
          <p className="cat-desc">hring با استفاده از جدیدترین فناوری‌های وب ساخته شده و بر بستر ابری اجرا می‌شود.</p>
          <div className="cat-tech">
            <span className="cat-tag">⚛️ React 18</span>
            <span className="cat-tag">📘 TypeScript</span>
            <span className="cat-tag">⚡ Vite</span>
            <span className="cat-tag">🎨 Tailwind CSS</span>
            <span className="cat-tag">🗄️ PostgreSQL</span>
            <span className="cat-tag">🔐 Row Level Security</span>
            <span className="cat-tag">🤖 AI (GPT-5 & Gemini)</span>
            <span className="cat-tag">🌐 Edge Functions (Deno)</span>
            <span className="cat-tag">📊 Recharts</span>
            <span className="cat-tag">🎭 Framer Motion</span>
          </div>
        </div>

        {/* CONTACT */}
        <div style={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '60px 40px' }}>
          <h2 className="cat-h2">🤝 آماده همکاری</h2>
          <p className="cat-desc" style={{ textAlign: 'center', marginTop: 20 }}>برای دموی اختصاصی و مشاوره رایگان با ما تماس بگیرید.</p>
          <div style={{ marginTop: 32, fontSize: 18, color: '#a78bfa' }}>🌐 hring.ir</div>
          <div style={{ marginTop: 60, textAlign: 'center', color: '#475569', fontSize: 13 }}>
            Architected by Ali Dehghani — Powered by AI<br />© hring 2026. تمامی حقوق محفوظ است.
          </div>
        </div>
      </div>
    </>
  );
};

export default ProductCatalog;
