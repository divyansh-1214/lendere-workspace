import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/features/users/user.model";
import {
  createSession,
  normalizeEmail,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ success: false, message: "Email and password are required" }, { status: 400 });
  }

  await connectDB();
  const user = await User.findOne({ email }).select("+passwordHash");
  if (user?.status === "disabled") {
    return NextResponse.json({ success: false, message: "This account is disabled" }, { status: 403 });
  }
  if (!user || !user.passwordHash) {
    return NextResponse.json({ success: false, message: "Invalid email or password" }, { status: 401 });
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ success: false, message: "Invalid email or password" }, { status: 401 });
  }

  if (user.status !== "active") {
    return NextResponse.json({ success: false, message: "This account is not active" }, { status: 403 });
  }

  const { token, expiresAt } = await createSession(user._id);
  const response = NextResponse.json({
    success: true,
    data: { id: user._id, name: user.name, email: user.email, role: user.role, lenderId:user.lenderId, expiresAt },
  });
  setSessionCookie(response, token, expiresAt);
  return response;
}