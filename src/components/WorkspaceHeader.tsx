import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

interface WorkspaceHeaderProps {
  title: string;
  subtitle: string;
  icon: ReactNode;
  className?: string;
}

export default function WorkspaceHeader({ title, subtitle, icon, className = "" }: WorkspaceHeaderProps) {
  return (
    <header className={`border-b border-border/60 bg-background/90 px-4 py-5 backdrop-blur no-print ${className}`} dir="rtl">
      <div className="container mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
            {icon}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold sm:text-2xl">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <img src={logo} alt="HRing" className="hidden h-10 w-10 object-contain sm:block" />
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/dashboard">
              <ArrowRight className="h-4 w-4" />
              <span className="hidden sm:inline">بازگشت به داشبورد</span>
              <span className="sm:hidden">بازگشت</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
