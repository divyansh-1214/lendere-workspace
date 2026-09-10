import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User, { UserRole } from "@/features/users/user.model";
import { getAuthenticatedUser, hashPassword, publicUser, requireRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);
    if (!currentUser || !requireRole(currentUser, ["ops_admin"])) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    await connectDB();

    const users = await User.find().select("-passwordHash");

    return NextResponse.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("GET /api/users:", error);

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

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);
    if (!currentUser || !requireRole(currentUser, ["ops_admin"])) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    await connectDB();

    const body = await request.json();
    const role: UserRole = body.role;
    if (!body.name || !body.email || !body.password || !["ops_admin", "lender_admin", "lender_agent"].includes(role)) {
      return NextResponse.json({ success: false, message: "name, email, password, and a valid role are required" }, { status: 400 });
    }
    const user = await User.create({
      name: body.name,
      email: body.email.trim().toLowerCase(),
      passwordHash: await hashPassword(body.password),
      role,
      lenderId: body.lenderId,
      status: "active",
    });

    return NextResponse.json(
      {
        success: true,
        message: "User created successfully",
        data: publicUser(user),
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error("POST /api/users:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create user",
      },
      {
        status: 500,
      }
    );
  }
}
