"use client";

import { useState } from "react";
import { plans, recommendedPlan, type Plan } from "../data/plans";

// ── Formatter (unchanged business logic) ─────────────────────────────────────

function currency(n: number) {
  return "฿" + n.toLocaleString();
}

// ── Plan display metadata ─────────────────────────────────────────────────────

const PLAN_META: Record<string, { description: string }> = {
  Bronze: { description: "Essential protection for individuals starting out." },
  Silver: { description: "The sweet spot — dental included, lower copay." },
  Gold: {
    description: "Full coverage, zero copay, no waiting period. \u00A0",
  },
};

// ── Feature list ──────────────────────────────────────────────────────────────

type Feature = { included: boolean; content: React.ReactNode };

function getPlanFeatures(plan: Plan): Feature[] {
  const opV = plan.benefits.outpatient.visits_per_year;
  const ipD = plan.benefits.inpatient.days_per_year;

  return [
    {
      included: true,
      content: (
        <>
          Annual limit up to <strong>{currency(plan.annual_limit)}</strong>
        </>
      ),
    },
    {
      included: true,
      content: (
        <div className="flex flex-col gap-1">
          <div>
            Outpatient{" "}
            <strong>
              {currency(plan.benefits.outpatient.limit_per_visit)}
            </strong>{" "}
            per visit
          </div>

          <div className="text-sm text-muted-foreground">
            {opV === -1 ? (
              <strong>Unlimited visits</strong>
            ) : (
              <>
                <strong>{opV}</strong> visits per year
              </>
            )}
          </div>
        </div>
      ),
    },
    {
      included: true,
      content: (
        <>
          Inpatient{" "}
          <strong>{currency(plan.benefits.inpatient.limit_per_day)}</strong> per
          day ·{" "}
          <div className="text-sm text-muted-foreground">
            {ipD === -1 ? (
              <strong>Unlimited day</strong>
            ) : (
              <>
                <strong>{ipD}</strong> days per year
              </>
            )}
          </div>
        </>
      ),
    },
    {
      included: true,
      content:
        plan.copay_percentage === 0 ? (
          <>
            <strong>0%</strong> co-pay — fully covered
          </>
        ) : (
          <>
            Co-pay <strong>{plan.copay_percentage}%</strong> per claim
          </>
        ),
    },
    {
      included: true,
      content:
        plan.waiting_period_days === 0 ? (
          <strong>No waiting period</strong>
        ) : (
          <>
            Waiting period <strong>{plan.waiting_period_days} days</strong>
          </>
        ),
    },
    {
      included: !!plan.benefits.dental,
      content: plan.benefits.dental ? (
        <>
          Dental up to{" "}
          <strong>{currency(plan.benefits.dental.limit_per_year)}</strong> per
          year
        </>
      ) : (
        <>Dental coverage</>
      ),
    },
    {
      included: !!plan.benefits.maternity,
      content: plan.benefits.maternity ? (
        <>
          Maternity up to{" "}
          <strong>
            {currency(plan.benefits.maternity.limit_per_pregnancy)}{" "}
          </strong>
          per pregnancy
        </>
      ) : (
        <>Maternity coverage</>
      ),
    },
  ];
}

// ── Switch component ──────────────────────────────────────────────────────────
// Supports controlled (checked + onChange) and uncontrolled (defaultChecked) modes.
// All animations use transform + opacity only (compositor-promoted, zero repaint).

interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
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

  // iOS-style thumb stretch on press — widens toward direction of travel.
  // Track inner width: 44px − (2px border × 2) = 40px. Normal thumb = 20px (w-5).
  // OFF press: stretch right → w-[22px] translate-x-0   (left edge stays at 0)
  // ON  press: stretch left  → w-[22px] translate-x-[18px] (right edge stays at 40px)
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
        if (e.key === " ") e.preventDefault(); // stop page scroll; click fires on keyup
        if (e.key === "Enter") e.preventDefault(); // not standard for role="switch"
      }}
      onPointerDown={() => {
        if (!disabled) setIsPressed(true);
      }}
      onPointerUp={() => setIsPressed(false)}
      onPointerLeave={() => setIsPressed(false)}
      className={[
        "group relative inline-flex h-6 w-11 shrink-0 rounded-full",
        "border-2 border-transparent",
        "transition-all duration-200 ease-in-out",
        checked ? "bg-papaya" : "bg-gray-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        checked
          ? "focus-visible:ring-papaya/60"
          : "focus-visible:ring-gray-400/50",
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
          "shadow-[0_1px_4px_rgba(0,0,0,0.20),0_0_0_0.5px_rgba(0,0,0,0.05)]",
          "transition-all duration-200 ease-in-out",
          thumbTranslate,
          thumbWidth,
        ].join(" ")}
      />
    </button>
  );
}

// ── Feature list item ─────────────────────────────────────────────────────────

function FeatureItem({
  included,
  children,
}: {
  included: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      className={`flex items-start gap-[10px] text-[13px] font-medium leading-[1.45] ${
        included ? "text-[#555]" : "text-gray-400"
      }`}
    >
      <span
        className={`mt-[2px] shrink-0 ${included ? "text-papaya" : "text-gray-300"}`}
        aria-hidden="true"
      >
        <svg
          width="14"
          height="11"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="1 5.5 5 9.5 13 1" />
        </svg>
      </span>
      <span>{children}</span>
    </li>
  );
}

// ── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  isRecommended,
  isAnnual,
  onToggleBilling,
}: {
  plan: Plan;
  isRecommended: boolean;
  isAnnual: boolean;
  onToggleBilling: () => void;
}) {
  const meta = PLAN_META[plan.name];
  const monthlyBase = plan.monthly_premium;
  const annualMonthly = Math.round(monthlyBase * 0.9);
  const displayPrice = isAnnual ? annualMonthly : monthlyBase;
  const features = getPlanFeatures(plan);

  return (
    <article
      className={`relative rounded-[14px] border bg-white px-6 py-7   shadow-[0_8px_30px_rgba(0,0,0,0.08)]
  hover:shadow-[0_16px_40px_rgba(0,0,0,0.12)]
  hover:-translate-y-1
  transition-all
  duration-300 ${
    isRecommended ? "border-papaya [border-top-width:2px]" : "border-[#E8E8E8]"
  }`}
    >
      {/* Most popular badge */}
      {isRecommended && (
        <div className="mb-3.5 absolute right-1 top-1">
          <span className="rounded-full bg-papaya-pale px-[10px] py-[4px] text-[10px] font-bold uppercase tracking-[0.07em] text-papaya">
            ★ Most popular
          </span>
        </div>
      )}

      {/* Plan name */}
      <p className="mb-1 text-[20px] font-extrabold tracking-tight text-gray-900">
        {plan.name} Plan
      </p>
      <p className="mb-4 text-[12px] leading-relaxed text-[#999]">
        {meta.description}
      </p>

      {/* Price row */}
      <div className="mb-1 flex items-baseline gap-2">
        {isAnnual && (
          <span className="text-[18px] font-semibold text-gray-300 line-through">
            ฿{monthlyBase.toLocaleString()}
          </span>
        )}
        <span className="text-[32px] font-extrabold leading-none tracking-tight text-gray-900">
          <sup className="mr-px mt-[4px] inline-block align-top text-[16px] font-bold">
            ฿
          </sup>
          {displayPrice.toLocaleString()}
        </span>
        <span className="text-[14px] font-normal text-[#999]">/ month</span>
      </div>
      <p className="mb-5 text-[12px] text-[#999]">
        {isAnnual ? "10% off · Billed annually" : "Billed monthly"}
      </p>

      {/* CTA button */}
      <button
        type="button"
        className={`mb-2 block w-full rounded-[9px] border-[1.5px] py-[11px] text-[14px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 ${
          isRecommended
            ? "border-papaya bg-papaya text-white hover:opacity-85 focus-visible:ring-papaya/50"
            : "border-[#E8E8E8] bg-[#F6F6F6] text-gray-900 hover:border-papaya hover:bg-white hover:text-papaya focus-visible:ring-papaya/30"
        }`}
      >
        Get started
      </button>

      {/* View billing link */}
      <button
        type="button"
        onClick={onToggleBilling}
        className="mb-5 block w-full text-center text-[12px] font-medium text-[#999] transition-colors hover:text-papaya"
      >
        {isAnnual ? "View Monthly Billing ↗" : "View Annual Billing ↗"}
      </button>

      {/* Divider */}
      <hr className="mb-5 border-t border-[#E8E8E8]" />

      {/* Feature list */}
      <ul className="flex flex-col gap-[11px]">
        {features.map((item, i) => (
          <FeatureItem key={i} included={item.included}>
            {item.content}
          </FeatureItem>
        ))}
      </ul>
    </article>
  );
}

