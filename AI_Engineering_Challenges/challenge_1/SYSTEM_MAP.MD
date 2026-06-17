# System Map — Challenge 1: Insurance Plan Comparison Page

## Overview

This is a **static, single-page frontend application** with no backend services. There is one route (`/`), no database, no authentication, and no external API calls. All data is bundled at build time from a TypeScript constants file.

---

## Architecture Layers

```
┌──────────────────────────────────────────────────────────────────────┐
│                         BROWSER (Client)                             │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                   React 19 Component Tree                      │  │
│  │                                                                │  │
│  │   <html> [inter.className applied by layout.tsx]               │  │
│  │     <body> [Gilroy font via globals.css @layer base]           │  │
│  │       <Navbar />               (Server Component, stateless)   │  │
│  │       <main>                                                   │  │
│  │         <PlanComparison />     (Client Component, stateful)    │  │
│  │           <Switch />           (controlled toggle)             │  │
│  │           <PlanCard /> × 3     (per plan)                      │  │
│  │             <FeatureItem /> × 7                                │  │
│  │           <FooterCTA />                                        │  │
│  │       </main>                                                  │  │
│  │       <SiteFooter />           (Server Component, stateless)   │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Local State (React useState):                                       │
│    isAnnual: boolean  →  owned by PlanComparison                     │
└──────────────────────────────────────────────────────────────────────┘
            ▲ HTTP (static assets + RSC payload)
┌──────────────────────────────────────────────────────────────────────┐
│                   Next.js 16 App Router (Server)                     │
│                                                                      │
│  Route: GET /                                                        │
│    app/page.tsx         — Server Component, composes layout         │
│    app/layout.tsx       — Root Layout (font, metadata, html shell)  │
│                                                                      │
│  Static Data (compiled into bundle, never fetched at runtime):      │
│    app/data/plans.ts    — Plan[], valueScore(), recommendedPlan()   │
│                                                                      │
│  Static Assets:                                                      │
│    app/globals.css      — Tailwind v4 @theme, @font-face, @layer    │
│    public/*.svg         — Default Next.js assets (unused by app)    │
│                                                                      │
│  Build Tool: Turbopack (Next.js 16 default dev server)              │
└──────────────────────────────────────────────────────────────────────┘
            ▲ Deploy
┌──────────────────────────────────────────────────────────────────────┐
│                         Vercel Platform                              │
│  Hosts static output + Node.js runtime for server components         │
│  Live URL: https://insurance-plan-comparison-page.vercel.app         │
└──────────────────────────────────────────────────────────────────────┘
```

---

## File → Role Map

```
challenge_1/
├── app/
│   ├── layout.tsx          ROOT LAYOUT   Sets <html>, <body>, Inter font, default metadata
│   ├── page.tsx            ROUTE /       Composes Navbar + PlanComparison + SiteFooter
│   ├── globals.css         STYLES        Tailwind v4 @theme tokens (papaya brand color + font)
│   ├── favicon.ico         ASSET         Browser tab icon
│   │
│   ├── components/
│   │   ├── Navbar.tsx      COMPONENT     Sticky nav: brand logo + "Get in touch" CTA
│   │   ├── PlanComparison.tsx  COMPONENT  Client component; owns billing toggle state
│   │   │   └── [internal] Switch         Accessible iOS toggle (controlled + uncontrolled)
│   │   │   └── [internal] FeatureItem    Benefit row with check/cross icon
│   │   │   └── [internal] PlanCard       Full plan card (price, features, CTA)
│   │   │   └── [internal] FooterCTA      Marketing block below grid
│   │   │   └── [internal] getPlanFeatures  Pure fn: Plan → Feature[]
│   │   └── SiteFooter.tsx  COMPONENT     Footer: brand + copyright + Privacy/Terms links
│   │
│   └── data/
│       └── plans.ts        DATA + LOGIC  Plan types, static data, valueScore(), recommendedPlan()
│
├── public/                 STATIC        Unused default SVGs
├── next.config.ts          CONFIG        Empty (no customisation)
├── postcss.config.mjs      CONFIG        @tailwindcss/postcss plugin
├── tsconfig.json           CONFIG        Strict TS, bundler resolution, @/* alias
└── eslint.config.mjs       CONFIG        ESLint 9 flat config (core-web-vitals + TS)
```

---

## Request Lifecycle — Initial Page Load

