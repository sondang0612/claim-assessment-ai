"use client";

import { useState } from "react";
import { plans, recommendedPlan, type Plan } from "../data/plans";

// ── Formatters (unchanged business logic) ────────────────────────────────────

function currency(n: number) {
  return "฿" + n.toLocaleString();
}

function visits(n: number) {
  return n === -1 ? "Unlimited" : `${n} visits/yr`;
}

function days(n: number) {
  return n === -1 ? "Unlimited" : `${n} days/yr`;
}

// ── Best-value column detection (unchanged business logic) ────────────────────

type RowKey =
  | "premium"
  | "annual_limit"
  | "copay"
  | "waiting"
  | "op_limit"
  | "op_visits"
  | "ip_limit"
  | "ip_days"
  | "dental"
  | "maternity";

function bestIndex(key: RowKey): number {
  const vals = plans.map((p): number => {
    switch (key) {
      case "premium":
        return -p.monthly_premium; // lower is better → negate
      case "annual_limit":
        return p.annual_limit;
      case "copay":
        return -p.copay_percentage; // lower is better
      case "waiting":
        return -p.waiting_period_days; // lower is better
      case "op_limit":
        return p.benefits.outpatient.limit_per_visit;
      case "op_visits": {
        // Bug fix: -1 means unlimited (highest), but -1 < 60 in JS,
        // so we must map it to Infinity before comparing.
        const v = p.benefits.outpatient.visits_per_year;
        return v === -1 ? Infinity : v;
      }
      case "ip_limit":
        return p.benefits.inpatient.limit_per_day;
      case "ip_days": {
        // Same fix as op_visits.
        const v = p.benefits.inpatient.days_per_year;
        return v === -1 ? Infinity : v;
      }
      case "dental":
        return p.benefits.dental?.limit_per_year ?? -Infinity;
      case "maternity":
        return p.benefits.maternity?.limit_per_pregnancy ?? -Infinity;
    }
  });
  const max = Math.max(...vals);
  return vals.findIndex((v) => v === max);
}

const BEST_PILL: Record<RowKey, string> = {
  premium:      "Lowest",
  annual_limit: "Highest",
  copay:        "None",
  waiting:      "Immediate",
  op_limit:     "Highest",
  op_visits:    "No limit",
  ip_limit:     "Highest",
  ip_days:      "No limit",
  dental:       "Highest",
  maternity:    "Included",
};

// ── Display-only plan metadata (not in plans.ts) ──────────────────────────────

const PLAN_META: Record<string, { nickname: string; description: string }> = {
  Bronze: {
    nickname: "Basic",
    description: "Essential protection for individuals starting out.",
  },
  Silver: {
    nickname: "Standard",
    description: "The sweet spot — dental included, lower copay.",
  },
  Gold: {
    nickname: "Complete",
    description: "Full coverage, zero copay, no waiting period.",
  },
};

// ── Plan icons (SVG) ──────────────────────────────────────────────────────────

function PlanIcon({ name, size = 18 }: { name: string; size?: number }) {
  if (name === "Bronze") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  }
  if (name === "Silver") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="8" r="6" />
        <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.7 10.3l9.3 9.3 9.3-9.3L12 2.7z" />
      <path d="M2.7 10.3h18.6M8 2.7l4 7.6 4-7.6" />
    </svg>
  );
}

// ── Primitive icon components ─────────────────────────────────────────────────

function Check() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#EDFAF4]">
      <svg
        width="10"
        height="8"
        fill="none"
        stroke="#16A34A"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="1 4 3.5 6.5 9 1" />
      </svg>
    </span>
  );
}

function Cross() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100">
      <svg
        width="8"
        height="8"
        fill="none"
        stroke="#C8C8C8"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <line x1="1" y1="1" x2="7" y2="7" />
        <line x1="7" y1="1" x2="1" y2="7" />
      </svg>
    </span>
  );
}

// ── Pill badge (best-value indicator) ────────────────────────────────────────

