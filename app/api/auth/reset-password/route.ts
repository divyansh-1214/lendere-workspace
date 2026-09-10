import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/features/users/user.model";
import PasswordResetToken from "@/features/users/password-reset.model";
import Session from "@/features/users/session.model";
import { hashPassword, hashToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!token || password.length < 8) {
    return NextResponse.json({ success: false, message: "A valid token and password of at least 8 characters are required" }, { status: 400 });
  }

  await connectDB();
  const reset = await PasswordResetToken.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
    usedAt: { $exists: false },
  });
  if (!reset) {
    return NextResponse.json({ success: false, message: "Invalid or expired reset token" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  await User.updateOne({ _id: reset.userId, status: { $ne: "disabled" } }, { $set: { passwordHash, status: "active" } });
  await PasswordResetToken.updateOne({ _id: reset._id }, { $set: { usedAt: new Date() } });
  await Session.deleteMany({ userId: reset.userId });

  return NextResponse.json({ success: true, message: "Password reset successfully" });
}