export type OutpatientBenefit = {
  limit_per_visit: number;
  visits_per_year: number;
};

export type InpatientBenefit = {
  limit_per_day: number;
  days_per_year: number;
};

export type DentalBenefit = {
  limit_per_year: number;
};

export type MaternityBenefit = {
  limit_per_pregnancy: number;
};

export type Plan = {
  name: string;
  monthly_premium: number;
  annual_limit: number;
  benefits: {
    outpatient: OutpatientBenefit;
    inpatient: InpatientBenefit;
    dental: DentalBenefit | null;
    maternity: MaternityBenefit | null;
  };
  copay_percentage: number;
  waiting_period_days: number;
  highlights: string[];
};

export const plans: Plan[] = [
  {
    name: "Bronze",
    monthly_premium: 150,
    annual_limit: 500000,
    benefits: {
      outpatient: { limit_per_visit: 3000, visits_per_year: 30 },
      inpatient: { limit_per_day: 10000, days_per_year: 60 },
      dental: null,
      maternity: null,
    },
    copay_percentage: 20,
    waiting_period_days: 30,
    highlights: ["Basic coverage", "No dental or maternity"],
  },
  {
    name: "Silver",
    monthly_premium: 350,
    annual_limit: 1500000,
    benefits: {
      outpatient: { limit_per_visit: 5000, visits_per_year: 60 },
      inpatient: { limit_per_day: 25000, days_per_year: 120 },
      dental: { limit_per_year: 30000 },
      maternity: null,
    },
    copay_percentage: 10,
    waiting_period_days: 15,
    highlights: ["Includes dental", "Lower copay", "Higher limits"],
  },
  {
    name: "Gold",
    monthly_premium: 700,
    annual_limit: 5000000,
    benefits: {
      outpatient: { limit_per_visit: 10000, visits_per_year: -1 },
      inpatient: { limit_per_day: 50000, days_per_year: -1 },
      dental: { limit_per_year: 100000 },
      maternity: { limit_per_pregnancy: 200000 },
    },
    copay_percentage: 0,
    waiting_period_days: 0,
    highlights: ["Full coverage", "No copay", "No waiting period", "Unlimited visits"],
  },
];

/**
 * Value-for-money score balancing coverage quality and affordability.
 * Weighs annual coverage per baht spent, benefit breadth, and copay burden,
 * with an affordability multiplier so mid-tier plans aren't penalised purely
 * for having a lower absolute limit.
 */
export function valueScore(plan: Plan): number {
  const benefitBonus =
    1 +
    (plan.benefits.dental ? 0.15 : 0) +
    (plan.benefits.maternity ? 0.1 : 0);
  const coveragePerBaht =
    (plan.annual_limit / plan.monthly_premium) *
    (1 - plan.copay_percentage / 100) *
    benefitBonus;
  const maxPremium = Math.max(...plans.map((p) => p.monthly_premium));
  const affordabilityMultiplier = Math.pow(maxPremium / plan.monthly_premium, 0.45);
  return coveragePerBaht * affordabilityMultiplier;
}

export function recommendedPlan(): Plan {
  return plans.reduce((best, p) => (valueScore(p) > valueScore(best) ? p : best));
}
