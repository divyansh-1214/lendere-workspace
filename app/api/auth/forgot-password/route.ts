import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/features/users/user.model";
import PasswordResetToken from "@/features/users/password-reset.model";
import { hashToken, normalizeEmail } from "@/lib/auth";
import { randomBytes } from "node:crypto";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = normalizeEmail(body?.email);
  if (!email) {
    return NextResponse.json({ success: false, message: "Email is required" }, { status: 400 });
  }

  await connectDB();
  const user = await User.findOne({ email, status: { $ne: "disabled" } });
  const response: { success: true; message: string; resetToken?: string } = {
    success: true,
    message: "If an account exists, password reset instructions have been sent",
  };

  if (user) {
    await PasswordResetToken.deleteMany({ userId: user._id, usedAt: { $exists: false } });
    const resetToken = randomBytes(32).toString("base64url");
    await PasswordResetToken.create({
      userId: user._id,
      tokenHash: hashToken(resetToken),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    // Replace this development response with an email provider in production.
    if (process.env.NODE_ENV !== "production") response.resetToken = resetToken;
  }

  return NextResponse.json(response);
}