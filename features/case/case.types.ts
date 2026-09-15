export type CaseStatus =
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export type AssignedLead = {
  _id?: string;
  _doc_id?: string;
  personal?: { firstName?: string; lastName?: string; age?: number };
  contact?: { phone?: string; personalEmail?: string | null };
  employment?: { type?: string | null; income?: number | null };
  credit?: { creditScore?: number | null };
  addresses?: { city?: string | null; state?: string | null }[];
  loan?: { amount?: number | null; purpose?: string | null };
};

export type AssignedCase = {
  _id: string;
  leadId: AssignedLead | null;
  status: CaseStatus;
  assignedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
};

export type AssignedCasesResponse = {
  success: boolean;
  assignedLeads: AssignedCase[];
  count: number;
  totalCount: number;
  pagination: { page: number; pageSize: number; totalPages: number };
};

export type CaseNode = {
  _id: string;
  caseId: string;
  type: "QUESTION" | "OUTCOME";
  parentId?: string | null;
  question?: { text?: string; answerType?: string; options?: { value: string; label: string }[] };
  answer?: { value?: unknown; label?: string | null };
  outcome?: { code?: string; label?: string };
};
