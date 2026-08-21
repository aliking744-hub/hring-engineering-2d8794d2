# Smart Headhunting Golden Module

## Purpose
Smart Headhunting is the first HRing module being migrated toward the target modular-monolith architecture without a product rewrite.

## Slice 1: Persistence Boundary

Before:

`SmartHeadhunting/CampaignDetail -> useCampaigns -> Supabase`

After this slice:

`SmartHeadhunting/CampaignDetail -> useCampaigns -> campaignRepository -> Supabase`

The public hook API is intentionally preserved so the UI and existing callers do not need to change.

## Why this matters
- Supabase query details are no longer embedded in the React hook.
- Persistence can later move behind an HTTP API without rewriting the UI contract.
- Generated Supabase table types are contained at the adapter boundary.
- Campaign/candidate normalization happens before data reaches the UI.
- Tests prevent direct Supabase persistence calls from leaking back into the hook.

## Not yet migrated
- `SmartHeadhunting.tsx` still invokes AI Edge Functions directly.
- `CandidateDetail.tsx` still has direct Supabase usage.
- There is not yet a server-side HRing API boundary.

These are deliberate later slices; this change remains narrow and behavior-preserving.
