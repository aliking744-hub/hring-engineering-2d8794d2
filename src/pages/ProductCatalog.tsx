import { Helmet } from "react-helmet-async";

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
          .cat-table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 24px 0; }
          .cat-table th { background: #1e1b4b; padding: 14px 20px; text-align: right; font-size: 14px; color: #c4b5fd; border-bottom: 2px solid #7c3aed; }
          .cat-table td { padding: 12px 20px; border-bottom: 1px solid #1e293b; font-size: 14px; }
          .cat-table tr:nth-child(even) td { background: #0f172a80; }
          .cat-check { color: #10b981; }
          .cat-cross { color: #475569; }
          .cat-tech { display: flex; flex-wrap: wrap; gap: 12px; margin: 24px 0; }
          .cat-tag { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 8px 16px; font-size: 13px; color: #94a3b8; }
          .cat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 16px; }
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
          <p className="cat-desc">hring یک پلتفرم جامع مدیریت منابع انسانی مبتنی بر هوش مصنوعی است که تمام فرآیندهای HR را از استخدام تا تحلیل استراتژیک پوشش می‌دهد.</p>
          <div className="cat-stats">
            <div className="cat-stat"><div className="num">۱۵+</div><div className="lbl">ماژول تخصصی</div></div>
            <div className="cat-stat"><div className="num">۴</div><div className="lbl">لایه سازمانی</div></div>
            <div className="cat-stat"><div className="num">AI</div><div className="lbl">هوش مصنوعی یکپارچه</div></div>
            <div className="cat-stat"><div className="num">۲۴/۷</div><div className="lbl">دسترسی ابری</div></div>
          </div>

          <div className="cat-divider" />

          <h3 className="cat-h3">معماری ۴ لایه‌ای داشبورد</h3>
          <p className="cat-desc">سیستم در چهار لایه سازمانی طراحی شده که هر لایه ابزارهای متناسب با نقش کاربر را ارائه می‌دهد.</p>
          <div className="cat-grid">
            <div className="cat-card">
              <div className="cat-icon" style={{ background: '#7c3aed30' }}>💼</div>
              <h4>لایه ۱: میزکار هوشمند</h4>
              <p>ابزارهای روزانه HR شامل تولید شرح شغل، آگهی استخدام و دستیار مصاحبه</p>
              <span className="cat-badge cat-badge-purple">Smart Workspace</span>
            </div>
            <div className="cat-card">
              <div className="cat-icon" style={{ background: '#06b6d430' }}>👥</div>
              <h4>لایه ۲: سرمایه انسانی و عملیات</h4>
              <p>آنبوردینگ ۹۰ روزه، پروفایل‌ها و طراحی سازمان</p>
              <span className="cat-badge cat-badge-cyan">HR & Operations</span>
            </div>
            <div className="cat-card">
              <div className="cat-icon" style={{ background: '#10b98130' }}>📊</div>
              <h4>لایه ۳: پنل راهبری</h4>
              <p>داشبورد HR، هزینه‌یابی، هدهانتینگ هوشمند و ارزیابی عملکرد</p>
              <span className="cat-badge cat-badge-green">Command Center</span>
            </div>
            <div className="cat-card">
              <div className="cat-icon" style={{ background: '#f9731630' }}>🎯</div>
              <h4>لایه ۴: اتاق فرماندهی</h4>
              <p>قطب‌نمای استراتژیک، مشاور حقوقی AI و تحلیل کلان</p>
              <span className="cat-badge cat-badge-orange">Vision Deck</span>
            </div>
          </div>
        </div>

        {/* TIER 1 */}
        <div className="cat-page">
          <div className="cat-tier"><h3>🔹 لایه ۱: میزکار هوشمند <span className="en">Smart Workspace</span></h3></div>
          <div className="cat-grid">
            <div className="cat-card">
              <h4>📝 مهندسی شغل (Job Engineering)</h4>
              <p>تولید شرح شغل حرفه‌ای و استاندارد با هوش مصنوعی:</p>
              <ul className="cat-flist">
                <li>تولید خودکار شرح شغل بر اساس عنوان و صنعت</li>
                <li>تعیین مهارت‌ها، شرایط احراز و KPIها</li>
                <li>خروجی قابل دانلود و ویرایش</li>
                <li>پشتیبانی از چند زبان</li>
              </ul>
            </div>
            <div className="cat-card">
              <h4>📢 آگهی‌نویس هوشمند (Smart Ad Writer)</h4>
              <p>ایجاد آگهی‌های استخدامی جذاب و بهینه:</p>
              <ul className="cat-flist">
                <li>تولید آگهی متناسب با هر پلتفرم</li>
                <li>بهینه‌سازی تون و لحن بر اساس فرهنگ سازمانی</li>
                <li>پیشنهاد هشتگ و کلمات کلیدی</li>
              </ul>
            </div>
            <div className="cat-card">
              <h4>🎤 دستیار مصاحبه (Interview Assistant)</h4>
              <p>راهنمای جامع مصاحبه:</p>
              <ul className="cat-flist">
                <li>تولید سوالات رفتاری و فنی متناسب با شغل</li>
                <li>کارت امتیازدهی مصاحبه</li>
                <li>تحلیل پاسخ‌ها با AI</li>
              </ul>
            </div>
            <div className="cat-card">
              <h4>🎯 هدهانتینگ هوشمند (Smart Headhunting)</h4>
              <p>شناسایی و جذب استعدادها:</p>
              <ul className="cat-flist">
                <li>تحلیل چندلایه رزومه و تطبیق با شغل</li>
                <li>امتیازدهی خودکار کاندیداها</li>
                <li>شناسایی Red/Green Flags</li>
              </ul>
            </div>
          </div>
        </div>

        {/* TIER 2 */}
        <div className="cat-page">
          <div className="cat-tier"><h3>🔹 لایه ۲: سرمایه انسانی و عملیات <span className="en">HR & Operations</span></h3></div>
          <div className="cat-grid">
            <div className="cat-card">
              <h4>🚀 معمار موفقیت ۹۰ روزه (Success Architect)</h4>
              <p>برنامه جامع آنبوردینگ نیروی جدید:</p>
              <ul className="cat-flist">
                <li>برنامه‌ریزی ۹۰ روزه شخصی‌سازی‌شده</li>
                <li>تعیین اهداف هفتگی و ماهانه</li>
                <li>چک‌لیست‌های خودکار</li>
                <li>پیگیری پیشرفت و گزارش‌دهی</li>
              </ul>
            </div>
            <div className="cat-card">
              <h4>💰 محاسبه‌گر هزینه (Cost Calculator)</h4>
              <p>تحلیل دقیق هزینه‌های نیروی انسانی:</p>
              <ul className="cat-flist">
                <li>محاسبه هزینه تمام‌شده هر پوزیشن</li>
                <li>تحلیل مزایا و بیمه</li>
                <li>پیش‌بینی بودجه سالانه</li>
              </ul>
            </div>
          </div>
        </div>

        {/* TIER 3 */}
        <div className="cat-page">
          <div className="cat-tier"><h3>🔹 لایه ۳: پنل راهبری <span className="en">Command Center</span></h3></div>
          <div className="cat-card" style={{ marginBottom: 24 }}>
            <h4>📊 داشبورد منابع انسانی (HR Dashboard)</h4>
            <p>داشبورد تحلیلی جامع با قابلیت آپلود اکسل:</p>
            <ul className="cat-flist">
              <li><strong>نمای کلی:</strong> KPIهای کلیدی، نمودار ترکیب نیروی انسانی</li>
              <li><strong>تحلیل حقوق:</strong> توزیع حقوق، مقایسه واحدها</li>
              <li><strong>اضافه‌کاری:</strong> تحلیل اضافه‌کاری به تفکیک واحد و ماه</li>
              <li><strong>نقشه سازمانی:</strong> نمایش جغرافیایی پراکندگی نیروها</li>
              <li><strong>پروفایل کارکنان:</strong> جستجو و مشاهده جزئیات هر فرد</li>
              <li><strong>تقویم تولدها:</strong> یادآوری تولد کارکنان</li>
              <li><strong>خروجی PDF:</strong> گزارش‌گیری حرفه‌ای</li>
            </ul>
          </div>
        </div>

        {/* TIER 4 */}
        <div className="cat-page">
          <div className="cat-tier"><h3>🔹 لایه ۴: اتاق فرماندهی <span className="en">Vision Deck</span></h3></div>
          <div className="cat-grid">
            <div className="cat-card">
              <h4>🧭 قطب‌نمای استراتژیک (Strategic Compass)</h4>
              <p>سیستم مدیریت استراتژیک:</p>
              <ul className="cat-flist">
                <li>تعریف نیت‌های استراتژیک</li>
                <li>ماژول رفتار و ثبت عملکرد</li>
                <li>ژورنال تصمیم (Decision Journal)</li>
                <li>منشور ذهنی AI (Mental Prism)</li>
                <li>شرط‌بندی استراتژیک</li>
                <li>درخت Erdtree — نمایش سه‌بعدی پیشرفت</li>
              </ul>
            </div>
            <div className="cat-card">
              <h4>⚖️ مشاور حقوقی AI (Legal Advisor)</h4>
              <p>چت‌بات حقوقی تخصصی قانون کار:</p>
              <ul className="cat-flist">
                <li>پاسخ‌گویی بر اساس قانون کار و تأمین اجتماعی</li>
                <li>استناد به مواد قانونی با لینک منبع</li>
                <li>سازنده لایحه دفاعیه</li>
                <li>دستیار شکایت کارگری</li>
              </ul>
            </div>
          </div>
        </div>

        {/* STRATEGIC RADAR */}
        <div className="cat-page">
          <div className="cat-tier"><h3>🛰️ رادار اطلاعات استراتژیک <span className="en">Strategic Intelligence Radar</span></h3></div>
          <p className="cat-desc">سیستم جمع‌آوری و تحلیل اطلاعات رقابتی به‌صورت real-time با AI و جستجوی وب.</p>
          <div className="cat-grid">
            <div className="cat-card"><h4>📍 موقعیت بازار</h4><p>تحلیل جایگاه شرکت در نمودار NExTT</p></div>
            <div className="cat-card"><h4>🌍 روندهای جهانی</h4><p>شناسایی ترندهای صنعت و فرصت‌های نوظهور</p></div>
            <div className="cat-card"><h4>⚔️ تشریح رقبا + SWOT</h4><p>تحلیل عمیق رقبا</p></div>
            <div className="cat-card"><h4>💎 ردیاب سرمایه‌گذاری</h4><p>رصد فاندینگ و ارزش‌گذاری رقبا</p></div>
            <div className="cat-card"><h4>🔗 نقشه زنجیره ارزش</h4><p>تحلیل زنجیره ارزش و شکاف‌ها</p></div>
            <div className="cat-card"><h4>🖥️ مقایسه Tech Stack</h4><p>بررسی فناوری‌های رقبا</p></div>
            <div className="cat-card"><h4>🔔 هشدارهای بازار</h4><p>اعلان‌های فوری تغییرات</p></div>
            <div className="cat-card"><h4>📰 مانیتور روزانه</h4><p>اخبار لحظه‌ای صنعت</p></div>
          </div>
        </div>

        {/* UNICORN LAB */}
        <div className="cat-page">
          <div className="cat-tier"><h3>🦄 آزمایشگاه یونیکورن <span className="en">Unicorn Lab</span></h3></div>
          <p className="cat-desc">پلتفرم ارزیابی پتانسیل یونیکورنی استارتاپ‌ها با تحلیل عمیق AI.</p>
          <div className="cat-card">
            <ul className="cat-flist">
              <li><strong>فصل ۱ — غربالگری ژنومیک:</strong> ورود اطلاعات، کشف خودکار، تحلیل عمیق</li>
              <li><strong>فصل ۲ — جهش:</strong> شبیه‌سازی بحران، مقایسه با الگوهای موفق</li>
              <li><strong>فصل ۳ — مانیتورینگ:</strong> رصد مستمر سلامت استارتاپ</li>
              <li><strong>U-Score:</strong> امتیاز جامع پتانسیل یونیکورنی (۰-۱۰۰)</li>
              <li><strong>وب رادار:</strong> اسکن وب برای جمع‌آوری اطلاعات</li>
            </ul>
          </div>
        </div>

        {/* ADDITIONAL + SECURITY */}
        <div className="cat-page">
          <h2 className="cat-h2">🔧 امکانات جانبی</h2>
          <div className="cat-grid">
            <div className="cat-card"><h4>🛒 فروشگاه دیجیتال</h4><p>بازارچه محصولات HR — قالب‌ها، چک‌لیست‌ها و منابع آموزشی</p></div>
            <div className="cat-card"><h4>📝 وبلاگ</h4><p>سیستم مدیریت محتوا با SEO</p></div>
            <div className="cat-card"><h4>💬 چت‌بات پشتیبانی</h4><p>پشتیبانی ۲۴ ساعته با AI</p></div>
            <div className="cat-card"><h4>🔔 سیستم اعلان‌ها</h4><p>نوتیفیکیشن‌های هوشمند</p></div>
            <div className="cat-card"><h4>👤 پروفایل کاربری</h4><p>مدیریت اطلاعات و تنظیمات</p></div>
            <div className="cat-card"><h4>🏢 مدیریت شرکت</h4><p>پنل مالتی‌تنانت — اعضا، نقش‌ها، دعوت‌نامه</p></div>
          </div>
          <div className="cat-divider" />
          <h2 className="cat-h2">🔐 امنیت و زیرساخت</h2>
          <div className="cat-grid">
            <div className="cat-card"><h4>Row Level Security</h4><p>هر کاربر فقط به داده‌های خود دسترسی دارد</p></div>
            <div className="cat-card"><h4>رمزنگاری End-to-End</h4><p>تمام ارتباطات رمزنگاری می‌شوند</p></div>
            <div className="cat-card"><h4>احراز هویت چندلایه</h4><p>ایمیل + OTP</p></div>
            <div className="cat-card"><h4>Audit Logs</h4><p>ثبت تمام فعالیت‌ها</p></div>
          </div>
        </div>

        {/* PRICING + TECH */}
        <div className="cat-page">
          <h2 className="cat-h2">💎 پلن‌های اشتراک</h2>
          <table className="cat-table">
            <thead>
              <tr>
                <th>ویژگی</th><th>رایگان</th><th>اکسپرت</th><th>پرو</th><th>پلاس</th><th>سازمانی</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>شرح شغل AI</td><td className="cat-check">✓</td><td className="cat-check">✓</td><td className="cat-check">✓</td><td className="cat-check">✓</td><td className="cat-check">✓</td></tr>
              <tr><td>آگهی استخدام</td><td className="cat-cross">—</td><td className="cat-check">✓</td><td className="cat-check">✓</td><td className="cat-check">✓</td><td className="cat-check">✓</td></tr>
              <tr><td>دستیار مصاحبه</td><td className="cat-cross">—</td><td className="cat-check">✓</td><td className="cat-check">✓</td><td className="cat-check">✓</td><td className="cat-check">✓</td></tr>
              <tr><td>آنبوردینگ ۹۰ روزه</td><td className="cat-cross">—</td><td className="cat-cross">—</td><td className="cat-check">✓</td><td className="cat-check">✓</td><td className="cat-check">✓</td></tr>
              <tr><td>داشبورد HR</td><td className="cat-cross">—</td><td className="cat-cross">—</td><td className="cat-check">✓</td><td className="cat-check">✓</td><td className="cat-check">✓</td></tr>
              <tr><td>مشاور حقوقی AI</td><td className="cat-cross">—</td><td className="cat-cross">—</td><td className="cat-cross">—</td><td className="cat-check">✓</td><td className="cat-check">✓</td></tr>
              <tr><td>رادار استراتژیک</td><td className="cat-cross">—</td><td className="cat-cross">—</td><td className="cat-cross">—</td><td className="cat-cross">—</td><td className="cat-check">✓</td></tr>
              <tr><td>قطب‌نمای استراتژیک</td><td className="cat-cross">—</td><td className="cat-cross">—</td><td className="cat-cross">—</td><td className="cat-cross">—</td><td className="cat-check">✓</td></tr>
              <tr><td>یونیکورن لب</td><td className="cat-cross">—</td><td className="cat-cross">—</td><td className="cat-cross">—</td><td className="cat-cross">—</td><td className="cat-check">✓</td></tr>
              <tr><td>اعتبار ماهانه</td><td>۵</td><td>۲۰</td><td>۵۰</td><td>۱۰۰</td><td>نامحدود</td></tr>
            </tbody>
          </table>

          <div className="cat-divider" />

          <h2 className="cat-h2">🏗️ استک فناوری</h2>
          <div className="cat-tech">
            <span className="cat-tag">⚛️ React 18</span>
            <span className="cat-tag">📘 TypeScript</span>
            <span className="cat-tag">⚡ Vite</span>
            <span className="cat-tag">🎨 Tailwind CSS</span>
            <span className="cat-tag">🗄️ PostgreSQL</span>
            <span className="cat-tag">🔐 Row Level Security</span>
            <span className="cat-tag">🤖 AI Models (GPT-5, Gemini)</span>
            <span className="cat-tag">🌐 Edge Functions (Deno)</span>
            <span className="cat-tag">📊 Recharts</span>
            <span className="cat-tag">🎭 Framer Motion</span>
            <span className="cat-tag">🌲 Three.js</span>
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