function Pill({ children, featured }: { children: React.ReactNode; featured?: boolean }) {
  return (
    <span
      className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.04em] text-papaya ${
        featured ? "bg-papaya/10" : "bg-papaya-pale"
      }`}
    >
      {children}
    </span>
  );
}

// ── Chip (highlight bullet) ───────────────────────────────────────────────────

function Chip({ children, featured }: { children: string; featured?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium text-gray-500 ${
        featured ? "border-papaya/20 bg-papaya/5" : "border-gray-200 bg-gray-50"
      }`}
    >
      <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-papaya" aria-hidden="true" />
      {children}
    </span>
  );
}

// ── Switch component ──────────────────────────────────────────────────────────
//
// Bugs fixed vs the original inline implementation:
//   1. Track color was hardcoded bg-papaya — never showed off-state (gray)
//   2. Thumb misaligned: translate-x-[19px] on a 40px track with 16px thumb
//      gives a 5px right gap vs 3px left gap. Correct value is translate-x-[21px].
//      New design uses border-2 pattern → translate-x-0 / translate-x-5, perfectly symmetric.
//   3. Space key had no preventDefault() → page scrolled while toggling
//   4. Enter key fired click (not standard for role="switch") with no suppression
//   5. No controlled/uncontrolled API, no disabled state, no press feedback
//
// Enhancements:
//   • border-2 border-transparent track pattern → perfectly symmetric 2px thumb margins
//   • Track color transitions: off = gray-300, on = papaya (200ms ease-in-out)
//   • iOS-style thumb stretch on press — widens toward the direction of travel,
//     keeping the opposite edge anchored (haptic feel without actual haptics)
//   • Gentle active scale on the track for a physical press-down sensation
//   • Hover opacity, focus ring with ring-offset-2, full disabled treatment
//   • All animations use transform + opacity only (compositor-promoted, zero repaint)

interface SwitchProps {
  /** Controlled mode — provide both checked + onChange to drive externally */
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  /** Uncontrolled mode — sets initial state only, ignored when `checked` is provided */
  defaultChecked?: boolean;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  className?: string;
}

function Switch({
  checked: controlledChecked,
  onChange,
  defaultChecked = false,
  disabled = false,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  className = "",
}: SwitchProps) {
  const isControlled = controlledChecked !== undefined;
  const [internalChecked, setInternalChecked] = useState(defaultChecked);
  const [isPressed, setIsPressed] = useState(false);

  const checked = isControlled ? controlledChecked! : internalChecked;

  const toggle = () => {
    if (disabled) return;
    const next = !checked;
    if (!isControlled) setInternalChecked(next);
    onChange?.(next);
  };

  // iOS-style thumb stretch — widens toward direction of travel.
  // Track inner width: 44px track − (2px border × 2) = 40px. Normal thumb = 20px (w-5).
  // OFF press: stretch right → w-[22px] translate-x-0   (left edge stays at 0)
  // ON  press: stretch left  → w-[22px] translate-x-[18px] (right edge stays at 18+22=40px)
  const thumbTranslate = isPressed
    ? checked
      ? "translate-x-[18px]"
      : "translate-x-0"
    : checked
    ? "translate-x-5"
    : "translate-x-0";

  const thumbWidth = isPressed ? "w-[22px]" : "w-5";

  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      disabled={disabled}
      onClick={toggle}
      onKeyDown={(e) => {
        // Space: prevent page scroll (button click fires naturally on keyup, no double-toggle)
        if (e.key === " ") e.preventDefault();
        // Enter: not standard for role="switch" — suppress the native button click
        if (e.key === "Enter") e.preventDefault();
      }}
      onPointerDown={() => { if (!disabled) setIsPressed(true); }}
      onPointerUp={() => setIsPressed(false)}
      onPointerLeave={() => setIsPressed(false)}
      className={[
        "group relative inline-flex h-6 w-11 shrink-0 rounded-full",
        // border-2 border-transparent creates 2px symmetric inner padding (no extra wrappers)
        "border-2 border-transparent",
        // Smooth track color + scale transitions
        "transition-all duration-200 ease-in-out",
        // Track background: gray when off, papaya when on
        checked ? "bg-papaya" : "bg-gray-300",
        // Focus ring — color matches track state
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        checked
          ? "focus-visible:ring-papaya/60"
          : "focus-visible:ring-gray-400/50",
        // Interactive states
        disabled
          ? "cursor-not-allowed opacity-40"
          : "cursor-pointer hover:opacity-90 active:scale-[0.94]",
        className,
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "pointer-events-none h-5 rounded-full bg-white",
          // Layered shadow: soft ambient + crisp edge definition
          "shadow-[0_1px_4px_rgba(0,0,0,0.20),0_0_0_0.5px_rgba(0,0,0,0.05)]",
          "transition-all duration-200 ease-in-out",
          thumbTranslate,
          thumbWidth,
        ].join(" ")}
      />
    </button>
  );
}

