import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, publicUser, requireRole } from "@/lib/auth";
import registerCase from "@/features/case/case.register";
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);
    if (!currentUser || !requireRole(currentUser, ["lender_admin"])) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    const lenderId = currentUser.lenderId;
    console.log(lenderId)
    const body = await request.json();
    const leadIds: string[] = body.leadId;
    console.log(leadIds)
    if (!leadIds || !Array.isArray(leadIds)) {
      return NextResponse.json({ success: false, message: "Invalid lead IDs" }, { status: 400 });
    }
    const cases = await registerCase(leadIds, currentUser);
    if (!cases.success) {
      return NextResponse.json({ success: false, message: cases.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: cases.message }, { status: 200 });
  } catch (error) {
    console.log(error)
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: "", success: true })
}
