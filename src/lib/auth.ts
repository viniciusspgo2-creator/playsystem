import { db } from "@/lib/db";
import { generateNumber } from "@/lib/format";

// Password hashing using Node's built-in scrypt (no external deps)
export async function hashPassword(password: string): Promise<string> {
  const { scrypt, randomBytes } = await import("crypto");
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString("hex");
    scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const { scrypt, timingSafeEqual } = await import("crypto");
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(":");
    const keyBuffer = Buffer.from(key, "hex");
    scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      const derivedBuffer = Buffer.from(derivedKey);
      const match =
        keyBuffer.length === derivedBuffer.length &&
        timingSafeEqual(keyBuffer, derivedBuffer);
      resolve(match);
    });
  });
}

// Session via cookie (simple signed token)
const SESSION_SECRET =
  process.env.AUTH_SECRET || "playmedia-dev-secret-change-me";

export async function createSession(userId: string): Promise<string> {
  const payload = JSON.stringify({
    userId,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  });
  const token = Buffer.from(payload).toString("base64url");
  const { createHmac } = await import("crypto");
  const sig = createHmac("sha256", SESSION_SECRET)
    .update(token)
    .digest("base64url");
  return `${token}.${sig}`;
}

export async function verifySession(
  token: string
): Promise<{ userId: string } | null> {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const { createHmac, timingSafeEqual } = await import("crypto");
    const expectedSig = createHmac("sha256", SESSION_SECRET)
      .update(payload)
      .digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (
      sigBuf.length !== expBuf.length ||
      !timingSafeEqual(sigBuf, expBuf)
    )
      return null;
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf-8")
    );
    if (decoded.exp < Date.now()) return null;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

export async function getCurrentUser(cookieHeader?: string | null) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/playmedia-session=([^;]+)/);
  if (!match) return null;
  const session = await verifySession(match[1]);
  if (!session) return null;
  try {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, name: true },
    });
    return user;
  } catch {
    return null;
  }
}

export async function hasUser(): Promise<boolean> {
  try {
    const count = await db.user.count();
    return count > 0;
  } catch {
    return false;
  }
}
