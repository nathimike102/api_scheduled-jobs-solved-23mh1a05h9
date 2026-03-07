"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.worker = exports.setupScheduler = exports.schedulingQueue = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const client_1 = __importDefault(require("./db/client"));
const cache_1 = require("./utils/cache");
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new ioredis_1.default(REDIS_URL, { maxRetriesPerRequest: null });
exports.schedulingQueue = new bullmq_1.Queue('publishing-queue', { connection: connection });
const setupScheduler = async () => {
    await exports.schedulingQueue.add('publishScheduledPosts', {}, {
        repeat: {
            pattern: '* * * * *', // Every minute
        },
    });
    console.log('Scheduler for publishing initialized (runs every minute).');
};
exports.setupScheduler = setupScheduler;
exports.worker = new bullmq_1.Worker('publishing-queue', async (job) => {
    if (job.name === 'publishScheduledPosts') {
        const now = new Date();
        // Find posts scheduled for the past (or exactly now) that are still SCHEDULED
        const postsToPublish = await client_1.default.post.findMany({
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
        await client_1.default.$transaction(postsToPublish.map((post) => client_1.default.post.update({
            where: { id: post.id },
            data: {
                status: 'published',
                publishedAt: now,
            },
        })));
        publishedCount = postsToPublish.length;
        // Invalidate cache
        for (const post of postsToPublish) {
            await (0, cache_1.invalidatePostCache)(post.id);
        }
        console.log(`Successfully published ${publishedCount} scheduled posts.`);
        return `Published ${publishedCount} posts.`;
    }
}, { connection: connection });
exports.worker.on('completed', (job) => {
    console.log(`Job [${job.id}] completed with result: ${job.returnvalue}`);
});
exports.worker.on('failed', (job, err) => {
    console.error(`Job [${job?.id}] failed with error: ${err.message}`);
});
// If the file is executed directly run the worker (for the dedicated worker container)
if (require.main === module) {
    console.log('Worker is processing jobs...');
}
