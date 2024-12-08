import { NextFunction, Request, Response } from "express";
import { JWT_SECRET, WORKER_JWT_SECRET } from "./config";
import jwt from "jsonwebtoken";

// Middleware for general users
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers["authorization"] ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
        // @ts-ignore
        if (decoded.userId) {
            // @ts-ignore
            req.userId = decoded.userId;

            next();
        } else {
            res.status(403).json({ message: "You are not logged in" });
        }
    } catch (e) {
        res.status(403).json({ message: "You are not logged in" });
    }
}

// Middleware for workers
export function workerMiddleware(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers["authorization"] ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

    try {
        const decoded = jwt.verify(token, WORKER_JWT_SECRET) as jwt.JwtPayload;
        // @ts-ignore
        if (decoded.userId) {
            // @ts-ignore
            req.userId = decoded.userId;

            next();
        } else {
            res.status(403).json({ message: "You are not logged in" });
        }
    } catch (e) {
        res.status(403).json({ message: "You are not logged in" });
    }
}
