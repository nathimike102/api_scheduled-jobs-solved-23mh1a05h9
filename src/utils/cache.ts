import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(REDIS_URL);

redis.on('error', (err) => {
    console.error('Redis error:', err);
});

export const getCache = async (key: string): Promise<any> => {
    try {
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('getCache error:', error);
        return null;
    }
};

export const setCache = async (key: string, value: any, expireSeconds: number = 3600): Promise<void> => {
    try {
        await redis.setex(key, expireSeconds, JSON.stringify(value));
    } catch (error) {
        console.error('setCache error:', error);
    }
};

export const invalidatePostCache = async (postId?: number): Promise<void> => {
    try {
        if (postId) {
            await redis.del(`post_public_${postId}`);
        }

        // Use scan to clear all paginated list caches
        let cursor = '0';
        do {
            const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'posts_public_list_*', 'COUNT', 100);
            cursor = nextCursor;
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } while (cursor !== '0');
    } catch (error) {
        console.error('invalidatePostCache error:', error);
    }
};
