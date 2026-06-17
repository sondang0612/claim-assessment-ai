# Project State — Challenge 1: Insurance Plan Comparison Page

> Last assessed: 2026-06-18

---

## Current State

**Status: Feature-complete for stated challenge scope. UI is fully functional. Not production-ready as a real insurance product.**

The application renders a single page with three plan cards, a working billing toggle, and an algorithmically derived "Most popular" badge. It is deployed on Vercel. All core UI interactions work correctly.

---

## Completed Features

| Feature | Evidence |
|---|---|
| Three-plan side-by-side grid (Bronze, Silver, Gold) | `PlanComparison.tsx` — `plans.map(PlanCard)` |
| Monthly / Annual billing toggle | `Switch` component + `isAnnual` state |
| 10% annual discount with strikethrough original price | `displayPrice = Math.round(monthlyBase * 0.9)` |
| "Save 10%" badge next to toggle | Rendered in billing toggle row |
| Per-card "View Annual/Monthly Billing ↗" shortcut | `onToggleBilling` prop on `PlanCard` |
| Feature list with check/cross icons per plan | `FeatureItem`, `getPlanFeatures()` |
| "Most popular" badge on recommended plan | `isRecommended` prop, `recommendedPlan()` |
| Value-for-money scoring algorithm | `valueScore()` in `plans.ts` |
| Unlimited visits/days sentinel handling | `-1` check in `getPlanFeatures()` |
| Dental and maternity coverage display | Optional fields rendered conditionally |
| Responsive layout (1-col mobile, 3-col desktop) | `grid-cols-1 sm:grid-cols-3` |
| Hover card lift animation | `hover:-translate-y-1` on `<article>` |
| Sticky navbar with backdrop blur | `sticky top-0 backdrop-blur-sm` |
| Accessible Switch toggle | `role="switch"`, `aria-checked`, keyboard nav |
| Brand color system via Tailwind v4 @theme | `--color-papaya: #FD0052` in `globals.css` |
| Gilroy font with Inter/system fallback | `@font-face local()` + `next/font/google` |
| Footer CTA block | `FooterCTA` component |
| Site footer with copyright | `SiteFooter.tsx` |
| TypeScript strict mode | `"strict": true` in `tsconfig.json` |
| ESLint configured (Next.js + TS rules) | `eslint.config.mjs` |
| Vercel deployment | README live demo link |

---

## Missing / TODO Features

### Functional gaps (not in scope for challenge, but expected in a real product)

| Item | Notes |
|---|---|
| "Get started" button functionality | All buttons are `type="button"` with no handler — no navigation, form, or modal |
| "Get in touch" navbar button | Non-functional |
| "Schedule a demo" and "Explore the platform" links | Both `href="#"` — dead links |
| Privacy and Terms pages | Footer links point to `#` |
| Plan purchase / checkout flow | No payment integration |
| User authentication | No auth layer |
| Plan detail/comparison page | No drill-down view |
| Contact / lead capture form | No form or email integration |
| Analytics / tracking | No GA, Segment, or similar |

### UI/UX gaps

| Item | Notes |
|---|---|
| `highlights` field is defined but never rendered | Each `Plan` has a `highlights: string[]` field that `getPlanFeatures()` ignores |
| No loading state | Not needed currently (no async), but would need if data were fetched |
| No error boundary | Not needed currently, but recommended for production |
| No scroll-to-plans on CTA click | "Choose your plan" eyebrow has no anchor target |
| Mobile card ordering | No visual cue for which plan is recommended when stacked vertically |

---

## Known Issues / Bugs

| Issue | Severity | Location |
|---|---|---|
| `metadata` exported from both `layout.tsx` and `page.tsx` | Low | Both files export identical `{ title, description }` objects. `page.tsx` metadata correctly overrides `layout.tsx`, but the duplication is noise. |
| `FooterCTA` is defined inside `PlanComparison.tsx` | Low | Architectural coupling — footer CTA is a separate visual concern but lives in the same file as the plan grid logic. |
| `Switch` `onKeyDown` blocks `Enter` but comment says "not standard for role=switch" | Low | The code is correct per ARIA spec, but the comment acknowledges uncertainty. |
| `plans.ts` `maxPremium` computed inline inside `valueScore()` | Low | `Math.max(...plans.map(p => p.monthly_premium))` runs on every `valueScore()` call, which is called twice per plan (once to compute all scores, once in reduce). Negligible for 3 plans, but would scale poorly. |
| No `<title>` uniqueness enforcement | Informational | Title is the same on all routes (there is only one route), so no SEO issue currently. |

