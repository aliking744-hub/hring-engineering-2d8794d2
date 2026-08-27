import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Quote } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSiteSettings } from "@/hooks/useSiteSettings";

interface Testimonial {
  id: string;
  name: string;
  role: string;
  company: string;
  avatar_url: string | null;
  content: string;
  rating: number;
}

const TestimonialsSection = () => {
  const { getSetting } = useSiteSettings();
  
  const testimonialsTitle = getSetting('testimonials_title', 'نظرات');
  const testimonialsTitleHighlight = getSetting('testimonials_title_highlight', 'مشتریان');
  const testimonialsSubtitle = getSetting('testimonials_subtitle', 'بازخورد مشتریان تأییدشده HRing');
  
  const statCompanies = getSetting('stat_companies', '');
  const statCompaniesLabel = getSetting('stat_companies_label', 'شرکت فعال');
  const statHiring = getSetting('stat_hiring', '');
  const statHiringLabel = getSetting('stat_hiring_label', 'استخدام موفق');
  const statSatisfaction = getSetting('stat_satisfaction', '');
  const statSatisfactionLabel = getSetting('stat_satisfaction_label', 'رضایت مشتریان');
  const statSaving = getSetting('stat_saving', '');
  const statSavingLabel = getSetting('stat_saving_label', 'صرفه‌جویی زمان');

  const verifiedStats = [
    { value: statCompanies, label: statCompaniesLabel },
    { value: statHiring, label: statHiringLabel },
    { value: statSatisfaction, label: statSatisfactionLabel },
    { value: statSaving, label: statSavingLabel },
  ].filter((stat) => stat.value.trim() && stat.label.trim());

  const { data: testimonials, isLoading } = useQuery({
    queryKey: ["testimonials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("testimonials")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as Testimonial[];
    },
  });
  return (
    <section className="py-20 px-4" dir="rtl">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4 font-heading">
            {testimonialsTitle} <span className="gradient-text-primary">{testimonialsTitleHighlight}</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {testimonialsSubtitle}
          </p>
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="h-48 bg-card/50">
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4 mb-4" />
                  <Skeleton className="h-10 w-10 rounded-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {testimonials?.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="h-full bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <Quote className="w-8 h-8 text-primary/30 shrink-0 rotate-180" />
                    <p className="text-foreground/90 leading-relaxed">
                      {testimonial.content}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1 mb-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < testimonial.rating
                            ? "text-amber-500 fill-amber-500"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={testimonial.avatar_url || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                        {testimonial.name.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">
                        {testimonial.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {testimonial.role} در {testimonial.company}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
        )}

        {/* Only verified CMS metrics are public. */}
        {verifiedStats.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto"
        >
          {verifiedStats.map((stat, index) => (
            <div
              key={stat.label}
              className="text-center p-4 rounded-xl bg-card/30 border border-border/30"
            >
              <div className="text-2xl md:text-3xl font-bold gradient-text-primary mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </motion.div>
        )}
      </div>
    </section>
  );
};

export default TestimonialsSection;
