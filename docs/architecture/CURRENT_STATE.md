# HRing Current-State Architecture — Foundation 01

## Purpose
This document records the observed architecture before structural refactoring. It is a baseline, not the final target design.

## Runtime Shape

### Frontend
- React 18 + TypeScript + Vite
- React Router
- TanStack React Query
- Tailwind + shadcn/Radix UI
- Framer Motion
- Recharts
- Direct Supabase client usage exists in multiple pages/hooks/components

### Backend / Data
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Row Level Security policies across public tables
- Supabase Edge Functions for AI, legal, headhunting, payments, user administration, search/scraping, email, strategic analysis, and support

### Deployment
- Lovable project mirror for engineering
- GitHub engineering repository
- Engineering Supabase instance separate from production
- Production CloudIva deployment disabled in the engineering repository

## Measured Baseline
- `bun run build`: PASS
- `bunx tsc --noEmit`: PASS
- `bun run lint`: FAIL on pre-existing issues
- Source files under `src`: 257
- Direct Supabase client imports in `src`: 31 files
- `supabase.functions.invoke`: 35 files / 44 occurrences
- Public application routes: 35 including catch-all
- Edge Function directories observed: 42 functional directories plus `_shared`
- Public application tables observed in engineering DB: 38

## Major UI / Product Areas
- Landing and authentication
- Main dashboard
- HR dashboard and analytics
- Job description generation
- Smart ad generation
- Interview assistant
- Onboarding roadmap
- Learning path
- Smart headhunting, campaigns, candidates
- Company members and settings
- Credits / upgrade / payments
- Digital shop / product catalog
- Legal search and legal advisor
- Strategic Compass
- Strategic Radar
- Unicorn Lab
- Admin panel
- Support and notifications

## Current Coupling Pattern
A recurring pattern is:

`Page/Component -> Supabase client -> table or Edge Function`

This makes fast prototyping easy but increases change blast radius and provider coupling as the product grows.

## Target Evolution Pattern
Refactor incrementally toward:

`UI -> domain/service interface -> backend adapter/API -> persistence/integration`

Rules:
- no big-bang rewrite;
- preserve working UX and data;
- extract one domain at a time;
- create tests/contract checks around behavior before risky extraction;
- move cross-cutting concerns (auth, RBAC, billing/credits, AI gateway, audit) behind stable boundaries.

## Highest-Risk Cross-Cutting Areas
1. Authentication / session handling
2. Company membership and tenant isolation
3. Admin / Super Admin authorization
4. Feature permissions and visibility gates
5. Credits, purchase, payment and billing state
6. Direct Supabase calls distributed through UI code
7. AI Edge Function input/output contracts
8. Smart headhunting external integrations and candidate persistence
9. Database migrations/RLS policies
10. Deployment and environment separation

## Refactoring Principle
A module is considered safer only when changing its internal implementation does not require unrelated UI modules to understand its persistence, provider, or infrastructure details.
