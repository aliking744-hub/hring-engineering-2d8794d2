import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Dna, 
  Handshake,
  ArrowLeft,
  Sparkles
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import GenomicScreeningMain from "./genomic/GenomicScreeningMain";
import StrategicPartnersMain from "./partners/StrategicPartnersMain";

type ScreeningSection = 'hub' | 'genomic' | 'partners';

const GenomicScreeningHub = () => {
  const [activeSection, setActiveSection] = useState<ScreeningSection>('hub');

  const sections = [
    {
      id: 'genomic' as const,
      title: 'غربالگری ژنومیک',
      subtitle: 'Genomic Screening',
      description: 'شناسایی و ارزیابی استارتاپ‌ها با ۵ موتور تحلیل پیشرفته، اتاق بازجویی دیجیتال و دادگاه عالی هوش مصنوعی',
      icon: Dna,
      color: 'from-emerald-500 to-teal-500',
      stats: [
        { label: 'موتور تحلیل', value: '۵' },
        { label: 'شاخص ارزیابی', value: '۴۷' },
        { label: 'تست استرس', value: '۱۲' },
      ]
    },
    {
      id: 'partners' as const,
      title: 'شرکای استراتژیک',
      subtitle: 'Strategic Partners',
      description: 'مدیریت و ارزیابی شرکا، سرمایه‌گذاران و شتاب‌دهنده‌های همکار در اکوسیستم',
      icon: Handshake,
      color: 'from-violet-500 to-purple-500',
      stats: [
        { label: 'VC فعال', value: '۲۴' },
        { label: 'شتاب‌دهنده', value: '۱۲' },
        { label: 'شراکت', value: '۸' },
      ]
    }
  ];

  if (activeSection === 'genomic') {
    return <GenomicScreeningMain onBack={() => setActiveSection('hub')} />;
  }

  if (activeSection === 'partners') {
    return <StrategicPartnersMain onBack={() => setActiveSection('hub')} />;
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30 overflow-hidden relative">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50" />
        <CardContent className="p-8 relative">
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 shadow-xl">
              <Sparkles className="w-10 h-10 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                فصل ۱: غربالگری
              </h2>
              <p className="text-muted-foreground text-lg mb-4">
                مهمترین بخش سامانه یونیکورن. اینجا استارتاپ‌ها از فیلترهای سخت‌گیرانه می‌گذرند 
                و فقط بهترین‌ها به فصل ۲ راه پیدا می‌کنند.
              </p>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="px-3 py-1 bg-background/50 rounded-full text-foreground">
                  🔬 ۵ موتور تحلیل
                </div>
                <div className="px-3 py-1 bg-background/50 rounded-full text-foreground">
                  🎯 دقت ۹۰٪
                </div>
                <div className="px-3 py-1 bg-background/50 rounded-full text-foreground">
                  ⚡ تحلیل هوشمند
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {sections.map((section, index) => {
          const Icon = section.icon;
          
          return (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveSection(section.id)}
              className="cursor-pointer"
            >
              <Card className="h-full border-2 hover:border-primary/50 transition-all duration-300 overflow-hidden group">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-6">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${section.color} flex items-center justify-center flex-shrink-0 shadow-lg group-hover:shadow-xl transition-shadow`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-foreground mb-1">
                        {section.title}
                      </h3>
                      <p className="text-sm text-muted-foreground font-mono">
                        {section.subtitle}
                      </p>
                    </div>
                    <ArrowLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:-translate-x-1 transition-all" />
                  </div>
                  
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    {section.description}
                  </p>
                  
                  <div className="grid grid-cols-3 gap-3">
                    {section.stats.map((stat, i) => (
                      <div key={i} className="text-center p-3 bg-secondary/50 rounded-xl">
                        <div className={`text-2xl font-bold bg-gradient-to-br ${section.color} bg-clip-text text-transparent`}>
                          {stat.value}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {stat.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default GenomicScreeningHub;
