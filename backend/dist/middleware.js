"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.workerMiddleware = workerMiddleware;
const config_1 = require("./config");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Middleware for general users
function authMiddleware(req, res, next) {
    var _a;
    const authHeader = (_a = req.headers["authorization"]) !== null && _a !== void 0 ? _a : "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.JWT_SECRET);
        // @ts-ignore
        if (decoded.userId) {
            // @ts-ignore
            req.userId = decoded.userId;
            next();
        }
        else {
            res.status(403).json({ message: "You are not logged in" });
        }
    }
    catch (e) {
        res.status(403).json({ message: "You are not logged in" });
    }
}
// Middleware for workers
function workerMiddleware(req, res, next) {
    var _a;
    const authHeader = (_a = req.headers["authorization"]) !== null && _a !== void 0 ? _a : "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.WORKER_JWT_SECRET);
        // @ts-ignore
        if (decoded.userId) {
            // @ts-ignore
            req.userId = decoded.userId;
            next();
        }
        else {
            res.status(403).json({ message: "You are not logged in" });
        }
    }
    catch (e) {
        res.status(403).json({ message: "You are not logged in" });
    }
}
