"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = __importDefault(require("../db/client"));
const crypto_1 = require("../utils/crypto");
const router = (0, express_1.Router)();
const RegisterSchema = zod_1.z.object({
    username: zod_1.z.string().min(3),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    role: zod_1.z.enum(['author', 'public']).optional(),
});
const LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string(),
});
router.post('/register', async (req, res) => {
    try {
        const data = RegisterSchema.parse(req.body);
        const existingUser = await client_1.default.user.findFirst({
            where: { OR: [{ email: data.email }, { username: data.username }] },
        });
        if (existingUser) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }
        const hashedPassword = await (0, crypto_1.hashPassword)(data.password);
        const user = await client_1.default.user.create({
            data: {
                username: data.username,
                email: data.email,
                passwordHash: hashedPassword,
                role: data.role || 'public',
            },
        });
        res.status(201).json({ id: user.id, username: user.username, role: user.role });
    }
    catch (error) {
        if (error.name === 'ZodError') {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/login', async (req, res) => {
    try {
        const data = LoginSchema.parse(req.body);
        const user = await client_1.default.user.findUnique({ where: { email: data.email } });
        if (!user || !(await (0, crypto_1.verifyPassword)(data.password, user.passwordHash))) {
            return res.status(401).json({ error: 'Incorrect email or password' });
        }
        const token = (0, crypto_1.generateToken)({ userId: user.id, role: user.role });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    }
    catch (error) {
        if (error.name === 'ZodError') {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
