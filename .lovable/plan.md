# Plan: Add "بازگشت به داشبورد" Buttons Across Pages

## Goal
Add a consistent "بازگشت به داشبورد" (Back to Dashboard) button to all internal tool pages that are currently missing it.

## Identified Pages Missing Back Button

After auditing the codebase, the following **internal protected pages** do **not** have a back-to-dashboard button:

1. **`src/pages/LearningPath.tsx`** — No back button at all.
2. **`src/pages/StrategicRadar.tsx`** — No back button; only internal phase navigation.
3. **`src/pages/UnicornLab.tsx`** — Only renders `<Navbar />` and layout; no back button.
4. **`src/pages/CampaignDetail.tsx`** — Has a "بازگشت" link only in the error state, but the main UI lacks a dashboard back button.
5. **`src/pages/CandidateDetail.tsx`** — No dashboard back button.
6. **`src/pages/PaymentHistory.tsx`** — No dashboard back button.
7. **`src/pages/AnalyticsHub.tsx`** — No dashboard back button.

## Implementation Pattern

Use the established convention from existing pages (e.g. `LegalAdvisor.tsx`, `Shop.tsx`):

```tsx
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

// Fixed position variant (for full-page layouts)
<Link to="/dashboard" className="fixed top-24 right-6 z-50">
  <Button variant="outline" className="border-border bg-secondary/80 backdrop-blur-sm shadow-lg gap-2">
    <ArrowRight className="w-4 h-4" />
    بازگشت به داشبورد
  </Button>
</Link>
```

For pages that already have a sticky header bar (like `LegalSearchPage.tsx`), place the button inside the header instead.

## Page-Specific Notes

| Page | Approach |
|------|----------|
| `LearningPath.tsx` | Add fixed-position back button below the AuroraBackground, similar to `LegalAdvisor.tsx`. |
| `StrategicRadar.tsx` | Add fixed-position back button; the page uses a dark `#0a0f1a` background, so styling must match. |
| `UnicornLab.tsx` | Add fixed-position back button alongside the existing `<Navbar />`. |
| `CampaignDetail.tsx` | Add a header row with back button inside the main container, or a fixed-position button. |
| `CandidateDetail.tsx` | Add back button in the header area of the detail view. |
| `PaymentHistory.tsx` | Add fixed-position back button; page uses `Navbar` + `AuroraBackground`. |
| `AnalyticsHub.tsx` | Add fixed-position back button; page already has a mobile sidebar menu. |

## Out of Scope

The following pages are intentionally skipped because they are either public-facing or already have a back button:
- `Blog.tsx`, `BlogPost.tsx` — Public blog pages.
- `ProductCatalog.tsx` — Public product catalog.
- All other internal pages already have a back button.