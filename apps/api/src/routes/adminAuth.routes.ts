import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { verifyPassword } from "../auth/password";
import { signToken } from "../auth/jwt";
import { requireAuth } from "../auth/middleware";
import { issueRefreshToken } from "../auth/refreshToken";

const router = Router();

function serializeAdmin(admin: { id: string; email: string; name: string; createdAt: Date }) {
  return { id: admin.id, email: admin.email, name: admin.name, createdAt: admin.createdAt.toISOString() };
}

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { email, password } = parsed.data;

  const admin = await db.admin.findUnique({ where: { email } });
  if (!admin || !verifyPassword(password, admin.passwordHash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signToken({ sub: admin.id, role: "admin" });
  const refreshToken = await issueRefreshToken(admin.id, "admin", req.headers["user-agent"]);
  res.json({ admin: serializeAdmin(admin), token, refreshToken });
});

router.get("/me", requireAuth("admin"), async (req, res) => {
  const admin = await db.admin.findUnique({ where: { id: req.auth!.id } });
  res.json(admin ? serializeAdmin(admin) : null);
});

export default router;
