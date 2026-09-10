import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Session from "@/features/users/session.model";
import { clearSessionCookie, hashToken, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    await connectDB();
    await Session.deleteOne({ tokenHash: hashToken(token) });
  }
  const response = NextResponse.json({ success: true, message: "Logged out" });
  clearSessionCookie(response);
  return response;
}