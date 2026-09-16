import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, publicUser, requireRole } from "@/lib/auth";
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);
    if (!currentUser || !requireRole(currentUser, ["lender_admin"])) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    const lenderId = currentUser.lenderId;
    console.log(lenderId)
    const body = await request.json();
    const leadId = body.leadId;
    console.log(leadId)
    return NextResponse.json({ success: true, lenderId }, { status: 200 });
  } catch (error) {
    console.log(error)
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: "", success: true })
}
