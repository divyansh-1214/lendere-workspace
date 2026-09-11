import { NextRequest, NextResponse } from "next/server";
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

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);
    if (!currentUser || !requireRole(currentUser, ["lender_admin"])) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    const query = request.nextUrl.searchParams;
    const page = positiveIntegerQuery(query.get("page"), 1);
    const pageSize = positiveIntegerQuery(query.get("pageSize"), 10, 100);
    const id = currentUser.lenderId?.toString();
    // geting the eligibility of the lender from the database to filter the leads based on the eligibility criteria
    const LenderData = await Lender.findById(id);
    const ageMin = LenderData ? LenderData.eligibility.age.min : 10
    const ageMax = LenderData ? LenderData.eligibility.age.max : 100
    const minAnnual = LenderData ? LenderData.eligibility.income.minAnnual : 10000
    const creditMin = LenderData ? LenderData.eligibility.creditScore.minExclusive : 300
    const creditMax = LenderData ? LenderData.eligibility.creditScore.maxInclusive : 850
    const employmentTypes = LenderData ? LenderData.eligibility.employmentTypes : ["Full-time", "Part-time", "Self-employed", "Unemployed"];

    if (ageMin !== undefined && ageMax !== undefined && ageMin > ageMax) {
      return NextResponse.json(
        { success: false, message: "ageMin cannot exceed ageMax" },
        { status: 400 }
      );
    }

    if (
      creditMin !== undefined &&
      creditMax !== undefined &&
      creditMin >= creditMax
    ) {
      return NextResponse.json(
        { success: false, message: "minExclusive must be less than maxInclusive" },
        { status: 400 }
      );
    }

    const filter: Record<string, unknown> = {};
    if (ageMin !== undefined) filter["personal.age"] = { $gte: ageMin };
    if (ageMax !== undefined) {
      filter["personal.age"] = {
        ...(filter["personal.age"] as Record<string, number> | undefined),
        $lte: ageMax,
      };
    }
    if (minAnnual !== undefined) filter["employment.income"] = { $gte: minAnnual };
    if (creditMin !== undefined) filter["credit.creditScore"] = { $gt: creditMin };
    if (creditMax !== undefined) {
      filter["credit.creditScore"] = {
        ...(filter["credit.creditScore"] as Record<string, number> | undefined),
        $lte: creditMax,
      };
    }
    if (employmentTypes?.length) {
      filter["employment.type"] = { $in: employmentTypes };
    }

    await connectDB();
    const [totalCount, leads] = await Promise.all([
      Leads.countDocuments(filter),
      Leads.find(filter)
        .sort({ "metadata.createdAt": -1, _id: -1 })
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
      filters: { ageMin, ageMax, minAnnual, creditMin, creditMax, employmentTypes },
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
