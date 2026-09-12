import { NextRequest, NextResponse } from "next/server";
import type { SortOrder } from "mongoose";
import neatCsv from "neat-csv";
import { connectDB } from "@/lib/db";
import Leads from "@/features/leads/lead.model";
import Lender from "@/features/leander/leander.model";
import { transformLeadRow, type CsvRow } from "@/features/leads/lead-import";
import { getAuthenticatedUser, requireRole } from "@/lib/auth";

const positiveIntegerQuery = (value: string | null, fallback: number, maximum?: number) => {
  if (value === null || value.trim() === "") return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("page and pageSize must be positive integers");
  }

  return maximum ? Math.min(parsed, maximum) : parsed;
};

const optionalNumberQuery = (value: string | null, name: string, minimum = 0) => {
  if (value === null || value.trim() === "") return undefined;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) {
    throw new Error(`${name} must be a number greater than or equal to ${minimum}`);
  }

  return parsed;
};

const optionalTextQuery = (value: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const listQuery = (query: URLSearchParams, name: string) =>
  query.getAll(name)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

const sortQuery = (value: string | undefined): Record<string, SortOrder> => {
  switch (value) {
    case "oldest":
      return { "metadata.createdAt": 1, _id: 1 };
    case "highestCreditScore":
      return { "credit.creditScore": -1, "metadata.createdAt": -1, _id: -1 };
    case "highestIncome":
      return { "employment.income": -1, "metadata.createdAt": -1, _id: -1 };
    case undefined:
    case "newest":
      return { "metadata.createdAt": -1, _id: -1 };
    default:
      throw new Error("sort must be newest, oldest, highestCreditScore, or highestIncome");
  }
};

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);
    if (!currentUser || !requireRole(currentUser, ["lender_admin","ops_admin"])) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    const query = request.nextUrl.searchParams;
    const page = positiveIntegerQuery(query.get("page"), 1);
    const pageSize = positiveIntegerQuery(query.get("pageSize"), 10, 100);
    const id = currentUser.lenderId?.toString();
    const lenderData = await Lender.findById(id).lean();
    const eligibility = lenderData?.eligibility ?? {
      age: { min: 10, max: 100 },
      income: { minAnnual: 10000 },
      creditScore: { minExclusive: 300, maxInclusive: 850 },
      employmentTypes: ["salaried", "self_employed", "business", "professional"],
    };
    const eligibleEmploymentTypes = eligibility.employmentTypes as string[];

    const requestedAgeMin = optionalNumberQuery(query.get("ageMin"), "ageMin");
    const requestedAgeMax = optionalNumberQuery(query.get("ageMax"), "ageMax");
    const requestedIncomeMin = optionalNumberQuery(query.get("incomeMin"), "incomeMin");
    const requestedIncomeMax = optionalNumberQuery(query.get("incomeMax"), "incomeMax");
    const requestedCreditMin = optionalNumberQuery(query.get("creditMin"), "creditMin");
    const requestedCreditMax = optionalNumberQuery(query.get("creditMax"), "creditMax");
    const requestedLoanAmountMin = optionalNumberQuery(query.get("loanAmountMin"), "loanAmountMin");
    const requestedLoanAmountMax = optionalNumberQuery(query.get("loanAmountMax"), "loanAmountMax");
    const loanAmountMin = requestedLoanAmountMin;
    const loanAmountMax = requestedLoanAmountMax;
    const requestedEmploymentTypes = listQuery(query, "employmentType");
    const search = optionalTextQuery(query.get("search"));
    const state = optionalTextQuery(query.get("state"));
    const city = optionalTextQuery(query.get("city"));
    const pincode = optionalTextQuery(query.get("pincode"));
    const loanPurpose = optionalTextQuery(query.get("loanPurpose"));
    const sort = sortQuery(optionalTextQuery(query.get("sort")));

    if (requestedAgeMin !== undefined && requestedAgeMax !== undefined && requestedAgeMin > requestedAgeMax) {
      throw new Error("ageMin cannot exceed ageMax");
    }
    if (requestedIncomeMin !== undefined && requestedIncomeMax !== undefined && requestedIncomeMin > requestedIncomeMax) {
      throw new Error("incomeMin cannot exceed incomeMax");
    }
    if (requestedCreditMin !== undefined && requestedCreditMax !== undefined && requestedCreditMin >= requestedCreditMax) {
      throw new Error("creditMin must be less than creditMax");
    }
    if (requestedLoanAmountMin !== undefined && requestedLoanAmountMax !== undefined && requestedLoanAmountMin > requestedLoanAmountMax) {
      throw new Error("loanAmountMin cannot exceed loanAmountMax");
    }

    if (requestedEmploymentTypes.length > 0 &&
      requestedEmploymentTypes.every((type) => !eligibleEmploymentTypes.includes(type))) {
      throw new Error("The requested employment type is outside lender eligibility");
    }

    const eligibilityFilter: Record<string, unknown> = {
      "personal.age": { $gte: eligibility.age.min, $lte: eligibility.age.max },
      "employment.income": { $gte: eligibility.income.minAnnual },
      "credit.creditScore": {
        $gt: eligibility.creditScore.minExclusive,
        $lte: eligibility.creditScore.maxInclusive,
      },
      "employment.type": { $in: eligibleEmploymentTypes },
    };
    const requestedFilter: Record<string, unknown> = {};

    if (requestedAgeMin !== undefined || requestedAgeMax !== undefined) {
      requestedFilter["personal.age"] = {
        ...(requestedAgeMin !== undefined ? { $gte: requestedAgeMin } : {}),
        ...(requestedAgeMax !== undefined ? { $lte: requestedAgeMax } : {}),
      };
    }
    if (requestedIncomeMin !== undefined || requestedIncomeMax !== undefined) {
      requestedFilter["employment.income"] = {
        ...(requestedIncomeMin !== undefined ? { $gte: requestedIncomeMin } : {}),
        ...(requestedIncomeMax !== undefined ? { $lte: requestedIncomeMax } : {}),
      };
    }
    if (requestedCreditMin !== undefined || requestedCreditMax !== undefined) {
      requestedFilter["credit.creditScore"] = {
        ...(requestedCreditMin !== undefined ? { $gte: requestedCreditMin } : {}),
        ...(requestedCreditMax !== undefined ? { $lte: requestedCreditMax } : {}),
      };
    }
    if (requestedEmploymentTypes.length) {
      requestedFilter["employment.type"] = { $in: requestedEmploymentTypes };
    }
    if (search) {
      const searchRegex = { $regex: escapeRegex(search), $options: "i" };
      requestedFilter.$or = [
        { _doc_id: searchRegex },
        { "contact.phone": searchRegex },
        { "personal.firstName": searchRegex },
        { "personal.lastName": searchRegex },
      ];
    }
    if (state || city || pincode) {
      const addressFilter: Record<string, unknown> = {};
      if (state) addressFilter.state = { $regex: escapeRegex(state), $options: "i" };
      if (city) addressFilter.city = { $regex: escapeRegex(city), $options: "i" };
      if (pincode) addressFilter.pinCode = { $regex: escapeRegex(pincode), $options: "i" };
      requestedFilter.addresses = { $elemMatch: addressFilter };
    }
    if (loanAmountMin !== undefined || loanAmountMax !== undefined) {
      requestedFilter["loan.amount"] = {
        ...(loanAmountMin !== undefined ? { $gte: loanAmountMin } : {}),
        ...(loanAmountMax !== undefined ? { $lte: loanAmountMax } : {}),
      };
    }
    if (loanPurpose) requestedFilter["loan.purpose"] = { $regex: escapeRegex(loanPurpose), $options: "i" };
    const filter = Object.keys(requestedFilter).length
      ? { $and: [eligibilityFilter, requestedFilter] }
      : eligibilityFilter;

    await connectDB();
    const [totalCount, leads] = await Promise.all([
      Leads.countDocuments(filter),
      Leads.find(filter)
        .sort(sort)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return NextResponse.json({
      success: true,
      count: leads.length,
      totalCount,
      pagination: {
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      },
      filters: {
        search,
        eligibility: {
          ageMin: eligibility.age.min,
          ageMax: eligibility.age.max,
          incomeMin: eligibility.income.minAnnual,
          creditMinExclusive: eligibility.creditScore.minExclusive,
          creditMaxInclusive: eligibility.creditScore.maxInclusive,
          employmentTypes: eligibleEmploymentTypes,
        },
        requested: {
          search,
          ageMin: requestedAgeMin,
          ageMax: requestedAgeMax,
          incomeMin: requestedIncomeMin,
          incomeMax: requestedIncomeMax,
          creditMin: requestedCreditMin,
          creditMax: requestedCreditMax,
          employmentTypes: requestedEmploymentTypes,
          loanAmountMin,
          loanAmountMax,
          loanPurpose,
        },
        state,
        city,
        pincode,
        sort: query.get("sort") || "newest",
      },
      data: leads,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to filter leads",
      },
      { status: 400 }
    );
  }
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, OPTIONS",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);
    if (!currentUser || !requireRole(currentUser, ["ops_admin"])) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: "A CSV file is required" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json({ success: false, message: "Only CSV files are supported" }, { status: 400 });
    }

    const csvText = await file.text();
    const parsedData = (await neatCsv(csvText)) as CsvRow[];

    if (parsedData.length === 0) {
      return NextResponse.json({ success: false, message: "The CSV file contains no data rows" }, { status: 400 });
    }
    // console.log(parsedData);
    await connectDB();

    const imported: unknown[] = [];
    const errors: { row: number; message: string }[] = [];

    for (const [index, row] of parsedData.entries()) {
      const sourceRow = index + 2;

      try {
        const { lead } = transformLeadRow(row, file.name, sourceRow);
        imported.push(await Leads.create(lead));
      } catch (error) {
        errors.push({
          row: sourceRow,
          message: error instanceof Error ? error.message : "Invalid lead data",
        });
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      message: `Imported ${imported.length} of ${parsedData.length} lead(s)`,
      data: imported,
      errors,
    }, { status: errors.length === parsedData.length ? 400 : 200 });
  } catch (error) {
    console.error("POST /api/csv:", error);
    return NextResponse.json({
      success: false,
      message: "Failed to import CSV",
    }, { status: 500 });
  }
}
