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
    AiFeatureDefinition("job_engineering.job_profile", "تولید پروفایل شغلی", "جذب و استخدام", "ساخت سند پنج‌بخشی هویت و مشخصات شغلی با ساختار استاندارد."),
    AiFeatureDefinition("compat.generate-job-profile", "تولید پروفایل شغلی (مسیر قدیمی)", "سازگاری", "مسیر قدیمی تا پایان دورهٔ بازگشت‌پذیری نگه‌داری می‌شود."),
    AiFeatureDefinition("interview.kit", "کیت مصاحبه", "جذب و استخدام", "تولید ۱۱ سؤال غیرکلیشه‌ای در چهار گروه همراه با نشانه‌های مثبت و هشدارهای ارزیابی."),
    AiFeatureDefinition("compat.generate-interview-guide", "راهنمای مصاحبه", "جذب و استخدام", "ساخت راهنمای مرحله‌به‌مرحله مصاحبه."),
    AiFeatureDefinition("compat.generate-interview-kit", "کیت مصاحبه (مسیر قدیمی)", "جذب و استخدام", "تولید مجموعه سؤال، معیار و فرم ارزیابی مصاحبه."),
    AiFeatureDefinition("development.onboarding_plan", "برنامه ورود و آنبوردینگ", "توسعه کارکنان", "ساخت برنامه ورود و شروع به کار نیروی جدید."),
    AiFeatureDefinition("development.learning_path", "مسیر یادگیری", "توسعه کارکنان", "ساخت مسیر توسعه مهارت و یادگیری شخصی‌سازی‌شده."),
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


