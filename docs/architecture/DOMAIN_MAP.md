# HRing Domain Map — Foundation 01

This map is a working decomposition of the existing product. It does not imply that each domain is already isolated in code.

| Domain | Current surfaces | Primary concerns | Refactor priority |
|---|---|---|---|
| Identity & Authentication | `Auth`, `ProtectedRoute`, `useAuth` | sessions, login/signup, OAuth, server-side auth | Critical |
| Companies & Membership | CompanyMembers, CompanySettings, `useCompany` | company tenancy, invites, member lifecycle | Critical |
| Access Control | Admin/SuperAdmin hooks, FeatureGate, permissions | RBAC, feature permissions, page visibility | Critical |
| Credits & Billing | Upgrade, PaymentHistory, credits hooks, Zarinpal | balances, transactions, purchase/payment state | Critical |
| Smart Headhunting | SmartHeadhunting, CampaignDetail, CandidateDetail, campaigns hook, auto-headhunt | external search, job state, candidate persistence | Critical / first reference module candidate |
| Job Engineering | JobDescriptionGenerator | job-profile generation and persistence | High |
| Smart Advertising | SmartAdGenerator | ad generation / AI contract | Medium |
| Interview | InterviewAssistant | interview kit/guide generation | High |
| Onboarding & Learning | OnboardingRoadmap, LearningPath | plans, records, email delivery | Medium |
| HR Data & Analytics | HRDashboard, AnalyticsHub, CostCalculator | uploads, employee analytics, reports | High |
| Legal Intelligence | LegalSearchPage, LegalAdvisor, legal components | document search, legal chat, defense/complaint tools | High |
| Strategic Compass | StrategicCompass and components | intents, bets, behaviors, journals, achievements | Medium |
| Strategic Radar | StrategicRadar and components | web research and strategic analyses | Medium |
| Unicorn Lab | UnicornLab and components | screening, analysis, web radar | Medium |
| Digital Products | Shop, ProductCatalog | catalog, purchase/download access | Medium |
| Notifications & Support | NotificationsDropdown, SupportChatWidget | notifications, support logs, chat | Medium |
| Administration / Control Center | Admin and admin components | users, companies, credits, permissions, content, logs | High |
| AI & External Integrations | Supabase Edge Functions, Firecrawl, Perplexity, Gemini/other models | provider abstraction, prompts/contracts, failures, costs | Critical cross-cutting |

## Cross-Domain Rules
- Identity, tenant membership, access control, credits/billing, audit, and AI-provider access are shared platform capabilities. Domain modules must consume them through stable interfaces rather than duplicating rules.
- UI pages should not become the authoritative place for security, billing, or persistence decisions.
- Every future extraction must document inbound callers, outbound dependencies, data tables, Edge Functions, external providers, and authorization checks.

## Initial Refactoring Sequence
1. Engineering safety and baselines (Foundation 01)
2. Test/CI foundation
3. Define shared service/adapter conventions
4. Smart Headhunting as the first end-to-end reference extraction
5. Apply the established pattern incrementally to other domains
6. Extract backend/API boundaries only where the risk/benefit justifies it
