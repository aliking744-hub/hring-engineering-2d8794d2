# HRing Engineering

Subject: Re-Architect App to "Linear-Style" Website (Landing + Dashboard)

I need to restructure the project into a High-End SaaS Website inspired by the **Linear.app** design aesthetic.
**Be strict with quality.** Do not use cheap effects.

**1. Architecture Update:**
* **Home (`/`):** Premium Landing Page (Public).
* **Dashboard (`/dashboard`):** Move the current app/modules here (Protected).
* **Shop (`/shop`):** HR Document Marketplace.
* **Auth (`/auth`):** Login/Signup.

**2. Design Language (The "Linear" Vibe):**
* **Theme:** Deep Dark Blue/Black background (matching our brand).
* **Background Effect:** NOT water. Use a **"Slow Moving Aurora Gradient"** (Mesh Gradient) in the background. It must feel "floating" and subtle, not distracting.
* **Typography:** Clean, Sans-serif, High contrast text.
* **Interactions:** Use `framer-motion` for everything.
    * **Scroll Reveal:** Elements should fade up + scale up slightly as the user scrolls.
    * **Mouse Spotlight:** On the Feature Cards, add a "Spotlight Effect" where a subtle glow follows the mouse cursor inside the card borders.

**3. Landing Page Sections (`/`):**
* **Hero:** Centered, Large Typography. "hring: سیستم مدیریت منابع انسانی نسل جدید". Subtext: "قدرت گرفته از هوش مصنوعی". CTA: "شروع کنید" (Glowing Button).
* **Bento Grid Features:** Display our 4 modules (Job, Ad, Interview, Onboarding) in a "Bento Grid" layout. Glassmorphic cards with the spotlight effect.
* **Interactive Preview:** A tilted 3D-style screenshot of the dashboard (Mockup) that floats slightly.
* **Shop Teaser:** A horizontal scroll section showing contract templates.
* **Footer:** Minimalist, containing the "Architected by Ali Dehghani & Gemini" credit.

**4. Responsiveness:**
* Must be flawless on mobile.
* The Background Gradient should be optimized for mobile performance.
* Navbar transforms into a smooth animated drawer on mobile.

**Action:** Refactor the app structure and build this premium landing page now.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://hring-engineering.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d680f6d4-60b9-4876-a097-5cdb1c5f57d8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
