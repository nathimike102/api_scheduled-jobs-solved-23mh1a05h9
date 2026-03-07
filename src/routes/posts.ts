import { Router } from "express";
import { z } from "zod";
import prisma from "../db/client";
import { authenticate, requireAuthor, AuthRequest } from "../middleware/auth";
import { invalidatePostCache } from "../utils/cache";

const router = Router();
router.use(authenticate, requireAuthor);

const PostCreateSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
});

const PostUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
});

const ScheduleSchema = z.object({
  scheduledFor: z.string().datetime(),
});

const generateSlug = async (title: string): Promise<string> => {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  let slug = baseSlug;
  let counter = 1;
  while (await prisma.post.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  return slug;
};

router.post("/", async (req: AuthRequest, res) => {
  try {
    const data = PostCreateSchema.parse(req.body);
    const slug = await generateSlug(data.title);

    const post = await prisma.post.create({
      data: {
        title: data.title,
        content: data.content,
        slug,
        authorId: req.user.id,
        status: "draft",
      },
    });

    res.status(201).json(post);
  } catch (error: any) {
    if (error.name === "ZodError")
      return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", async (req: AuthRequest, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const size = Math.max(
      1,
      Math.min(100, parseInt(req.query.size as string) || 10),
    );
    const skip = (page - 1) * size;

    const [items, total] = await Promise.all([
      prisma.post.findMany({
        where: { authorId: req.user.id },
        skip,
        take: size,
        orderBy: { createdAt: "desc" },
      }),
      prisma.post.count({ where: { authorId: req.user.id } }),
    ]);

    res.json({ total, page, size, items });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const post = await prisma.post.findFirst({
      where: { id, authorId: req.user.id },
    });

    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const data = PostUpdateSchema.parse(req.body);
    const authorId = req.user.id;

    const post = await prisma.post.findFirst({ where: { id, authorId } });
    if (!post) return res.status(404).json({ error: "Post not found" });

    // Transactionally update post and create snapshot
    const [updatedPost] = await prisma.$transaction(async (tx: any) => {
      await tx.postRevision.create({
        data: {
          postId: post.id,
          titleSnapshot: post.title,
          contentSnapshot: post.content,
          revisionAuthorId: authorId,
        },
      });

      let updatedData: any = {};
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

    if (updatedPost.status === "published") {
      await invalidatePostCache(updatedPost.id);
    }

    res.json(updatedPost);
  } catch (error: any) {
    if (error.name === "ZodError")
      return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const post = await prisma.post.findFirst({
      where: { id, authorId: req.user.id },
    });

    if (!post) return res.status(404).json({ error: "Post not found" });

    await prisma.post.delete({ where: { id } });
    if (post.status === "published") {
      await invalidatePostCache(id);
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/publish", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const post = await prisma.post.findFirst({
      where: { id, authorId: req.user.id },
    });

    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.status === "published")
      return res.status(400).json({ error: "Post is already published" });

    const updatedPost = await prisma.post.update({
      where: { id },
      data: { status: "published", publishedAt: new Date() },
    });

    await invalidatePostCache(post.id);
    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/schedule", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const data = ScheduleSchema.parse(req.body);
    const scheduledForDate = new Date(data.scheduledFor);

    if (scheduledForDate <= new Date()) {
      return res
        .status(400)
        .json({ error: "Scheduled time must be in the future" });
    }

    const post = await prisma.post.findFirst({
      where: { id, authorId: req.user.id },
    });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const updatedPost = await prisma.post.update({
      where: { id },
      data: { status: "scheduled", scheduledFor: scheduledForDate },
    });

    if (post.status === "published") {
      await invalidatePostCache(id);
    }

    res.json(updatedPost);
  } catch (error: any) {
    if (error.name === "ZodError")
      return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/revisions", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const post = await prisma.post.findFirst({
      where: { id, authorId: req.user.id },
    });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const revisions = await prisma.postRevision.findMany({
      where: { postId: id },
      orderBy: { revisionTimestamp: "desc" },
    });

    res.json(revisions);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
