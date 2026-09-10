import { NextRequest, NextResponse } from "next/server";
import neatCsv from "neat-csv";
import { connectDB } from "@/lib/db";
import Leads from "@/features/leads/lead.model";
import { transformLeadRow, type CsvRow } from "@/features/leads/lead-import";

export function GET() {
  return NextResponse.json({
    success: true,
    message: "CSV endpoint is available. Upload a file with POST /api/csv.",
  });
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