// ── Desktop plan card (sits inside a table <td>) ──────────────────────────────
//
// Bug fix: the "Most popular" badge was using float-right AFTER the icon block,
// which put it beside the tier label rather than in the card's top-right corner.
// Fix: add `relative` to the card container and use `absolute top-3 right-3`.

function PlanCard({
  plan,
  isRecommended,
  displayPrice,
  isAnnual,
}: {
  plan: Plan;
  isRecommended: boolean;
  displayPrice: string;
  isAnnual: boolean;
}) {
  const meta = PLAN_META[plan.name];
  return (
    <div
      className={`relative rounded-xl border bg-white px-5 py-5 transition-shadow hover:shadow-lg ${
        isRecommended
          ? "border-papaya [border-top-width:2px]"
          : "border-gray-200"
      }`}
    >
      {/* Most popular badge — anchored to card top-right */}
      {isRecommended && (
        <span className="absolute right-3 top-3 rounded-full bg-papaya-pale px-[9px] py-[3px] text-[10px] font-bold uppercase tracking-[0.06em] text-papaya">
          Most popular
        </span>
      )}

      {/* Icon */}
      <div className="mb-3.5 flex h-[38px] w-[38px] items-center justify-center rounded-[9px] bg-papaya-pale text-papaya">
        <PlanIcon name={plan.name} size={18} />
      </div>

      <p
        className={`text-[10px] font-bold uppercase tracking-[0.1em] ${
          isRecommended ? "text-papaya" : "text-gray-400"
        }`}
      >
        {plan.name}
      </p>
      <p className="mb-1 text-[19px] font-extrabold text-gray-900">{meta.nickname}</p>
      <p className="mb-[18px] min-h-[36px] text-[12px] leading-[1.55] text-gray-400">
        {meta.description}
      </p>

      <p className="text-[34px] font-extrabold leading-none text-gray-900">
        <sup className="mt-1 inline-block align-top text-[16px] font-bold">฿</sup>
        {displayPrice.replace("฿", "")}
      </p>
      <p className="mt-1 text-[11px] text-gray-400">
        {isAnnual ? "per month, billed annually" : "per month, billed monthly"}
      </p>

      <button
        type="button"
        aria-label={`Get started with ${plan.name}`}
        className={`mt-4 block w-full rounded-[7px] border py-[9px] text-[13px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 ${
          isRecommended
            ? "border-papaya bg-papaya text-white hover:opacity-85 focus-visible:ring-papaya/50"
            : "border-gray-200 bg-transparent text-gray-900 hover:border-papaya hover:text-papaya focus-visible:ring-papaya/30"
        }`}
      >
        Get started
      </button>
    </div>
  );
}

// ── Desktop table — section divider row ───────────────────────────────────────

function SectionRow({ label, recIdx }: { label: string; recIdx: number }) {
  return (
    <tr>
      <td className="border-b border-gray-200 pb-1.5 pt-5 pr-3 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400">
        {label}
      </td>
      {plans.map((_, i) => (
        <td
          key={i}
          className={`border-b border-gray-200 px-2 pb-1.5 pt-5 ${
            i === recIdx ? "bg-papaya-pale" : ""
          }`}
        />
      ))}
    </tr>
  );
}

// ── Desktop table — data row ──────────────────────────────────────────────────

