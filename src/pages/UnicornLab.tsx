import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";
import UnicornInputWizard from "@/components/unicorn-lab/UnicornInputWizard";
import UnicornProcessing from "@/components/unicorn-lab/UnicornProcessing";
import UnicornDashboard from "@/components/unicorn-lab/UnicornDashboard";

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

type Phase = 'input' | 'processing' | 'dashboard';

const UnicornLab = () => {
  const [phase, setPhase] = useState<Phase>('input');
  const [profile, setProfile] = useState<StartupProfile | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const handleProfileSubmit = (data: StartupProfile) => {
    setProfile(data);
    setPhase('processing');
  };

  const handleProcessingComplete = (result: AnalysisResult) => {
    setAnalysisResult(result);
    setPhase('dashboard');
  };

  const handleReset = () => {
    setPhase('input');
    setProfile(null);
    setAnalysisResult(null);
  };

  return (
    <>
      <Helmet>
        <title>آزمایشگاه یونیکورن | hring</title>
        <meta name="description" content="ارزیابی پیشرفته استارتاپ‌ها برای شناسایی پتانسیل یونیکورن" />
      </Helmet>

      {/* Light Corporate Theme Background */}
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200" dir="rtl">
        <Navbar />
        
        <main className="pt-20">
          <AnimatePresence mode="wait">
            {phase === 'input' && (
              <motion.div
                key="input"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.4 }}
              >
                <UnicornInputWizard onSubmit={handleProfileSubmit} />
              </motion.div>
            )}

            {phase === 'processing' && profile && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.4 }}
              >
                <UnicornProcessing 
                  profile={profile} 
                  onComplete={handleProcessingComplete} 
                />
              </motion.div>
            )}

            {phase === 'dashboard' && analysisResult && profile && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.5 }}
              >
                <UnicornDashboard 
                  profile={profile}
                  result={analysisResult}
                  onReset={handleReset}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </>
  );
};

export default UnicornLab;
