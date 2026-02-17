import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/hooks/useAuth";
import { SiteSettingsProvider } from "@/hooks/useSiteSettings";
import { UserContextProvider } from "@/hooks/useUserContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Shop from "./pages/Shop";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import JobDescriptionGenerator from "./pages/JobDescriptionGenerator";
import SmartAdGenerator from "./pages/SmartAdGenerator";
import InterviewAssistant from "./pages/InterviewAssistant";
import OnboardingRoadmap from "./pages/OnboardingRoadmap";
import SuccessArchitect from "./pages/SuccessArchitect";
import ToolsGrid from "./pages/ToolsGrid";
import HRDashboard from "./pages/HRDashboard";
import Modules from "./pages/Modules";
import AnalyticsHub from "./pages/AnalyticsHub";
import CostCalculator from "./pages/CostCalculator";
import SmartHeadhunting from "./pages/SmartHeadhunting";
import CampaignDetail from "./pages/CampaignDetail";
import CandidateDetail from "./pages/CandidateDetail";
import King744 from "./pages/King744";
import LegalSearchPage from "./pages/LegalSearchPage";
import LegalAdvisor from "./pages/LegalAdvisor";
import StrategicCompass from "./pages/StrategicCompass";
import StrategicRadar from "./pages/StrategicRadar";
import UnicornLab from "./pages/UnicornLab";
import CompanyMembers from "./pages/CompanyMembers";
import CompanySettings from "./pages/CompanySettings";
import Upgrade from "./pages/Upgrade";
import PaymentHistory from "./pages/PaymentHistory";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import SupportChatWidget from "./components/SupportChatWidget";
import FAQ from "./pages/FAQ";
import Admin from "./pages/Admin";
import ProductCatalog from "./pages/ProductCatalog";
const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <UserContextProvider>
              <SiteSettingsProvider>
                <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/shop" 
                element={
                  <ProtectedRoute>
                    <Shop />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/job-description" 
                element={
                  <ProtectedRoute>
                    <JobDescriptionGenerator />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/smart-ad-generator" 
                element={
                  <ProtectedRoute>
                    <SmartAdGenerator />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/interview-assistant" 
                element={
                  <ProtectedRoute>
                    <InterviewAssistant />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/onboarding" 
                element={
                  <ProtectedRoute>
                    <OnboardingRoadmap />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/success-architect" 
                element={
                  <ProtectedRoute>
                    <SuccessArchitect />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/tools" 
                element={
                  <ProtectedRoute>
                    <ToolsGrid />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/hr-dashboard" 
                element={
                  <ProtectedRoute>
                    <HRDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/modules" 
                element={
                  <ProtectedRoute>
                    <Modules />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/analytics" 
                element={
                  <ProtectedRoute>
                    <AnalyticsHub />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/cost-calculator" 
                element={
                  <ProtectedRoute>
                    <CostCalculator />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/smart-headhunting" 
                element={
                  <ProtectedRoute>
                    <SmartHeadhunting />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/campaign/:id" 
                element={
                  <ProtectedRoute>
                    <CampaignDetail />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/campaign/:campaignId/candidate/:candidateId" 
                element={
                  <ProtectedRoute>
                    <CandidateDetail />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/strategic-compass" 
                element={
                  <ProtectedRoute>
                    <StrategicCompass />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/company-members" 
                element={
                  <ProtectedRoute>
                    <CompanyMembers />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/company-settings" 
                element={
                  <ProtectedRoute>
                    <CompanySettings />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/upgrade" 
                element={
                  <ProtectedRoute>
                    <Upgrade />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/payment-history" 
                element={
                  <ProtectedRoute>
                    <PaymentHistory />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/king744" 
                element={<King744 />}
              />
              <Route 
                path="/legal-search" 
                element={
                  <ProtectedRoute>
                    <LegalSearchPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/legal-advisor" 
                element={
                  <ProtectedRoute>
                    <LegalAdvisor />
                  </ProtectedRoute>
                } 
              />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/product-catalog" element={<ProductCatalog />} />
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute>
                    <Admin />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/strategic-radar" 
                element={
                  <ProtectedRoute>
                    <StrategicRadar />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/unicorn-lab" 
                element={
                  <ProtectedRoute>
                    <UnicornLab />
                  </ProtectedRoute>
                } 
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
                </Routes>
                <SupportChatWidget />
              </SiteSettingsProvider>
            </UserContextProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
