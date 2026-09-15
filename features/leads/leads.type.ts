export type Lead = {
  _id?: string;
  _doc_id?: string;
  personal?: { firstName?: string; lastName?: string; age?: number };
  contact?: { phone?: string };
  employment?: { type?: string | null; income?: number | null };
  credit?: { creditScore?: number | null };
  addresses?: { city?: string | null; state?: string | null; pinCode?: string | null }[];
  loan?: { amount?: number | null; purpose?: string | null };
};

export type Agent = { _id: string; name: string; email: string };

export type Eligibility = {
  age: { min: number; max: number };
  income: { minAnnual: number };
  creditScore: { minExclusive: number; maxInclusive: number };
  employmentTypes: string[];
};

export type LeadFilters = {
  search: string;
  ageMin: string;
  ageMax: string;
  employmentType: string[];
  incomeMin: string;
  incomeMax: string;
  creditMin: string;
  creditMax: string;
  state: string;
  city: string;
  pincode: string;
  loanAmountMin: string;
  loanAmountMax: string;
  loanPurpose: string;
  sort: string;
};
