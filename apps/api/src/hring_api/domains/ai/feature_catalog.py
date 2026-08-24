from dataclasses import dataclass


@dataclass(frozen=True)
class AiFeatureDefinition:
    feature_key: str
    display_name: str
    category: str
    description: str
    default_route: str = "primary"


AI_FEATURES = (
    AiFeatureDefinition("smart_headhunting.candidate_analysis", "تحلیل و امتیازدهی کاندیداها", "استخدام هوشمند", "تحلیل پنج‌لایه، امتیاز تطابق و پیشنهاد اقدام برای کاندیداها."),
    AiFeatureDefinition("smart_headhunting.web_enrichment", "تکمیل اطلاعات عمومی کاندیدا", "استخدام هوشمند", "جست‌وجوی اطلاعات عمومی حرفه‌ای برای غنی‌سازی تحلیل کاندیدا.", "enrichment"),
    AiFeatureDefinition("compat.generate-job-ad", "تولید آگهی شغلی", "جذب و استخدام", "ساخت متن آگهی شغلی بر اساس نیاز سازمان."),
    AiFeatureDefinition("compat.generate-smart-ad", "تولید آگهی هوشمند", "جذب و استخدام", "بهینه‌سازی آگهی شغلی برای انتشار و جذب بهتر."),
    AiFeatureDefinition("compat.generate-job-profile", "تولید پروفایل شغلی", "جذب و استخدام", "ساخت شرح و پروفایل استاندارد یک موقعیت شغلی."),
    AiFeatureDefinition("compat.generate-interview-guide", "راهنمای مصاحبه", "جذب و استخدام", "ساخت راهنمای مرحله‌به‌مرحله مصاحبه."),
    AiFeatureDefinition("compat.generate-interview-kit", "کیت مصاحبه", "جذب و استخدام", "تولید مجموعه سؤال، معیار و فرم ارزیابی مصاحبه."),
    AiFeatureDefinition("development.onboarding_plan", "برنامه ورود و آنبوردینگ", "توسعه کارکنان", "ساخت برنامه ورود و شروع به کار نیروی جدید."),
    AiFeatureDefinition("development.learning_path", "مسیر یادگیری", "توسعه کارکنان", "ساخت مسیر توسعه مهارت و یادگیری شخصی‌سازی‌شده."),
    AiFeatureDefinition("compat.generate-mental-prism", "منشور ذهنی", "توسعه کارکنان", "تحلیل و تولید خروجی منشور ذهنی."),
    AiFeatureDefinition("compat.analyze-competitor", "تحلیل رقیب", "استراتژی", "تحلیل کلی یک رقیب و موقعیت آن."),
    AiFeatureDefinition("compat.analyze-competitor-swot", "تحلیل SWOT رقیب", "استراتژی", "تحلیل نقاط قوت، ضعف، فرصت و تهدید رقیب."),
    AiFeatureDefinition("compat.analyze-global-trends", "تحلیل روندهای جهانی", "استراتژی", "تحلیل روندهای کلان و اثر آن‌ها بر کسب‌وکار."),
    AiFeatureDefinition("compat.analyze-market-position", "تحلیل جایگاه بازار", "استراتژی", "تحلیل جایگاه رقابتی شرکت در بازار."),
    AiFeatureDefinition("compat.analyze-tech-edge", "تحلیل مزیت فناوری", "استراتژی", "ارزیابی مزیت و فاصله فناوری."),
    AiFeatureDefinition("compat.analyze-value-chain", "تحلیل زنجیره ارزش", "استراتژی", "تحلیل اجزای زنجیره ارزش و نقاط اهرمی."),
    AiFeatureDefinition("compat.defense-builder", "ساخت مزیت دفاعی", "استراتژی", "پیشنهاد سازوکارهای دفاع‌پذیری و مزیت پایدار."),
    AiFeatureDefinition("compat.fetch-company-intel", "اطلاعات هوشمند شرکت", "استراتژی", "جمع‌آوری و ساختاربندی اطلاعات عمومی شرکت."),
    AiFeatureDefinition("compat.generate-strategic-recommendations", "پیشنهادهای استراتژیک", "استراتژی", "تولید پیشنهادهای قابل اقدام برای تصمیم‌گیری."),
    AiFeatureDefinition("compat.search-competitor-news", "جست‌وجوی اخبار رقبا", "استراتژی", "جست‌وجو و خلاصه‌سازی اخبار مرتبط با رقبا."),
    AiFeatureDefinition("compat.track-funding", "رصد جذب سرمایه", "استراتژی", "رصد و تحلیل رویدادهای جذب سرمایه و ارزش‌گذاری."),
    AiFeatureDefinition("compat.labor-complaint-assistant", "دستیار شکایت کار", "حقوقی", "راهنمای ساختاریافته برای موضوعات شکایت کار."),
    AiFeatureDefinition("compat.legal-advisor-chat", "مشاور حقوقی", "حقوقی", "دستیار گفت‌وگویی برای راهنمایی حقوقی عمومی."),
    AiFeatureDefinition("compat.search-legal-docs", "جست‌وجوی اسناد حقوقی", "حقوقی", "جست‌وجو و پاسخ بر پایه اسناد حقوقی."),
    AiFeatureDefinition("compat.hring-support", "دستیار پشتیبانی HRing", "پشتیبانی", "پاسخ‌گویی دستیار عمومی پشتیبانی HRing."),
)

AI_FEATURE_BY_KEY = {feature.feature_key: feature for feature in AI_FEATURES}
COMPAT_AI_FUNCTIONS = frozenset(
    feature.feature_key.removeprefix("compat.")
    for feature in AI_FEATURES
    if feature.feature_key.startswith("compat.")
) | frozenset({"generate-onboarding-plan", "generate-learning-path"})
