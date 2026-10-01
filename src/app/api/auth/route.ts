import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  hasUser,
  hashPassword,
  createSession,
  getCurrentUser,
} from "@/lib/auth";

// GET /api/auth -> status
export async function GET(req: NextRequest) {
  try {
    const userExists = await hasUser();
    const user = await getCurrentUser(req.headers.get("cookie"));
    return NextResponse.json({
      hasUser: userExists,
      user,
      authed: !!user,
    });
  } catch (e) {
    return NextResponse.json({ hasUser: false, user: null, authed: false });
  }
}

// POST /api/auth -> setup or login
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "setup") {
      const userExists = await hasUser();
      if (userExists) {
        return NextResponse.json(
          { error: "Já existe um usuário cadastrado." },
          { status: 400 }
        );
      }
      const { email, name, password } = body;
      if (!email || !password || password.length < 4) {
        return NextResponse.json(
          { error: "Email e senha (mín. 4 caracteres) são obrigatórios." },
          { status: 400 }
        );
      }
      const passwordHash = await hashPassword(password);
      const user = await db.user.create({
        data: { email, name: name || "Admin", passwordHash },
      });
      const token = await createSession(user.id);
      const res = NextResponse.json({
        user: { id: user.id, email: user.email, name: user.name },
      });
      res.cookies.set("playmedia-session", token, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
      return res;
    }

    if (action === "login") {
      const { email, password } = body;
      if (!email || !password) {
        return NextResponse.json(
          { error: "Email e senha obrigatórios." },
          { status: 400 }
        );
      }
      const user = await db.user.findUnique({ where: { email } });
      if (!user) {
        return NextResponse.json(
          { error: "Credenciais inválidas." },
          { status: 401 }
        );
      }
      const { verifyPassword } = await import("@/lib/auth");
      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) {
        return NextResponse.json(
          { error: "Credenciais inválidas." },
          { status: 401 }
        );
      }
      const token = await createSession(user.id);
      const res = NextResponse.json({
        user: { id: user.id, email: user.email, name: user.name },
      });
      res.cookies.set("playmedia-session", token, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
      return res;
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Erro interno" },
      { status: 500 }
    );
  }
}

// DELETE /api/auth -> logout
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("playmedia-session");
  return res;
}
