import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User, { IUser, UserRole } from "@/features/users/user.model";
import Session from "@/features/users/session.model";

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = "lendere_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function normalizeEmail(email: unknown) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;

  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const storedKey = Buffer.from(key, "hex");
  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: IUser["_id"]) {
  await connectDB();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await Session.create({ userId, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt };
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
    path: "/",
  });
}

export async function getAuthenticatedUser(request: NextRequest) {
  const authtoken = request.headers.get("Authorization")?.replace(/^Bearer\s+/, "")?.trim();
  const token = authtoken ? authtoken : request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) return null;
  await connectDB();
  const session = await Session.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  });
  if (!session) return null;

  const user = await User.findById(session.userId).select("-passwordHash");
  if (!user || user.status !== "active") return null;
  return user;
}

export function requireRole(user: IUser, roles: UserRole[]) {
  return roles.includes(user.role);
}

export function publicUser(user: IUser) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    lenderId: user.lenderId,
    status: user.status,
  };
}
