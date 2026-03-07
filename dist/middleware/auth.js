"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuthor = exports.authenticate = void 0;
const crypto_1 = require("../utils/crypto");
const client_1 = __importDefault(require("../db/client"));
const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = (0, crypto_1.verifyToken)(token);
        const user = await client_1.default.user.findUnique({ where: { id: decoded.userId } });
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized: User not found' });
        }
        req.user = user;
        next();
    }
    catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};
exports.authenticate = authenticate;
const requireAuthor = (req, res, next) => {
    if (req.user?.role !== 'author') {
        return res.status(403).json({ error: 'Forbidden: Requires author privileges' });
    }
    next();
};
exports.requireAuthor = requireAuthor;
