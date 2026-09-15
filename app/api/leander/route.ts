import { NextRequest, NextResponse } from "next/server";
import neatCsv from "neat-csv";
import { connectDB } from "@/lib/db";
import Lender from "@/features/leander/leander.model";
import { transformLenderRow } from "@/features/leander/leander-import";
import type { CsvRow } from "@/features/leads/lead-import";
import { getAuthenticatedUser, requireRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);
    if (!currentUser || !requireRole(currentUser, ["ops_admin", "lender_admin"])) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    const lenderId = currentUser.lenderId;
    if (!lenderId) {
      return NextResponse.json(
        { success: false, message: "Missing lenderId parameter" },
        { status: 400 }
      );
    }
    console.log("lenderId", lenderId);
    await connectDB();
    const data = lenderId ? await Lender.findById(lenderId) : null;
    if (!data) {
      return NextResponse.json(
        { success: false, message: "Lender not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      data,
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Failed to fetch lender" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);
    console.log("user", currentUser)
    if (!currentUser || !requireRole(currentUser, ["ops_admin"])) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "A CSV file is required" },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json(
        { success: false, message: "Only CSV files are supported" },
        { status: 400 }
      );
    }

    setTimeout(async () => {
      const parsedData = (await neatCsv(await file.text())) as CsvRow[];

      await connectDB();

      // const imported: unknown[] = [];
      const errors: { row: number; message: string }[] = [];
      const data = []
      for (const [index, row] of parsedData.entries()) {
        const sourceRow = index + 2;
        try {
          const { lender } = transformLenderRow(row, sourceRow);
          // imported.push(await Lender.create(lender));
          data.push({
            insertOne: {
              document: lender,
            },
          })
        } catch (error) {
          errors.push({
            row: sourceRow,
            message: error instanceof Error ? error.message : "Invalid lender data",
          });
        }
        if (data.length > 0) {
          try {
          await Lender.bulkWrite(data)
          } catch (error) {
            console.error("POST /api/leander:", error instanceof Error ? error.message : error);
          }
          console.log("Imported", data.length, "lenders")
          console.log(data)
        }
      }
    }, 3000)

    return NextResponse.json(
      {
        message: `File received`,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("POST /api/leander:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, message: "Failed to import lenders" },
      { status: 500 }
    );
  }
}
