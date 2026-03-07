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

export const invalidatePostCache = async (postId: number): Promise<void> => {
    try {
        await redis.del(`post_public_${postId}`);
        await redis.del('posts_public_list');
    } catch (error) {
        console.error('invalidatePostCache error:', error);
    }
};