---

## Technical Debt

| Item | Impact |
|---|---|
| `PlanComparison.tsx` is a monolithic file | All sub-components (`Switch`, `FeatureItem`, `PlanCard`, `FooterCTA`, `getPlanFeatures`) are co-located in one 483-line file. Acceptable for a challenge, but would need splitting for maintainability. |
| No unit tests | `valueScore()` and `recommendedPlan()` have zero test coverage. These are pure functions that are trivially testable. |
| No integration or E2E tests | No Playwright/Cypress coverage of billing toggle, card rendering, or accessibility. |
| Hardcoded plan descriptions in `PLAN_META` | `PLAN_META` in `PlanComparison.tsx` maps plan names to descriptions. This is a fragile string-keyed constant not co-located with plan data in `plans.ts`. |
| `highlights` field orphaned | Defined in the type and populated in data but never consumed by any component. |
| Currency formatter is a file-level helper, not shared | `currency()` in `PlanComparison.tsx` can't be reused if a second page is added. |
| No environment-based config | If plan data were to come from a CMS or API, there is no `.env` / config pattern in place. |

---

## Suggestions for Improvement

### High priority (before real-user traffic)

1. **Wire up CTAs** — "Get started" should navigate to a purchase flow or at minimum a contact form. Dead buttons erode trust.
2. **Add `valueScore` unit tests** — The recommendation algorithm is a key product differentiator. Test it with boundary cases (e.g., all plans identical, one plan missing dental).
3. **Move `PLAN_META` descriptions into `plans.ts`** — Add an optional `description` field to the `Plan` type so all plan metadata is co-located and type-safe.
4. **Render `highlights`** — The `highlights` field is already defined and populated; surface it in the UI (e.g., as a compact tag list beneath the plan name).

### Medium priority (code quality)

5. **Split `PlanComparison.tsx`** — Extract `Switch`, `PlanCard`, `FeatureItem`, and `FooterCTA` into separate files under `app/components/`.
6. **Move `currency()` to `app/utils/format.ts`** — Shared formatter, not component-scoped.
7. **Memoize `maxPremium`** — Compute once at module level in `plans.ts` rather than inside `valueScore()`.
8. **Add `<Link>` scroll-to-plans** — The hero "Choose your plan" eyebrow and the `<a>` tags in `FooterCTA` could use Next.js `<Link>` with `scroll` behavior for in-page navigation.

### Low priority (polish)

9. **Add `aria-live` region for billing toggle** — Announce price changes to screen reader users when `isAnnual` flips.
10. **Add `prefers-reduced-motion` media query** — The card hover lift and Switch animations should respect the OS accessibility preference.
11. **Remove unused `public/` SVGs** — The default Next.js placeholder SVGs (file.svg, globe.svg, etc.) are never referenced.

---

## Deployment Readiness Assessment

| Dimension | Status | Notes |
|---|---|---|
| **Functionality** | Partial | Core comparison UI works; all CTAs are non-functional stubs |
| **Performance** | Good | Static generation, no runtime data fetching, Turbopack build |
| **Accessibility** | Partial | Switch has full ARIA; other interactive elements lack `aria-*` attributes |
| **SEO** | Minimal | Title/description set; no OG tags, structured data, or sitemap |
| **Security** | N/A | No user data, no auth, no APIs — attack surface is effectively zero |
| **Testing** | None | No unit, integration, or E2E tests |
| **Error handling** | None | No error boundaries or fallbacks |
| **Monitoring** | None | No error tracking (Sentry), analytics, or performance monitoring |
| **CI/CD** | Unknown | No `.github/workflows` or similar pipeline found in the repository |
| **Environment config** | None | No `.env` files; all config is hardcoded (acceptable for static demo) |

**Verdict:** Suitable for a technical challenge demo or prototype. Not ready for real-user traffic handling actual insurance enrollment without completing the functional gaps above.
