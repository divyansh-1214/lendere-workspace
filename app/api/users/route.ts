import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import User from "@/features/users/user.model";
import Session from "@/features/users/session.model";
import { createUser, CreateUserInput, UserRegistrationError } from "@/features/users/user.register";
import { getAuthenticatedUser, publicUser, requireRole } from "@/lib/auth";

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
    if (!currentUser || !requireRole(currentUser, ["ops_admin","lender_admin"])) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    const body = (await request.json()) as CreateUserInput;
    if (!body.name || !body.email || !body.password || !["ops_admin", "lender_admin", "lender_agent"].includes(body.role)) {
      return NextResponse.json({ success: false, message: "name, email, password, and a valid role are required" }, { status: 400 });
    }
    if ((body.role === "lender_admin" && !requireRole(currentUser, ["ops_admin"]))
      || (body.role === "ops_admin" && !requireRole(currentUser, ["ops_admin"]))) {
      return NextResponse.json({ success: false, message: "Forbidden to create user with this role" }, { status: 403 });
    }
    await connectDB();
    const user = await createUser(body);

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
    if (error instanceof UserRegistrationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }

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

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);
    const superAdmin = process.env.SUPER_ADMIN_EMAIL;
    if (currentUser?.email === superAdmin) {
      return NextResponse.json({ success: false, message: "Super admin user cannot be deleted" }, { status: 403 });
    }
    if (!currentUser || !requireRole(currentUser, ["ops_admin"])) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const userId = request.nextUrl.searchParams.get("id");
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ success: false, message: "A valid user id is required" }, { status: 400 });
    }

    if (currentUser._id.toString() === userId) {
      return NextResponse.json({ success: false, message: "You cannot delete your own user" }, { status: 400 });
    }

    await connectDB();
    const deletedUser = await User.findByIdAndDelete(userId).select("_id");
    if (!deletedUser) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    await Session.deleteMany({ userId: deletedUser._id });

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("DELETE /api/users:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete user",
      },
      {
        status: 500,
      }
    );
  }
}
