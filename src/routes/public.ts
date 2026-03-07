import { Router } from 'express';

import prisma from '../db/client';
import { getCache, setCache } from '../utils/cache';

const router = Router();

router.get('/published', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const size = Math.max(1, Math.min(100, parseInt(req.query.size as string) || 10));

        const cacheKey = `posts_public_list_${page}_${size}`;
        const cachedData = await getCache(cacheKey);

        if (cachedData) {
            return res.json(cachedData);
        }

        const skip = (page - 1) * size;

        const [items, total] = await Promise.all([
            prisma.post.findMany({
                where: { status: 'published' },
                skip,
                take: size,
                orderBy: { publishedAt: 'desc' },
            }),
            prisma.post.count({ where: { status: 'published' } }),
        ]);

        const responseData = { total, page, size, items };
        await setCache(cacheKey, responseData, 300);

        res.json(responseData);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/published/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id as string);
        const cacheKey = `post_public_${id}`;

        const cachedData = await getCache(cacheKey);
        if (cachedData) {
            return res.json(cachedData);
        }

        const post = await prisma.post.findFirst({
            where: { id, status: 'published' },
        });

        if (!post) return res.status(404).json({ error: 'Post not found' });

        await setCache(cacheKey, post, 3600);
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/search', async (req, res) => {
    try {
        const q = req.query.q as string;

        if (!q || q.length < 3) {
            return res.status(400).json({ error: 'Query parameter "q" must be at least 3 characters long.' });
        }

        // Using Prisma's raw query for PostgreSQL full-text search across title and content
        const posts = await prisma.$queryRaw`
      SELECT id, title, slug, content, status, author_id as "authorId", scheduled_for as "scheduledFor", published_at as "publishedAt", created_at as "createdAt", updated_at as "updatedAt"
      FROM "posts"
      WHERE status = 'published'
      AND (to_tsvector('english', title) || to_tsvector('english', content)) @@ plainto_tsquery('english', ${q})
      ORDER BY published_at DESC
      LIMIT 50;
    `;

        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
