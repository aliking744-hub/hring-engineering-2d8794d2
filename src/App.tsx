import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { lazy, Suspense } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { SiteSettingsProvider } from "@/hooks/useSiteSettings";
import { UserContextProvider } from "@/hooks/useUserContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import SupportChatWidget from "./components/SupportChatWidget";
import PageVisibilityGate from "./components/PageVisibilityGate";
import { useSectionVisible } from "./hooks/useSectionVisible";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Shop = lazy(() => import("./pages/Shop"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const JobDescriptionGenerator = lazy(() => import("./pages/JobDescriptionGenerator"));
const SmartAdGenerator = lazy(() => import("./pages/SmartAdGenerator"));
const InterviewAssistant = lazy(() => import("./pages/InterviewAssistant"));
const OnboardingRoadmap = lazy(() => import("./pages/OnboardingRoadmap"));
const SuccessArchitect = lazy(() => import("./pages/SuccessArchitect"));
const ToolsGrid = lazy(() => import("./pages/ToolsGrid"));
const HRDashboard = lazy(() => import("./pages/HRDashboard"));
const Modules = lazy(() => import("./pages/Modules"));
const CostCalculator = lazy(() => import("./pages/CostCalculator"));
const SmartHeadhunting = lazy(() => import("./pages/SmartHeadhunting"));
const CampaignDetail = lazy(() => import("./pages/CampaignDetail"));
const CandidateDetail = lazy(() => import("./pages/CandidateDetail"));
const King744 = lazy(() => import("./pages/King744"));
const LegalSearchPage = lazy(() => import("./pages/LegalSearchPage"));
const LegalAdvisor = lazy(() => import("./pages/LegalAdvisor"));
const CompanyMembers = lazy(() => import("./pages/CompanyMembers"));
const CompanySettings = lazy(() => import("./pages/CompanySettings"));
const Upgrade = lazy(() => import("./pages/Upgrade"));
const PaymentHistory = lazy(() => import("./pages/PaymentHistory"));
const Profile = lazy(() => import("./pages/Profile"));
const AccountSecurity = lazy(() => import("./pages/AccountSecurity"));
const NotFound = lazy(() => import("./pages/NotFound"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Admin = lazy(() => import("./pages/Admin"));
const PlatformAdmin = lazy(() => import("./pages/PlatformAdmin"));
const ProductAdmin = lazy(() => import("./pages/ProductAdmin"));
const PricingAdmin = lazy(() => import("./pages/PricingAdmin"));
const IntegrationCenter = lazy(() => import("./pages/IntegrationCenter"));
const PromptRegistry = lazy(() => import("./pages/PromptRegistry"));
const ProductCatalog = lazy(() => import("./pages/ProductCatalog"));
const LearningPath = lazy(() => import("./pages/LearningPath"));
const LegalPolicy = lazy(() => import("./pages/LegalPolicy"));

const GatedSupportChat = () => {
  const visible = useSectionVisible('support_chat');
  return visible ? <SupportChatWidget /> : null;
};
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
                <Suspense fallback={<div className="min-h-screen bg-background" aria-busy="true" />}>
                <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/blog" element={<PageVisibilityGate sectionId="page_blog"><Blog /></PageVisibilityGate>} />
              <Route path="/blog/:slug" element={<PageVisibilityGate sectionId="page_blog"><BlogPost /></PageVisibilityGate>} />
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
                    <PageVisibilityGate sectionId="page_shop"><Shop /></PageVisibilityGate>
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
                    <PageVisibilityGate sectionId="page_upgrade"><Upgrade /></PageVisibilityGate>
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
                path="/security"
                element={
                  <ProtectedRoute>
                    <AccountSecurity />
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
                    <PageVisibilityGate sectionId="page_legal"><LegalAdvisor /></PageVisibilityGate>
                  </ProtectedRoute>
                } 
              />
              <Route path="/faq" element={<PageVisibilityGate sectionId="page_faq"><FAQ /></PageVisibilityGate>} />
              <Route path="/product-catalog" element={<ProductCatalog />} />
              <Route path="/terms" element={<LegalPolicy policy="terms" />} />
              <Route path="/privacy" element={<LegalPolicy policy="privacy" />} />
              <Route path="/refund-policy" element={<LegalPolicy policy="refund" />} />
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute>
                    <Admin />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/platform" 
                element={
                  <ProtectedRoute>
                    <PlatformAdmin />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/product" 
                element={
                  <ProtectedRoute>
                    <ProductAdmin />
                  </ProtectedRoute>
                } 
              />
                            <Route 
                path="/admin/pricing" 
                element={
                  <ProtectedRoute>
                    <PricingAdmin />
                  </ProtectedRoute>
                } 
              />
<Route 
                path="/admin/integrations" 
                element={
                  <ProtectedRoute>
                    <IntegrationCenter />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/prompts" 
                element={
                  <ProtectedRoute>
                    <PromptRegistry />
                  </ProtectedRoute>
                } 
              />
<Route 
                path="/learning-path" 
                element={
                  <ProtectedRoute>
                    <LearningPath />
                  </ProtectedRoute>
                } 
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
                </Routes>
                </Suspense>
                <GatedSupportChat />
              </SiteSettingsProvider>
            </UserContextProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;