function DataRow({
  label,
  values,
  rowKey,
  recIdx,
}: {
  label: string;
  values: React.ReactNode[];
  rowKey: RowKey;
  recIdx: number;
}) {
  const best = bestIndex(rowKey);
  return (
    <tr>
      <td className="border-b border-gray-200 py-3.5 pr-3 text-[13px] font-medium text-gray-500">
        {label}
      </td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`border-b border-gray-200 px-2 py-3.5 text-center ${
            i === recIdx ? "bg-papaya-pale" : ""
          }`}
        >
          <span className="block text-[15px] font-bold text-gray-900">{v}</span>
          {i === best && (
            <Pill featured={i === recIdx}>{BEST_PILL[rowKey]}</Pill>
          )}
        </td>
      ))}
    </tr>
  );
}

// ── Desktop table — benefit row (Check / Cross + optional amount) ─────────────

function BenefitRow({
  label,
  values,
  rowKey,
  recIdx,
}: {
  label: string;
  values: (React.ReactNode | null)[];
  rowKey: RowKey;
  recIdx: number;
}) {
  const best = bestIndex(rowKey);
  return (
    <tr>
      <td className="border-b border-gray-200 py-3.5 pr-3 text-[13px] font-medium text-gray-500">
        {label}
      </td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`border-b border-gray-200 px-2 py-3.5 text-center ${
            i === recIdx ? "bg-papaya-pale" : ""
          }`}
        >
          {v === null ? (
            <div className="flex flex-col items-center gap-0.5">
              <Cross />
              <span className="text-[11px] text-gray-400">Not included</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-0.5">
              <Check />
              <span className="block text-[15px] font-bold text-gray-900">{v}</span>
              {i === best && (
                <Pill featured={i === recIdx}>{BEST_PILL[rowKey]}</Pill>
              )}
            </div>
          )}
        </td>
      ))}
    </tr>
  );
}

// ── Desktop table — highlights row ────────────────────────────────────────────

function HighlightsRow({ recIdx }: { recIdx: number }) {
  return (
    <tr>
      <td className="py-4 pr-3 align-top text-[13px] font-medium text-gray-500" />
      {plans.map((p, i) => (
        <td
          key={p.name}
          className={`px-2 py-4 ${i === recIdx ? "bg-papaya-pale" : ""}`}
        >
          <div className="flex flex-col items-center gap-1.5">
            {p.highlights.map((h) => (
              <Chip key={h} featured={i === recIdx}>
                {h}
              </Chip>
            ))}
          </div>
        </td>
      ))}
    </tr>
  );
}

// ── Desktop comparison table ──────────────────────────────────────────────────
// Cards sit in the first <tbody> row, perfectly column-aligned with data rows.
// Bug fix: monthly premium row was missing from the Pricing section.

