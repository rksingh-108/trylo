import type { NextFunction, Request, Response } from "express";
import { type Role, verifyToken } from "./jwt";

declare global {
  namespace Express {
    interface Request {
      auth?: { id: string; role: Role };
    }
  }
}

export function requireAuth(role: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    const payload = token ? verifyToken(token) : null;

    if (!payload || payload.role !== role) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    req.auth = { id: payload.sub, role: payload.role };
    next();
  };
}
