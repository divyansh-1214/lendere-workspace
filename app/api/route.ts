import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json({
      message: "Success",
    }, {
      status:200
    })
  } catch (error) {
    return NextResponse.json({
      message: "Failed ",
    },
      {
        status:500
      }
    )
  }
}
