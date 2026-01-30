import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";
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
        
        <main className="pt-20">
          <UnicornLabLayout />
        </main>
      </div>
    </>
  );
};

export default UnicornLab;