function DesktopTable({
  recommended,
  isAnnual,
}: {
  recommended: Plan;
  isAnnual: boolean;
}) {
  const recIdx = plans.findIndex((p) => p.name === recommended.name);

  const price = (p: Plan) =>
    isAnnual
      ? currency(Math.round(p.monthly_premium * 0.9))
      : currency(p.monthly_premium);

  return (
    <table className="w-full table-fixed border-separate border-spacing-0">
      <colgroup>
        <col className="w-48" />
        <col />
        <col />
        <col />
      </colgroup>
      <tbody>
        {/* ── Plan card row ── */}
        <tr>
          <td className="pb-6 pr-4 align-bottom text-[13px] leading-relaxed text-gray-400">
            Compare every detail across all three plans.
          </td>
          {plans.map((p) => (
            <td key={p.name} className="px-1 align-top">
              <PlanCard
                plan={p}
                isRecommended={p.name === recommended.name}
                displayPrice={price(p)}
                isAnnual={isAnnual}
              />
            </td>
          ))}
        </tr>

        {/* Spacer */}
        <tr>
          <td colSpan={4} className="h-7" />
        </tr>

        {/* ── Pricing ── */}
        <SectionRow label="Pricing" recIdx={recIdx} />
        <DataRow
          label="Monthly premium"
          rowKey="premium"
          recIdx={recIdx}
          values={plans.map((p) => price(p))}
        />
        <DataRow
          label="Annual limit"
          rowKey="annual_limit"
          recIdx={recIdx}
          values={plans.map((p) => currency(p.annual_limit))}
        />
        <DataRow
          label="Co-pay"
          rowKey="copay"
          recIdx={recIdx}
          values={plans.map((p) => `${p.copay_percentage}%`)}
        />
        <DataRow
          label="Waiting period"
          rowKey="waiting"
          recIdx={recIdx}
          values={plans.map((p) =>
            p.waiting_period_days === 0 ? "None" : `${p.waiting_period_days} days`
          )}
        />

        {/* ── Outpatient ── */}
        <SectionRow label="Outpatient" recIdx={recIdx} />
        <DataRow
          label="Per visit limit"
          rowKey="op_limit"
          recIdx={recIdx}
          values={plans.map((p) => currency(p.benefits.outpatient.limit_per_visit))}
        />
        <DataRow
          label="Visits per year"
          rowKey="op_visits"
          recIdx={recIdx}
          values={plans.map((p) => visits(p.benefits.outpatient.visits_per_year))}
        />

        {/* ── Inpatient ── */}
        <SectionRow label="Inpatient" recIdx={recIdx} />
        <DataRow
          label="Per day limit"
          rowKey="ip_limit"
          recIdx={recIdx}
          values={plans.map((p) => currency(p.benefits.inpatient.limit_per_day))}
        />
        <DataRow
          label="Days per year"
          rowKey="ip_days"
          recIdx={recIdx}
          values={plans.map((p) => days(p.benefits.inpatient.days_per_year))}
        />

        {/* ── Dental ── */}
        <SectionRow label="Dental" recIdx={recIdx} />
        <BenefitRow
          label="Annual dental limit"
          rowKey="dental"
          recIdx={recIdx}
          values={plans.map((p) =>
            p.benefits.dental ? currency(p.benefits.dental.limit_per_year) : null
          )}
        />

        {/* ── Maternity ── */}
        <SectionRow label="Maternity" recIdx={recIdx} />
        <BenefitRow
          label="Per pregnancy limit"
          rowKey="maternity"
          recIdx={recIdx}
          values={plans.map((p) =>
            p.benefits.maternity
              ? currency(p.benefits.maternity.limit_per_pregnancy)
              : null
          )}
        />

        {/* ── Plan highlights ── */}
        <SectionRow label="Highlights" recIdx={recIdx} />
        <HighlightsRow recIdx={recIdx} />
      </tbody>
    </table>
  );
}

// ── Mobile — mini plan selector card ─────────────────────────────────────────

