import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, getAuthenticatedUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    const response = NextResponse.json({ success: false, message: "Authentication required" }, { status: 401 });
    clearSessionCookie(response);
    return response;
  }

  return NextResponse.json({
    success: true,
    data: { id: user._id, name: user.name, email: user.email, role: user.role, lenderId: user.lenderId },
  });
}