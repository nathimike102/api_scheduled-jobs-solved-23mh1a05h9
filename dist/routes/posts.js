"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = __importDefault(require("../db/client"));
const auth_1 = require("../middleware/auth");
const cache_1 = require("../utils/cache");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.requireAuthor);
const PostCreateSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    content: zod_1.z.string().min(1),
});
const PostUpdateSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).optional(),
    content: zod_1.z.string().min(1).optional(),
});
const ScheduleSchema = zod_1.z.object({
    scheduledFor: zod_1.z.string().datetime(),
});
const generateSlug = async (title) => {
    const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    let slug = baseSlug;
    let counter = 1;
    while (await client_1.default.post.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
    }
    return slug;
};
router.post('/', async (req, res) => {
    try {
        const data = PostCreateSchema.parse(req.body);
        const slug = await generateSlug(data.title);
        const post = await client_1.default.post.create({
            data: {
                title: data.title,
                content: data.content,
                slug,
                authorId: req.user.id,
                status: 'draft',
            },
        });
        res.status(201).json(post);
    }
    catch (error) {
        if (error.name === 'ZodError')
            return res.status(400).json({ error: error.errors });
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const size = Math.max(1, Math.min(100, parseInt(req.query.size) || 10));
        const skip = (page - 1) * size;
        const [items, total] = await Promise.all([
            client_1.default.post.findMany({
                where: { authorId: req.user.id },
                skip,
                take: size,
                orderBy: { createdAt: 'desc' },
            }),
            client_1.default.post.count({ where: { authorId: req.user.id } }),
        ]);
        res.json({ total, page, size, items });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const post = await client_1.default.post.findFirst({
            where: { id, authorId: req.user.id },
        });
        if (!post)
            return res.status(404).json({ error: 'Post not found' });
        res.json(post);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const data = PostUpdateSchema.parse(req.body);
        const authorId = req.user.id;
        const post = await client_1.default.post.findFirst({ where: { id, authorId } });
        if (!post)
            return res.status(404).json({ error: 'Post not found' });
        // Transactionally update post and create snapshot
        const [updatedPost] = await client_1.default.$transaction(async (tx) => {
            await tx.postRevision.create({
                data: {
                    postId: post.id,
                    titleSnapshot: post.title,
                    contentSnapshot: post.content,
                    revisionAuthorId: authorId,
                },
            });
            let updatedData = {};
            if (data.title && data.title !== post.title) {
                updatedData.title = data.title;
                updatedData.slug = await generateSlug(data.title);
            }
            if (data.content) {
                updatedData.content = data.content;
            }
            const p = await tx.post.update({
                where: { id: post.id },
                data: updatedData,
            });
            return [p];
        });
        if (updatedPost.status === 'published') {
            await (0, cache_1.invalidatePostCache)(updatedPost.id);
        }
        res.json(updatedPost);
    }
    catch (error) {
        if (error.name === 'ZodError')
            return res.status(400).json({ error: error.errors });
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const post = await client_1.default.post.findFirst({ where: { id, authorId: req.user.id } });
        if (!post)
            return res.status(404).json({ error: 'Post not found' });
        await client_1.default.post.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/:id/publish', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const post = await client_1.default.post.findFirst({ where: { id, authorId: req.user.id } });
        if (!post)
            return res.status(404).json({ error: 'Post not found' });
        if (post.status === 'published')
            return res.status(400).json({ error: 'Post is already published' });
        const updatedPost = await client_1.default.post.update({
            where: { id },
            data: { status: 'published', publishedAt: new Date() },
        });
        await (0, cache_1.invalidatePostCache)(post.id);
        res.json(updatedPost);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/:id/schedule', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const data = ScheduleSchema.parse(req.body);
        const scheduledForDate = new Date(data.scheduledFor);
        if (scheduledForDate <= new Date()) {
            return res.status(400).json({ error: 'Scheduled time must be in the future' });
        }
        const post = await client_1.default.post.findFirst({ where: { id, authorId: req.user.id } });
        if (!post)
            return res.status(404).json({ error: 'Post not found' });
        const updatedPost = await client_1.default.post.update({
            where: { id },
            data: { status: 'scheduled', scheduledFor: scheduledForDate },
        });
        res.json(updatedPost);
    }
    catch (error) {
        if (error.name === 'ZodError')
            return res.status(400).json({ error: error.errors });
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/:id/revisions', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const post = await client_1.default.post.findFirst({ where: { id, authorId: req.user.id } });
        if (!post)
            return res.status(404).json({ error: 'Post not found' });
        const revisions = await client_1.default.postRevision.findMany({
            where: { postId: id },
            orderBy: { revisionTimestamp: 'desc' },
        });
        res.json(revisions);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
