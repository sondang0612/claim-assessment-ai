@AGENTS.md

# Challenge 1 — Insurance Plan Comparison Page

## Project Summary

A single-page, fully client-rendered insurance plan comparison UI built for the Papaya InsurTech AI Engineering Challenge. It displays three tiered insurance plans (Bronze, Silver, Gold) side by side with a billing-cycle toggle and an algorithmic "recommended plan" badge. There is **no backend, no API routes, no database, and no authentication** — everything runs in the browser from static data.

---

## Core Purpose

Allow prospective customers to compare insurance plans, understand coverage details, and switch between monthly and annual pricing (10% annual discount). A value-for-money scoring algorithm automatically highlights the best-value plan.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | **16.2.9** |
| UI Library | React | 19.2.4 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS v4 | ^4 |
| CSS processor | @tailwindcss/postcss | ^4 |
| Font | Gilroy (local) → Inter (Google) → system | — |
| Linting | ESLint 9 + eslint-config-next | ^9 |
| Build | Turbopack (Next.js dev default) | bundled |
| Deployment | Vercel | — |

> **CRITICAL — Next.js 16.x is NOT the version in your training data.**
> APIs, conventions, and file structure may differ from Next.js 13/14/15.
> Always read `node_modules/next/dist/docs/` before writing any Next.js-specific code.
> Heed any deprecation notices you encounter.

---

## Key Design Decisions

1. **Data-driven rendering** — All plan data lives in `app/data/plans.ts` as a typed `Plan[]` array. Adding or modifying a plan requires only changing that file.

2. **Value-score algorithm** — `valueScore(plan)` in `plans.ts` computes a recommendation score weighing annual coverage per baht, benefit breadth (dental/maternity bonus), copay burden, and an affordability multiplier (`Math.pow(maxPremium / plan.monthly_premium, 0.45)`). `recommendedPlan()` reduces over all plans to find the winner.

3. **Annual discount is computed at render time** — `annualMonthly = Math.round(monthlyBase * 0.9)`. There is no stored "annual price" field; the 10% is always derived from `monthly_premium`.

4. **`-1` as sentinel for unlimited** — `visits_per_year: -1` and `days_per_year: -1` mean unlimited. The UI checks for `-1` and renders "Unlimited" text.

5. **Custom Switch component** — Fully accessible (`role="switch"`, `aria-checked`, keyboard navigation) iOS-style toggle with compositor-only animations (transform + opacity, no repaint). Supports both controlled and uncontrolled modes.

6. **Tailwind v4 CSS theme tokens** — Brand colors are defined in `globals.css` using `@theme` (not `tailwind.config.js`). Use `bg-papaya`, `text-papaya`, `bg-papaya-pale` in className strings.

7. **Font strategy** — Gilroy is loaded via `@font-face { src: local(...) }` so no font file shipping. Inter from `next/font/google` is the fallback. The font-family override is applied on `body` (not `html`) to win over Next.js's injected `inter.className`.

---

## How to Run

### Development
```bash
npm install
npm run dev
# → http://localhost:3000
```

### Production build
```bash
npm run build
npm start
```

### Lint
```bash
npm run lint
```

---

## Project Structure

```
challenge_1/
├── app/
│   ├── components/
│   │   ├── Navbar.tsx          # Sticky top nav with brand logo + CTA button
│   │   ├── PlanComparison.tsx  # Main page body: hero, billing toggle, plan cards, footer CTA
│   │   └── SiteFooter.tsx      # Bottom bar with copyright and policy links
│   ├── data/
│   │   └── plans.ts            # Plan types, data array, valueScore(), recommendedPlan()
│   ├── globals.css             # Tailwind v4 @theme tokens (papaya colors, font stack)
│   ├── layout.tsx              # Root layout: Inter font, metadata, html/body wrapper
│   └── page.tsx                # Route handler for "/" — composes Navbar + PlanComparison + SiteFooter
├── public/                     # Static assets (default Next.js SVGs, not used by app)
├── CLAUDE.md                   # ← you are here
├── AGENTS.md                   # Module responsibilities and interaction map
├── SYSTEM_MAP.md               # Architecture diagram and request lifecycle
├── PROJECT_STATE.MD            # Feature status, known issues, and improvement roadmap
├── next.config.ts              # Empty Next.js config (no customisation)
├── postcss.config.mjs          # @tailwindcss/postcss plugin
├── tsconfig.json               # Strict TS, bundler resolution, @/* path alias
└── eslint.config.mjs           # ESLint 9 flat config: core-web-vitals + typescript rules
```

---

## Important Notes for AI Assistants

- **No API routes exist.** Do not create `app/api/` routes unless explicitly asked.
- **No test framework is installed.** Jest, Vitest, and Playwright are absent.
- **Tailwind v4 syntax differs from v3.** There is no `tailwind.config.js`. Theme tokens go inside `globals.css` under `@theme { }`. Utility classes like `bg-papaya` are derived automatically from `--color-papaya`.
- **React 19 features are available** (e.g., `use()`, React Server Components, improved `ref` handling).
- **`"use client"` is required** on `PlanComparison.tsx` because it uses `useState`. Server components cannot use hooks.
- **All CTA links and buttons are non-functional** (`href="#"`) — they are UI scaffolding only.
- **The `highlights` field in each `Plan`** is defined in the data type but not currently rendered in the UI.
- **Currency is Thai Baht (฿).** The `currency()` helper formats numbers with `toLocaleString()`.
