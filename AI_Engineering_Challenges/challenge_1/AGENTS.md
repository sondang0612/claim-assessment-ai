<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Module Responsibilities & Interaction Map

This is a **purely frontend application** with no backend agents, microservices, or API workers. The "agents" described here are logical UI/data modules that together form the complete system.

---

## Module Inventory

### 1. `app/data/plans.ts` — Plan Data & Recommendation Engine

**Role:** Single source of truth for all insurance plan data and the scoring algorithm.

**Responsibilities:**
- Defines the complete TypeScript type hierarchy (`Plan`, `OutpatientBenefit`, `InpatientBenefit`, `DentalBenefit`, `MaternityBenefit`).
- Exports the `plans` array — three static plan objects (Bronze, Silver, Gold) with all coverage fields.
- Implements `valueScore(plan: Plan): number` — a multi-factor scoring function that balances:
  - Coverage-per-baht ratio (`annual_limit / monthly_premium`)
  - Benefit breadth (dental +15%, maternity +10%)
  - Copay burden (`× (1 - copay_percentage/100)`)
  - Affordability multiplier (`(maxPremium / plan.monthly_premium) ^ 0.45`) — prevents penalising mid-tier plans purely for lower absolute limits.
- Implements `recommendedPlan(): Plan` — reduces over `plans` using `valueScore` to return the highest-scoring plan.

**Consumers:** `PlanComparison.tsx` (imports `plans`, `recommendedPlan`, and the `Plan` type).

**Has no dependencies** on any other application module.

---

### 2. `app/components/Navbar.tsx` — Navigation Bar

**Role:** Persistent top-of-page navigation element.

**Responsibilities:**
- Renders the Papaya brand logotype (square "P" icon + wordmark).
- Renders a "Get in touch" CTA button (currently non-functional, `href` is `#`).
- Applies sticky positioning with backdrop blur for scroll overlay effect.

**State:** None (pure presentational server component).

**Dependencies:** None.

---

### 3. `app/components/PlanComparison.tsx` — Core UI Module

**Role:** The entire interactive body of the page. Marked `"use client"` because it manages the billing-cycle toggle state.

**Sub-components (all defined within this file):**

| Sub-component | Role |
|---|---|
| `Switch` | Accessible iOS-style toggle for monthly/annual billing. Supports controlled + uncontrolled modes. Uses compositor-only animations. |
| `FeatureItem` | Renders a single benefit row with a checkmark (papaya color if included, grey if not). |
| `PlanCard` | Full card for one plan: name, description, price row with optional strikethrough, CTA button, billing-toggle link, and feature list. |
| `FooterCTA` | Inline marketing block below the plan grid with "Schedule a demo" and "Explore the platform" links. |
| `getPlanFeatures(plan)` | Pure function: maps a `Plan` object to a `Feature[]` array of `{ included, content }` objects for rendering. |

**State managed:**
- `isAnnual: boolean` — controls whether prices show the 10% annual discount. Toggled by `Switch` or by the "View Annual/Monthly Billing ↗" link on each card.

**Data flow:**
```
plans[] (from plans.ts)
  └─► PlanComparison (holds isAnnual state)
        └─► PlanCard × 3
              ├─► displayPrice = isAnnual ? round(monthly * 0.9) : monthly
              └─► getPlanFeatures(plan) → FeatureItem × 7
```

**Dependencies:** `plans`, `recommendedPlan`, `Plan` from `app/data/plans.ts`.

---

### 4. `app/components/SiteFooter.tsx` — Site Footer

**Role:** Bottom-of-page footer bar.

**Responsibilities:**
- Renders brand logotype (smaller variant matching Navbar).
- Renders copyright line with placeholder Privacy and Terms links.

**State:** None (pure presentational server component).

**Dependencies:** None.

---

### 5. `app/layout.tsx` — Root Layout

**Role:** Next.js App Router root layout — wraps every page in the shared HTML shell.

**Responsibilities:**
- Loads Inter from `next/font/google` and applies it to `<html>` via `className`.
- Sets default `<title>` and `<meta description>` via Next.js `Metadata` export.
- Renders `<html lang="en">` and `<body>` with antialiasing and base background color.

**Note:** The body font-family is overridden in `globals.css` to Gilroy → Inter → system, which wins over the `inter.className` on `<html>` because it targets `body` directly.

---

### 6. `app/page.tsx` — Route Composition

**Role:** The single route handler for `/`. A server component that composes the three UI modules.

**Responsibilities:**
- Sets page-level metadata (`title`, `description`) — overrides layout defaults for this route.
- Renders `<Navbar />` + `<main><PlanComparison /></main>` + `<SiteFooter />`.

---

### 7. `app/globals.css` — Design Token Layer

**Role:** Tailwind v4 theme configuration and global base styles.

**Responsibilities:**
- Defines brand color tokens: `--color-papaya: #FD0052`, `--color-papaya-pale: #FFF0F4`.
- Defines the `--font-sans` stack: Gilroy → Inter → system.
- Registers Gilroy via `@font-face` (`local()` only, no downloaded files).
- Applies `font-family: var(--font-sans)` globally on `body` via `@layer base`.

---

## Module Interaction Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    app/layout.tsx                        │
│  (Root Layout — loads Inter font, sets <html>/<body>)    │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │                  app/page.tsx                       │  │
│  │  (Route "/" — Server Component)                     │  │
│  │                                                     │  │
│  │   ┌──────────────┐                                  │  │
│  │   │  Navbar.tsx  │  (Server, stateless)             │  │
│  │   └──────────────┘                                  │  │
│  │                                                     │  │
│  │   ┌─────────────────────────────────────────────┐   │  │
│  │   │          PlanComparison.tsx                  │   │  │
│  │   │  ("use client" — owns isAnnual state)        │   │  │
│  │   │                                              │   │  │
│  │   │   reads ◄── app/data/plans.ts               │   │  │
│  │   │              ├─ plans[]                      │   │  │
│  │   │              ├─ recommendedPlan()             │   │  │
│  │   │              └─ valueScore()                  │   │  │
│  │   │                                              │   │  │
│  │   │   renders PlanCard × 3                       │   │  │
│  │   │     each card calls getPlanFeatures(plan)    │   │  │
│  │   │     and renders FeatureItem × 7              │   │  │
│  │   └─────────────────────────────────────────────┘   │  │
│  │                                                     │  │
│  │   ┌──────────────────┐                              │  │
│  │   │  SiteFooter.tsx  │  (Server, stateless)         │  │
│  │   └──────────────────┘                              │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
            ▲
    app/globals.css
    (Tailwind v4 @theme tokens: papaya colors, font stack)
```

---

## Data Flow Summary

1. **Build time / SSR:** `app/page.tsx` and `Navbar`/`SiteFooter` render as server components. No data fetching — all data is static import.
2. **Hydration:** `PlanComparison` is a client component. React hydrates it in the browser with `isAnnual = true` as initial state.
3. **User interaction:** Clicking the `Switch` or a card's "View ... Billing" button calls `setIsAnnual`, triggering a re-render of all three `PlanCard` instances with updated `displayPrice`.
4. **No network calls** occur after initial page load. All state is local to the browser session.
