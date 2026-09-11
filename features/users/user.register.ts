
import { Types } from "mongoose";
import User, { UserRole, IUser } from "@/features/users/user.model";
import Lender from "@/features/leander/leander.model"
import { hashPassword } from "@/lib/auth";

export class UserRegistrationError extends Error {}

export type CreateUserInput = {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    lenderId?: string;
};

export async function createUser(userData: CreateUserInput): Promise<IUser> {
    const { name, email, password, role, lenderId } = userData;

    if (!name || !email || !password) {
        throw new UserRegistrationError("name, email, and password are required");
    }

    if (role !== "ops_admin" && !lenderId) {
        throw new UserRegistrationError("lenderId is required for lender users");
    }

    if (lenderId && !Types.ObjectId.isValid(lenderId)) {
        throw new UserRegistrationError("lenderId must be a valid MongoDB ObjectId");
    }
    
    if(lenderId && !await Lender.exists({ _id: lenderId })) {
        throw new UserRegistrationError("lenderId does not exist");
    }

    return User.create({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash: await hashPassword(password),
        role,
        ...(role === "ops_admin" ? {} : { lenderId: new Types.ObjectId(lenderId) }),
        status: "active",
    });
}