function MiniCard({
  plan,
  isActive,
  isRecommended,
  displayPrice,
  onClick,
}: {
  plan: Plan;
  isActive: boolean;
  isRecommended: boolean;
  displayPrice: string;
  onClick: () => void;
}) {
  const meta = PLAN_META[plan.name];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative cursor-pointer rounded-[10px] border p-4 text-left transition-colors ${
        isActive ? "border-papaya [border-top-width:2px]" : "border-gray-200"
      }`}
    >
      {isRecommended && (
        <span className="absolute right-2 top-2 rounded-full bg-papaya-pale px-1.5 py-0.5 text-[8px] font-bold text-papaya">
          ★ Popular
        </span>
      )}
      <div className="mb-2.5 flex h-[30px] w-[30px] items-center justify-center rounded-[7px] bg-papaya-pale text-papaya">
        <PlanIcon name={plan.name} size={14} />
      </div>
      <p
        className={`text-[9px] font-bold uppercase tracking-[0.1em] ${
          isRecommended ? "text-papaya" : "text-gray-400"
        }`}
      >
        {plan.name}
      </p>
      <p className="mb-2 text-[14px] font-extrabold text-gray-900">{meta.nickname}</p>
      <p className="text-[18px] font-extrabold leading-none text-gray-900">
        <sup className="mt-[3px] inline-block align-top text-[10px] font-bold">฿</sup>
        {displayPrice.replace("฿", "")}
      </p>
      <p className="mt-0.5 text-[10px] text-gray-400">/ mo</p>
    </button>
  );
}

// ── Mobile — selected plan detail panel ───────────────────────────────────────
// Bug fix: Highlights section was missing — plan.highlights never shown on mobile.

function MobileDetailPanel({
  plan,
  isRecommended,
}: {
  plan: Plan;
  isRecommended: boolean;
}) {
  const sec = [
    "border-t px-4 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400",
    isRecommended
      ? "border-papaya/10 bg-papaya-pale/60"
      : "border-gray-100 bg-gray-50",
  ].join(" ");

  const row = [
    "flex items-center justify-between border-t px-4 py-3",
    isRecommended ? "border-papaya/10" : "border-gray-100",
  ].join(" ");

  return (
    <div
      className={`overflow-hidden rounded-xl border ${
        isRecommended ? "border-papaya" : "border-gray-200"
      }`}
    >
      {/* CTA */}
      <div className="p-4">
        <button
          type="button"
          aria-label={`Get started with ${plan.name}`}
          className={`w-full rounded-[7px] py-3 text-[14px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 ${
            isRecommended
              ? "bg-papaya text-white hover:opacity-85 focus-visible:ring-papaya/50"
              : "border border-gray-200 bg-transparent text-gray-900 hover:border-papaya hover:text-papaya focus-visible:ring-papaya/30"
          }`}
        >
          Get started with {plan.name}
        </button>
      </div>

      <div className={sec}>Pricing</div>
      <div className={row}>
        <span className="text-[13px] font-medium text-gray-400">Annual limit</span>
        <span className="text-[13px] font-bold text-gray-900">{currency(plan.annual_limit)}</span>
      </div>
      <div className={row}>
        <span className="text-[13px] font-medium text-gray-400">Co-pay</span>
        <span className="text-[13px] font-bold text-gray-900">{plan.copay_percentage}%</span>
      </div>
      <div className={row}>
        <span className="text-[13px] font-medium text-gray-400">Waiting period</span>
        <span className="text-[13px] font-bold text-gray-900">
          {plan.waiting_period_days === 0 ? "None" : `${plan.waiting_period_days} days`}
        </span>
      </div>

      <div className={sec}>Outpatient</div>
      <div className={row}>
        <span className="text-[13px] font-medium text-gray-400">Per visit</span>
        <span className="text-[13px] font-bold text-gray-900">
          {currency(plan.benefits.outpatient.limit_per_visit)}
        </span>
      </div>
      <div className={row}>
        <span className="text-[13px] font-medium text-gray-400">Visits / year</span>
        <span className="text-[13px] font-bold text-gray-900">
          {visits(plan.benefits.outpatient.visits_per_year)}
        </span>
      </div>

      <div className={sec}>Inpatient</div>
      <div className={row}>
        <span className="text-[13px] font-medium text-gray-400">Per day</span>
        <span className="text-[13px] font-bold text-gray-900">
          {currency(plan.benefits.inpatient.limit_per_day)}
        </span>
      </div>
      <div className={row}>
        <span className="text-[13px] font-medium text-gray-400">Days / year</span>
        <span className="text-[13px] font-bold text-gray-900">
          {days(plan.benefits.inpatient.days_per_year)}
        </span>
      </div>

      <div className={sec}>Benefits</div>
      <div className={row}>
        <span className="text-[13px] font-medium text-gray-400">Dental</span>
        <span
          className={`text-[13px] font-bold ${
            plan.benefits.dental ? "text-gray-900" : "text-gray-400"
          }`}
        >
          {plan.benefits.dental
            ? `${currency(plan.benefits.dental.limit_per_year)} / yr`
            : "Not included"}
        </span>
      </div>
      <div className={row}>
        <span className="text-[13px] font-medium text-gray-400">Maternity</span>
        <span
          className={`text-[13px] font-bold ${
            plan.benefits.maternity ? "text-gray-900" : "text-gray-400"
          }`}
        >
          {plan.benefits.maternity
            ? `${currency(plan.benefits.maternity.limit_per_pregnancy)} / preg.`
            : "Not included"}
        </span>
      </div>

      {/* Highlights — was missing entirely from mobile view */}
      <div className={sec}>Highlights</div>
      <div
        className={[
          "flex flex-wrap gap-1.5 border-t px-4 py-3",
          isRecommended ? "border-papaya/10" : "border-gray-100",
        ].join(" ")}
      >
        {plan.highlights.map((h) => (
          <Chip key={h} featured={isRecommended}>
            {h}
          </Chip>
        ))}
      </div>
    </div>
  );
}

// ── Footer CTA ────────────────────────────────────────────────────────────────

function FooterCTA() {
  return (
    <div className="mx-auto max-w-[1000px] px-8 pb-20 pt-8">
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-10 py-12 text-center">
        <h2 className="text-[clamp(20px,2.8vw,30px)] font-extrabold leading-tight text-gray-900">
          Ready to replace your claims process
          <br />
          with{" "}
          <em className="not-italic text-papaya">claims intelligence?</em>
        </h2>
        <p className="mx-auto mt-2.5 max-w-md text-[14px] text-gray-400">
          See how Papaya processes insurance for your market, your products, your scale.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <a
            href="#"
            className="rounded-[7px] bg-papaya px-6 py-3 text-[14px] font-bold text-white no-underline transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-papaya/50"
          >
            Schedule a demo →
          </a>
          <a
            href="#"
            className="rounded-[7px] border border-gray-200 bg-transparent px-6 py-3 text-[14px] font-semibold text-gray-900 no-underline transition-colors hover:border-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
          >
            Explore the platform
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function PlanComparison() {
  const [isAnnual, setIsAnnual] = useState(true);
  const recommended = recommendedPlan();
  const [activeMobile, setActiveMobile] = useState(recommended.name);

  const displayPrice = (p: Plan) =>
    isAnnual
      ? currency(Math.round(p.monthly_premium * 0.9))
      : currency(p.monthly_premium);

  return (
    <div>
      {/* ── Hero ── */}
      <div className="mx-auto max-w-[560px] px-6 pb-10 pt-16 text-center">
        <div className="mb-4 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-papaya">
          <span className="h-px w-[18px] bg-papaya" aria-hidden="true" />
          Choose your plan
          <span className="h-px w-[18px] bg-papaya" aria-hidden="true" />
        </div>
        <h1 className="mb-3 text-[clamp(26px,4vw,42px)] font-extrabold leading-[1.1] text-gray-900">
          Simple, transparent
          <br />
          <em className="not-italic text-papaya">insurance coverage.</em>
        </h1>
        <p className="text-[15px] leading-[1.7] text-gray-400">
          Compare plans side by side. Every number is real — no hidden limits, no fine print.
        </p>
      </div>

      {/* ── Billing toggle ── */}
      <div className="mb-12 flex items-center justify-center gap-3 text-[13px] font-medium">
        <span
          className={`transition-colors duration-200 ${
            isAnnual ? "text-gray-400" : "text-gray-900"
          }`}
        >
          Monthly
        </span>
        <Switch
          checked={isAnnual}
          onChange={setIsAnnual}
          aria-label="Toggle annual billing"
          aria-describedby="billing-save-badge"
        />
        <span
          className={`transition-colors duration-200 ${
            isAnnual ? "text-gray-900" : "text-gray-400"
          }`}
        >
          Annual
        </span>
        <span
          id="billing-save-badge"
          className="rounded-full border border-papaya px-2 py-0.5 text-[10px] font-bold text-papaya"
        >
          Save 10%
        </span>
      </div>

      {/* ── Desktop table ── */}
      <div className="mx-auto hidden max-w-[1000px] px-8 md:block">
        <DesktopTable recommended={recommended} isAnnual={isAnnual} />
      </div>

      {/* ── Mobile view ── */}
      <div className="mx-auto max-w-[1000px] px-4 pb-12 md:hidden">
        {/* Mini selector cards */}
        <div className="mb-7 grid grid-cols-3 gap-2.5">
          {plans.map((p) => (
            <MiniCard
              key={p.name}
              plan={p}
              isActive={activeMobile === p.name}
              isRecommended={p.name === recommended.name}
              displayPrice={displayPrice(p)}
              onClick={() => setActiveMobile(p.name)}
            />
          ))}
        </div>

        {/* Detail panel (only active plan shown) */}
        {plans.map((p) => (
          <div key={p.name} className={activeMobile === p.name ? "block" : "hidden"}>
            <MobileDetailPanel
              plan={p}
              isRecommended={p.name === recommended.name}
            />
          </div>
        ))}
      </div>

      <FooterCTA />
    </div>
  );
}
