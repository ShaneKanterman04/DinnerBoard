import { cookies } from "next/headers";
import { clearSession, createSession, getSession } from "@/lib/db";
import type { Session } from "@/lib/types";

const cookieName = "dinnerboard_session";

export async function currentSession(): Promise<Session | null> {
  const jar = await cookies();
  return getSession(jar.get(cookieName)?.value);
}

export async function requireSession(): Promise<Session> {
  const session = await currentSession();
  if (!session) throw new Error("Sign in first.");
  return session;
}

export async function setSessionCookie(householdId: string, memberId: string) {
  const token = createSession(householdId, memberId);
  const jar = await cookies();
  jar.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  clearSession(token);
  jar.delete(cookieName);
}
