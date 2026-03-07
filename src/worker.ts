import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import prisma from './db/client';
import { invalidatePostCache } from './utils/cache';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

export const schedulingQueue = new Queue('publishing-queue', { connection: connection as any });

export const setupScheduler = async () => {
    await schedulingQueue.add(
        'publishScheduledPosts',
        {},
        {
            repeat: {
                pattern: '* * * * *', // Every minute
            },
        }
    );
    console.log('Scheduler for publishing initialized (runs every minute).');
};

export const worker = new Worker(
    'publishing-queue',
    async (job) => {
        if (job.name === 'publishScheduledPosts') {
            const now = new Date();

            // Find posts scheduled for the past (or exactly now) that are still SCHEDULED
            const postsToPublish = await prisma.post.findMany({
                where: {
                    status: 'scheduled',
                    scheduledFor: { lte: now },
                },
            });

            if (postsToPublish.length === 0) {
                return 'No posts to publish.';
            }

            // Update their status transactionally. Since a worker could crash, the exact implementation
            // isolates each transaction or updates them all and processes side-effects
            let publishedCount = 0;
            await prisma.$transaction(
                postsToPublish.map((post: any) =>
                    prisma.post.update({
                        where: { id: post.id },
                        data: {
                            status: 'published',
                            publishedAt: now,
                        },
                    })
                )
            );

            publishedCount = postsToPublish.length;

            // Invalidate cache
            for (const post of postsToPublish) {
                await invalidatePostCache(post.id);
            }

            console.log(`Successfully published ${publishedCount} scheduled posts.`);
            return `Published ${publishedCount} posts.`;
        }
    },
    { connection: connection as any }
);

worker.on('completed', (job) => {
    console.log(`Job [${job.id}] completed with result: ${job.returnvalue}`);
});

worker.on('failed', (job, err) => {
    console.error(`Job [${job?.id}] failed with error: ${err.message}`);
});

// If the file is executed directly run the worker (for the dedicated worker container)
if (require.main === module) {
    console.log('Worker is processing jobs...');
}
