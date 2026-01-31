import { useState } from "react";
import { motion } from "framer-motion";
import { 
  ArrowRight,
  Handshake,
  Building,
  TrendingUp,
  Users,
  Plus,
  Search,
  Filter,
  Star,
  ExternalLink,
  MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface StrategicPartnersMainProps {
  onBack: () => void;
}

interface Partner {
  id: string;
  name: string;
  type: 'vc' | 'accelerator' | 'corporate' | 'government';
  logo?: string;
  description: string;
  portfolio: number;
  successRate: number;
  focus: string[];
  location: string;
  status: 'active' | 'pending' | 'inactive';
}

const mockPartners: Partner[] = [
  {
    id: '1',
    name: 'شناسا',
    type: 'vc',
    description: 'صندوق سرمایه‌گذاری خطرپذیر با تمرکز بر فین‌تک و هلث‌تک',
    portfolio: 45,
    successRate: 78,
    focus: ['فین‌تک', 'هلث‌تک', 'ادتک'],
    location: 'تهران',
    status: 'active'
  },
  {
    id: '2',
    name: 'حرکت اول',
    type: 'accelerator',
    description: 'شتاب‌دهنده استارتاپی با تمرکز بر مراحل اولیه',
    portfolio: 120,
    successRate: 65,
    focus: ['همه صنایع'],
    location: 'تهران',
    status: 'active'
  },
  {
    id: '3',
    name: 'رهنما',
    type: 'vc',
    description: 'سرمایه‌گذاری در استارتاپ‌های B2B',
    portfolio: 32,
    successRate: 82,
    focus: ['SaaS', 'B2B', 'Enterprise'],
    location: 'تهران',
    status: 'active'
  },
  {
    id: '4',
    name: 'معاونت علمی',
    type: 'government',
    description: 'حمایت دولتی از شرکت‌های دانش‌بنیان',
    portfolio: 500,
    successRate: 45,
    focus: ['دانش‌بنیان', 'فناوری پیشرفته'],
    location: 'سراسر کشور',
    status: 'active'
  },
];

const partnerTypes = [
  { id: 'all', label: 'همه', icon: Users },
  { id: 'vc', label: 'سرمایه‌گذاران', icon: TrendingUp },
  { id: 'accelerator', label: 'شتاب‌دهنده‌ها', icon: Building },
  { id: 'corporate', label: 'شرکتی', icon: Handshake },
  { id: 'government', label: 'دولتی', icon: Star },
];

const StrategicPartnersMain = ({ onBack }: StrategicPartnersMainProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeType, setActiveType] = useState('all');
  const [partners] = useState<Partner[]>(mockPartners);

  const filteredPartners = partners.filter(p => {
    const matchesSearch = p.name.includes(searchQuery) || p.description.includes(searchQuery);
    const matchesType = activeType === 'all' || p.type === activeType;
    return matchesSearch && matchesType;
  });

  const getTypeBadge = (type: Partner['type']) => {
    const config = {
      vc: { label: 'سرمایه‌گذار', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
      accelerator: { label: 'شتاب‌دهنده', color: 'bg-purple-500/20 text-purple-400 border-purple-500/50' },
      corporate: { label: 'شرکتی', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' },
      government: { label: 'دولتی', color: 'bg-amber-500/20 text-amber-400 border-amber-500/50' },
    };
    return <Badge className={config[type].color}>{config[type].label}</Badge>;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-foreground">شرکای استراتژیک</h2>
            <p className="text-sm text-muted-foreground">مدیریت سرمایه‌گذاران و شتاب‌دهنده‌های همکار</p>
          </div>
        </div>
        
        <Button>
          <Plus className="w-4 h-4 ml-2" />
          افزودن شریک
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'کل شرکا', value: partners.length, color: 'from-primary to-accent' },
          { label: 'سرمایه‌گذار', value: partners.filter(p => p.type === 'vc').length, color: 'from-blue-500 to-cyan-500' },
          { label: 'شتاب‌دهنده', value: partners.filter(p => p.type === 'accelerator').length, color: 'from-purple-500 to-violet-500' },
          { label: 'دولتی', value: partners.filter(p => p.type === 'government').length, color: 'from-amber-500 to-orange-500' },
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-4 text-center">
              <div className={`text-3xl font-bold bg-gradient-to-br ${stat.color} bg-clip-text text-transparent`}>
                {stat.value}
              </div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search & Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی شرکا..."
                className="pr-10 bg-secondary/50"
              />
            </div>
            
            <div className="flex gap-2">
              {partnerTypes.map(type => (
                <Button
                  key={type.id}
                  variant={activeType === type.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveType(type.id)}
                >
                  <type.icon className="w-4 h-4 ml-1" />
                  {type.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Partners List */}
      <div className="grid gap-4">
        {filteredPartners.map((partner, index) => (
          <motion.div
            key={partner.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center flex-shrink-0 border border-border">
                    <Building className="w-8 h-8 text-muted-foreground" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-foreground">{partner.name}</h3>
                      {getTypeBadge(partner.type)}
                      <Badge variant={partner.status === 'active' ? 'default' : 'secondary'} className="mr-auto">
                        {partner.status === 'active' ? 'فعال' : 'غیرفعال'}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                      {partner.description}
                    </p>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {partner.location}
                      </span>
                      <span>پرتفوی: {partner.portfolio} شرکت</span>
                      <span>نرخ موفقیت: {partner.successRate}%</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1 max-w-[150px]">
                    {partner.focus.slice(0, 3).map((f, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {f}
                      </Badge>
                    ))}
                  </div>
                  
                  <Button variant="outline" size="sm">
                    <ExternalLink className="w-4 h-4 ml-1" />
                    جزئیات
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default StrategicPartnersMain;
