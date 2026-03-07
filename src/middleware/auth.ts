import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/crypto';
import prisma from '../db/client';

export interface AuthRequest extends Request {
    user?: any;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = verifyToken(token) as { userId: number };
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

        if (!user) {
            return res.status(401).json({ error: 'Unauthorized: User not found' });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};

export const requireAuthor = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== 'author') {
        return res.status(403).json({ error: 'Forbidden: Requires author privileges' });
    }
    next();
};
