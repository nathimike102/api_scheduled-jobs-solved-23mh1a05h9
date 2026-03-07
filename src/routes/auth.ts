import { Router } from 'express';
import { z } from 'zod';
import prisma from '../db/client';
import { hashPassword, verifyPassword, generateToken } from '../utils/crypto';

const router = Router();

const RegisterSchema = z.object({
    username: z.string().min(3),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(['author', 'public']).optional(),
});

const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

router.post('/register', async (req, res) => {
    try {
        const data = RegisterSchema.parse(req.body);

        const existingUser = await prisma.user.findFirst({
            where: { OR: [{ email: data.email }, { username: data.username }] },
        });

        if (existingUser) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        const hashedPassword = await hashPassword(data.password);

        const user = await prisma.user.create({
            data: {
                username: data.username,
                email: data.email,
                passwordHash: hashedPassword,
                role: data.role || 'public',
            },
        });

        res.status(201).json({ id: user.id, username: user.username, role: user.role });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const data = LoginSchema.parse(req.body);

        const user = await prisma.user.findUnique({ where: { email: data.email } });

        if (!user || !(await verifyPassword(data.password, user.passwordHash))) {
            return res.status(401).json({ error: 'Incorrect email or password' });
        }

        const token = generateToken({ userId: user.id, role: user.role });

        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
