"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = __importDefault(require("../db/client"));
const cache_1 = require("../utils/cache");
const router = (0, express_1.Router)();
router.get('/published', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const size = Math.max(1, Math.min(100, parseInt(req.query.size) || 10));
        const cacheKey = `posts_public_list_${page}_${size}`;
        const cachedData = await (0, cache_1.getCache)(cacheKey);
        if (cachedData) {
            return res.json(cachedData);
        }
        const skip = (page - 1) * size;
        const [items, total] = await Promise.all([
            client_1.default.post.findMany({
                where: { status: 'published' },
                skip,
                take: size,
                orderBy: { publishedAt: 'desc' },
            }),
            client_1.default.post.count({ where: { status: 'published' } }),
        ]);
        const responseData = { total, page, size, items };
        await (0, cache_1.setCache)(cacheKey, responseData, 300);
        res.json(responseData);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/published/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const cacheKey = `post_public_${id}`;
        const cachedData = await (0, cache_1.getCache)(cacheKey);
        if (cachedData) {
            return res.json(cachedData);
        }
        const post = await client_1.default.post.findFirst({
            where: { id, status: 'published' },
        });
        if (!post)
            return res.status(404).json({ error: 'Post not found' });
        await (0, cache_1.setCache)(cacheKey, post, 3600);
        res.json(post);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/search', async (req, res) => {
    try {
        const q = req.query.q;
        if (!q || q.length < 3) {
            return res.status(400).json({ error: 'Query parameter "q" must be at least 3 characters long.' });
        }
        // Using Prisma's raw query for PostgreSQL full-text search across title and content
        const posts = await client_1.default.$queryRaw `
      SELECT id, title, slug, content, status, "authorId", "scheduledFor", "publishedAt", "createdAt", "updatedAt"
      FROM "Post"
      WHERE status = 'published'
      AND (to_tsvector('english', title) || to_tsvector('english', content)) @@ plainto_tsquery('english', ${q})
      ORDER BY "publishedAt" DESC
      LIMIT 50;
    `;
        res.json(posts);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
