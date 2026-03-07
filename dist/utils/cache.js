"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidatePostCache = exports.setCache = exports.getCache = exports.redis = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
exports.redis = new ioredis_1.default(REDIS_URL);
exports.redis.on('error', (err) => {
    console.error('Redis error:', err);
});
const getCache = async (key) => {
    try {
        const data = await exports.redis.get(key);
        return data ? JSON.parse(data) : null;
    }
    catch (error) {
        console.error('getCache error:', error);
        return null;
    }
};
exports.getCache = getCache;
const setCache = async (key, value, expireSeconds = 3600) => {
    try {
        await exports.redis.setex(key, expireSeconds, JSON.stringify(value));
    }
    catch (error) {
        console.error('setCache error:', error);
    }
};
exports.setCache = setCache;
const invalidatePostCache = async (postId) => {
    try {
        await exports.redis.del(`post_public_${postId}`);
        await exports.redis.del('posts_public_list');
    }
    catch (error) {
        console.error('invalidatePostCache error:', error);
    }
};
exports.invalidatePostCache = invalidatePostCache;
