import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/features/users/user.model";
import { getAuthenticatedUser, requireRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);
    if (!currentUser || !requireRole(currentUser, ["lender_admin"])) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    await connectDB();
    const users = await User.find({
      lenderId: currentUser.lenderId,
      role: "lender_agent"
    }).select("-passwordHash");
    return NextResponse.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("GET /api/users/agents:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch users",
      },
      {
        status: 500,
      }
    );
  }
}
