import type { ILeads } from "./lead.model";

export type CsvRow = Record<string, string>;

export type LeadImportResult = {
  lead: Omit<ILeads, "_id">;
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

const dateFrom = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const nullable = (value: string | null) => value || null;

export function transformLeadRow(row: CsvRow, sourceDocumentId: string, sourceRow: number): LeadImportResult {
  const firstName = valueFrom(row, "firstName", "first_name", "firstname", "name");
  const lastName = valueFrom(row, "lastName", "last_name", "lastname");
  const phone = valueFrom(row, "phone", "mobile", "mobileNumber", "phoneNumber","_doc_id");
  const addressLine1 = valueFrom(
    row,
    "address1",
    "address_1",
    "addressLine1",
    "address_line_1",
    "address"
  );
  const addressLine2 = valueFrom(
    row,
    "address2",
    "address_2",
    "addressLine2",
    "address_line_2"
  );

  const missing = [
    !firstName && "firstName",
    !lastName && "lastName",
    !phone && "phone",
    addressLine2 && !addressLine1 && "address1 (required when address2 is provided)",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }

  const lead = {
    personal: {
      firstName: firstName!,
      lastName: lastName!,
      nickname: nullable(valueFrom(row, "nickname", "nickName")),
      fatherName: nullable(valueFrom(row, "fatherName", "father_name")),
      motherName: nullable(valueFrom(row, "motherName", "mother_name")),
      dob: dateFrom(valueFrom(row, "dob", "dateOfBirth", "date_of_birth")),
      gender: nullable(valueFrom(row, "gender")) as "male" | "female" | "other" | null,
      maritalStatus: nullable(valueFrom(row, "maritalStatus", "marital_status")),
      numberOfKids: numberFrom(valueFrom(row, "numberOfKids", "number_of_kids", "kids")),
      preferredLanguage: valueFrom(row, "preferredLanguage", "preferred_language") || "hi",
    },
    contact: {
      phone: phone!,
      personalEmail: nullable(valueFrom(row, "personalEmail", "personal_email", "email")),
      officialEmail: nullable(valueFrom(row, "officialEmail", "official_email")),
    },
    addresses: addressLine1
      ? [{
          type: "current" as const,
          addressLine1,
          addressLine2: nullable(addressLine2),
          city: nullable(valueFrom(row, "city")),
          state: nullable(valueFrom(row, "state")),
          pinCode: nullable(valueFrom(row, "pinCode", "pin_code", "pincode", "zip")),
        }]
      : [],
    employment: {
      type: nullable(valueFrom(row, "employmentType", "employment_type", "jobType")) as
        | "salaried"
        | "self_employed"
        | "business"
        | "student"
        | "unemployed"
        | "other"
        | null,
      companyName: nullable(valueFrom(row, "companyName", "company_name", "employer")),
      workExperience: numberFrom(valueFrom(row, "workExperience", "work_experience", "experience")),
      monthlyIncome: numberFrom(valueFrom(row, "monthlyIncome", "monthly_income", "income")),
    },
    credit: {
      creditScore: numberFrom(valueFrom(row, "creditScore", "credit_score")),
      crifScore: numberFrom(valueFrom(row, "crifScore", "crif_score")),
      crifScoreSource: nullable(valueFrom(row, "crifScoreSource", "crif_score_source")),
      crifScoreUpdatedAt: dateFrom(valueFrom(row, "crifScoreUpdatedAt", "crif_score_updated_at")),
    },
    loan: {
      amount: numberFrom(valueFrom(row, "loanAmount", "loan_amount", "amount")),
      purpose: nullable(valueFrom(row, "loanPurpose", "loan_purpose", "purpose")),
      status: nullable(valueFrom(row, "loanStatus", "loan_status", "status")),
    },
    identification: {
      pan: nullable(valueFrom(row, "pan", "panNumber", "pan_number")),
    },
    application: {
      appInstanceId: nullable(valueFrom(row, "appInstanceId", "app_instance_id")),
    },
    attribution: {
      source: nullable(valueFrom(row, "source")),
      medium: nullable(valueFrom(row, "medium")),
      campaign: nullable(valueFrom(row, "campaign")),
      term: nullable(valueFrom(row, "term")),
      gadSource: nullable(valueFrom(row, "gadSource", "gad_source")),
      gadCampaignId: nullable(valueFrom(row, "gadCampaignId", "gad_campaign_id")),
      gclid: nullable(valueFrom(row, "gclid")),
    },
    metadata: {
      sourceDocumentId,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
  } satisfies Omit<ILeads, "_id">;

  return { lead, sourceRow };
}