// ── Footer CTA ────────────────────────────────────────────────────────────────

function FooterCTA() {
  return (
    <div className="mx-auto max-w-[1020px] px-8 pb-20">
      <div className="rounded-[14px] border border-[#E8E8E8] bg-[#F6F6F6] px-10 py-12 text-center">
        <h2 className="mb-2.5 text-[clamp(20px,2.8vw,30px)] font-extrabold leading-tight tracking-tight text-gray-900">
          Ready to replace your claims process
          <br />
          with <em className="not-italic text-papaya">claims intelligence?</em>
        </h2>
        <p className="mx-auto mb-[22px] max-w-md text-[14px] text-[#999]">
          See how Papaya processes insurance for your market, your products,
          your scale.
        </p>
        <div className="flex flex-wrap justify-center gap-2.5">
          <a
            href="#"
            className="rounded-[8px] bg-papaya px-6 py-[11px] text-[14px] font-bold text-white no-underline transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-papaya/50"
          >
            Schedule a demo →
          </a>
          <a
            href="#"
            className="rounded-[8px] border-[1.5px] border-[#E8E8E8] bg-transparent px-6 py-[11px] text-[14px] font-semibold text-gray-900 no-underline transition-colors hover:border-[#888] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
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

  return (
    <div>
      {/* ── Hero ── */}
      <div className="mx-auto max-w-[560px] px-6 pb-9 pt-16 text-center">
        <div className="eyebrow mb-4 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-papaya">
          <span className="h-px w-[18px] bg-papaya" aria-hidden="true" />
          Choose your plan
          <span className="h-px w-[18px] bg-papaya" aria-hidden="true" />
        </div>
        <h1 className="mb-3 text-[clamp(26px,4vw,42px)] font-extrabold leading-[1.1] text-gray-900">
          Simple, transparent
          <br />
          <em className="not-italic text-papaya">insurance coverage.</em>
        </h1>
        <p className="text-[15px] leading-[1.7] text-[#999]">
          Compare plans side by side. Every number is real — no hidden limits,
          no fine print.
        </p>
      </div>

      {/* ── Billing toggle ── */}
      <div className="mb-11 flex items-center justify-center gap-[10px] text-[13px] font-medium text-[#555]">
        <span
          className={`transition-colors duration-200 ${
            isAnnual ? "text-[#999]" : "text-gray-900"
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
            isAnnual ? "text-gray-900" : "text-[#999]"
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

      {/* ── Plan cards grid ── */}
      <div className="mx-auto max-w-[1020px] px-8 pb-20">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {plans.map((p) => (
            <PlanCard
              key={p.name}
              plan={p}
              isRecommended={p.name === recommended.name}
              isAnnual={isAnnual}
              onToggleBilling={() => setIsAnnual((v) => !v)}
            />
          ))}
        </div>
      </div>

      <FooterCTA />
    </div>
  );
}