```
User opens http://localhost:3000  (or Vercel URL)
    │
    ▼
Next.js App Router receives GET /
    │
    ├─► app/layout.tsx  renders <html><body>
    │       └─ loads Inter from next/font/google (Google Fonts CDN, first load only)
    │
    ├─► app/page.tsx    renders page tree (server)
    │       ├─ <Navbar />       — renders static HTML
    │       ├─ <PlanComparison /> — serialises as RSC placeholder (client boundary)
    │       └─ <SiteFooter />   — renders static HTML
    │
    ▼
Browser receives HTML + CSS + JS bundle
    │
    ├─► CSS: globals.css processed by @tailwindcss/postcss → inlined/linked styles
    │         @font-face { src: local('Gilroy') } — resolves if Gilroy installed locally
    │
    ├─► JS: React hydrates <PlanComparison /> with isAnnual = true
    │       calls recommendedPlan() → valueScore() over plans[] → returns Silver
    │       renders 3 × PlanCard with annual pricing and "Most popular" badge on Silver
    │
    └─► Page is fully interactive
```

---

## Request Lifecycle — Billing Toggle Interaction

```
User clicks Switch (or "View Annual/Monthly Billing ↗" on a card)
    │
    ▼
Switch.toggle() fires
    │
    ├─► setIsAnnual(!isAnnual)  (React state update)
    │
    ▼
React re-renders PlanComparison (client-side only, no network call)
    │
    ├─► Each PlanCard recomputes:
    │     isAnnual=true  → displayPrice = Math.round(monthly * 0.9)
    │                       shows strikethrough original price
    │                       shows "10% off · Billed annually"
    │     isAnnual=false → displayPrice = monthly_premium
    │                       shows "Billed monthly"
    │
    └─► DOM updated, no page navigation, no fetch
```

---

## Data Model

```
Plan {
  name:               string            // "Bronze" | "Silver" | "Gold"
  monthly_premium:    number            // Thai Baht (฿)
  annual_limit:       number            // Max coverage per year (฿)
  benefits: {
    outpatient: {
      limit_per_visit:  number          // ฿ per GP/specialist visit
      visits_per_year:  number          // -1 = unlimited
    }
    inpatient: {
      limit_per_day:    number          // ฿ per hospital day
      days_per_year:    number          // -1 = unlimited
    }
    dental:    { limit_per_year: number } | null
    maternity: { limit_per_pregnancy: number } | null
  }
  copay_percentage:   number            // 0 | 10 | 20
  waiting_period_days: number           // 0 | 15 | 30
  highlights:         string[]          // Defined but NOT rendered in UI
}
```

**Concrete plan values:**

| Field | Bronze | Silver | Gold |
|---|---|---|---|
| Monthly premium | ฿150 | ฿350 | ฿700 |
| Annual limit | ฿500,000 | ฿1,500,000 | ฿5,000,000 |
| OP limit/visit | ฿3,000 | ฿5,000 | ฿10,000 |
| OP visits/year | 30 | 60 | Unlimited |
| IP limit/day | ฿10,000 | ฿25,000 | ฿50,000 |
| IP days/year | 60 | 120 | Unlimited |
| Dental | No | ฿30,000/yr | ฿100,000/yr |
| Maternity | No | No | ฿200,000/pregnancy |
| Co-pay | 20% | 10% | 0% |
| Waiting period | 30 days | 15 days | None |

---

## Recommendation Algorithm

```
valueScore(plan) =
  (annual_limit / monthly_premium)         // coverage per baht
  × (1 - copay_percentage / 100)           // net benefit after copay
  × (1 + dentalBonus + maternityBonus)     // +15% dental, +10% maternity
  × (maxPremium / monthly_premium) ^ 0.45  // affordability multiplier

recommendedPlan() = plans.reduce(maxByValueScore)
```

At current data values, **Silver** wins (high affordability multiplier offsets Gold's raw coverage).

---

## External Dependencies

| Dependency | Purpose | Network call? |
|---|---|---|
| `next/font/google` (Inter) | Fallback font | Yes — on first load from fonts.google.com |
| Tailwind CSS v4 | Utility styles | No (compile-time) |
| Vercel | Hosting | Deployment only |
| Google Fonts | Inter font CDN | Yes — first load |

No third-party analytics, tracking scripts, payment processors, or backend APIs are present.

---

## Separation of Concerns

| Concern | Where it lives |
|---|---|
| Plan data & types | `app/data/plans.ts` |
| Recommendation logic | `app/data/plans.ts` — `valueScore()`, `recommendedPlan()` |
| Page composition (route) | `app/page.tsx` |
| HTML shell & fonts | `app/layout.tsx` |
| Brand tokens & typography | `app/globals.css` |
| Navigation chrome | `app/components/Navbar.tsx` |
| Core interactive UI | `app/components/PlanComparison.tsx` |
| Footer chrome | `app/components/SiteFooter.tsx` |
| Build config | `next.config.ts`, `postcss.config.mjs`, `tsconfig.json` |
