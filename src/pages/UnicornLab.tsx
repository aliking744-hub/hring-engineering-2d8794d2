import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import UnicornLabLayout from "@/components/unicorn-lab/UnicornLabLayout";

export interface StartupProfile {
  // Identity
  companyName: string;
  companyUrl: string;
  linkedinUrl: string;
  foundersBio: string;
  // Evidence
  pitchDeckUrl?: string;
  financialsUrl?: string;
  employeesListUrl?: string;
  // Claims
  currentValuation: number;
  monthlyActiveUsers: number;
  burnRate: number;
}

export interface AnalysisResult {
  uScore: number;
  financialHealth: {
    grossMargin: number;
    burnRate: number;
    runway: number;
    healthGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  };
  founderGrit: {
    resilience: number;
    experience: number;
    adaptability: number;
    networkStrength: number;
    overallScore: number;
  };
  techViability: {
    score: number;
    aiProof: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    insights: string[];
  };
  nationalUtility: {
    dataSovereignty: boolean;
    exportReady: boolean;
    localImpact: number;
    jobCreation: number;
  };
  verdict: {
    status: 'rejected' | 'conditional' | 'approved' | 'unicorn';
    summary: string;
    recommendations: string[];
  };
}

const UnicornLab = () => {
  return (
    <>
      <Helmet>
        <title>آزمایشگاه یونیکورن | hring</title>
        <meta name="description" content="ارزیابی پیشرفته استارتاپ‌ها برای شناسایی پتانسیل یونیکورن" />
      </Helmet>

      <div className="min-h-screen bg-background" dir="rtl">
        <Navbar />
        <Link to="/dashboard" className="fixed top-24 right-6 z-50">
          <Button variant="outline" className="border-border bg-secondary/80 backdrop-blur-sm shadow-lg gap-2">
            <ArrowRight className="w-4 h-4" />
            بازگشت به داشبورد
          </Button>
        </Link>
        
        <main className="pt-20">
          <UnicornLabLayout />
        </main>
      </div>
    </>
  );
};

export default UnicornLab;
