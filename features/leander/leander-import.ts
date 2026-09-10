import type { CsvRow } from "@/features/leads/lead-import";

export type LenderImportResult = {
  lender: {
    lenderId: string;
    name: string;
    isActive: boolean;
    priority: number;
    flow: "OTP" | "REDIRECT" | "API" | "MANUAL";
    eligibility: {
      age: { min: number; max: number };
      income: { minAnnual: number };
      creditScore: { minExclusive: number; maxInclusive: number };
      employmentTypes: (
        | "salaried"
        | "self_employed"
        | "business"
        | "professional"
      )[];
    };
    geography: { allPincodes: boolean; supportedPincodes: string[] };
    leadLimits: { maxLeadsPerDay?: number };
    preflight: { enabled: boolean };
    application: { leadOnly: boolean; minAppVersion?: string };
    offer: { approval?: boolean; canShowProvisionalOffer: boolean };
  };
  sourceRow: number;
};

const normalizeHeader = (header: string) =>
  header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const valueFrom = (row: CsvRow, ...names: string[]) => {
  const normalizedRow = Object.entries(row).reduce<Record<string, string>>(
    (values, [key, value]) => {
      values[normalizeHeader(key)] = value?.trim() ?? "";
      return values;
    },
    {}
  );

  for (const name of names) {
    const value = normalizedRow[normalizeHeader(name)];
    if (value) return value;
  }

  return null;
};

const numberFrom = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const booleanFrom = (value: string | null, defaultValue: boolean) => {
  if (!value) return defaultValue;
  if (["true", "1", "yes"].includes(value.toLowerCase())) return true;
  if (["false", "0", "no"].includes(value.toLowerCase())) return false;
  return null;
};

const listFrom = (value: string | null) =>
  value
    ? value.split(/[|;]/).map((item) => item.trim()).filter(Boolean)
    : [];

const nullable = (value: string | null) => value || undefined;

export function transformLenderRow(
  row: CsvRow,
  sourceRow: number
): LenderImportResult {
  const lenderId = valueFrom(row, "lenderId", "lender_id");
  const name = valueFrom(row, "name", "lenderName", "lender_name");
  const flow = valueFrom(row, "flow", "onboardingFlow", "onboarding_flow");
  const isActive = booleanFrom(valueFrom(row, "isActive", "is_active"), true);
  const priority = numberFrom(valueFrom(row, "priority")) ?? 0;
  const ageMin = numberFrom(valueFrom(row, "ageMin", "minAge", "age_min"));
  const ageMax = numberFrom(valueFrom(row, "ageMax", "maxAge", "age_max"));
  const minAnnual = numberFrom(
    valueFrom(row, "minAnnualIncome", "incomeMinAnnual", "min_annual_income","minIncome")
  );
  const creditMin = numberFrom(
    valueFrom(row, "creditScoreMinExclusive", "minCreditScore", "credit_score_min_exclusive","minCreditScore_exclusive")
  );
  const creditMax = numberFrom(
    valueFrom(row, "creditScoreMaxInclusive", "maxCreditScore", "credit_score_max_inclusive","maxCreditScore_inclusive")
  );
  const employmentTypes = listFrom(
    valueFrom(row, "employmentTypes", "employment_types")
  )[0]?.split("+").map((type) => type.trim().toLowerCase()) ?? [];
  
  const allPincodes = booleanFrom(
    valueFrom(row, "allPincodes", "all_pincodes"),
    false
  );
  const preflightEnabled = booleanFrom(
    valueFrom(row, "preflightEnabled", "preflight_enabled"),
    false
  );
  const leadOnly = booleanFrom(valueFrom(row, "leadOnly", "lead_only"), false);
  const approval = booleanFrom(valueFrom(row, "approval"), false);
  const canShowProvisionalOffer = booleanFrom(
    valueFrom(row, "canShowProvisionalOffer", "can_show_provisional_offer"),
    false
  );

  const validFlows = ["OTP", "REDIRECT", "API", "MANUAL"];
  const validEmploymentTypes = [
    "salaried",
    "self_employed",
    "business",
    "professional",
  ];
  const missing = [
    !lenderId && "lenderId",
    !name && "name",
    !flow && "flow",
    ageMin === null && "ageMin",
    ageMax === null && "ageMax",
    minAnnual === null && "minAnnualIncome",
    creditMin === null && "creditScoreMinExclusive",
    creditMax === null && "creditScoreMaxInclusive",
    isActive === null && "isActive (must be true or false)",
    allPincodes === null && "allPincodes (must be true or false)",
    preflightEnabled === null && "preflightEnabled (must be true or false)",
    leadOnly === null && "leadOnly (must be true or false)",
    approval === null && "approval (must be true or false)",
    canShowProvisionalOffer === null &&
      "canShowProvisionalOffer (must be true or false)",
  ].filter(Boolean);

  const invalid = [
    flow && !validFlows.includes(flow) && "flow must be OTP, REDIRECT, API, or MANUAL",
    ageMin !== null && ageMax !== null && ageMin > ageMax && "ageMin cannot exceed ageMax",
    creditMin !== null && creditMax !== null && creditMin >= creditMax &&
      "creditScoreMinExclusive must be less than creditScoreMaxInclusive",
    employmentTypes.some((type) => !validEmploymentTypes.includes(type)) &&
      "employmentTypes contains an unsupported value",
  ].filter(Boolean);

  if (missing.length > 0 || invalid.length > 0) {
    throw new Error([...missing, ...invalid].join("; "));
  }

  return {
    lender: {
      lenderId: lenderId!,
      name: name!,
      isActive: isActive!,
      priority,
      flow: flow as LenderImportResult["lender"]["flow"],
      eligibility: {
        age: { min: ageMin!, max: ageMax! },
        income: { minAnnual: minAnnual! },
        creditScore: {
          minExclusive: creditMin!,
          maxInclusive: creditMax!,
        },
        employmentTypes: employmentTypes as LenderImportResult["lender"]["eligibility"]["employmentTypes"],
      },
      geography: {
        allPincodes: allPincodes!,
        supportedPincodes: listFrom(
          valueFrom(row, "supportedPincodes", "supported_pincodes", "pincodes")
        ),
      },
      leadLimits: {
        maxLeadsPerDay: numberFrom(
          valueFrom(row, "maxLeadsPerDay", "max_leads_per_day")
        ) ?? undefined,
      },
      preflight: { enabled: preflightEnabled! },
      application: {
        leadOnly: leadOnly!,
        minAppVersion: nullable(
          valueFrom(row, "minAppVersion", "min_app_version")
        ),
      },
      offer: {
        approval: approval!,
        canShowProvisionalOffer: canShowProvisionalOffer!,
      },
    },
    sourceRow,
  };
}
