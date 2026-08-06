import { Router } from "express";
import { z } from "zod";
import { signToken } from "../auth/jwt";
import { rotateRefreshToken, revokeRefreshToken } from "../auth/refreshToken";

const router = Router();

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

router.post("/refresh", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const userAgent = req.headers["user-agent"];
  const result = await rotateRefreshToken(parsed.data.refreshToken, userAgent);
  if (!result) {
    res.status(401).json({ error: "Invalid or expired refresh token" });
    return;
  }
  const token = signToken({ sub: result.ownerId, role: result.ownerRole });
  res.json({ token, refreshToken: result.refreshToken });
});

router.post("/logout", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (parsed.success) {
    await revokeRefreshToken(parsed.data.refreshToken);
  }
  res.status(204).end();
});

export default router;
