import request from 'supertest';
import app from '../src/index';
import prisma from '../src/db/client';

describe('API Tests', () => {
    let token: string;
    let postId: number;

    beforeAll(async () => {
        // Clean database
        await prisma.postRevision.deleteMany();
        await prisma.post.deleteMany();
        await prisma.user.deleteMany();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it('Health Check', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('healthy');
    });

    it('Registers an author', async () => {
        const res = await request(app).post('/auth/register').send({
            username: 'author1',
            email: 'author1@test.com',
            password: 'testpassword',
            role: 'author',
        });
        expect(res.status).toBe(201);
    });

    it('Logs in and gets token', async () => {
        const res = await request(app).post('/auth/login').send({
            email: 'author1@test.com',
            password: 'testpassword',
        });
        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        token = res.body.token;
    });

    it('Creates a post', async () => {
        const res = await request(app)
            .post('/posts')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'First Post',
                content: 'Content of the first post',
            });
        expect(res.status).toBe(201);
        expect(res.body.status).toBe('draft');
        expect(res.body.slug).toBe('first-post');
        postId = res.body.id;
    });

    it('Generates unique slug correctly', async () => {
        const res = await request(app)
            .post('/posts')
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'First Post',
                content: 'Content again',
            });
        expect(res.status).toBe(201);
        expect(res.body.slug).toBe('first-post-1');
    });

    it('Updates a post and triggers versioning', async () => {
        const res = await request(app)
            .put(`/posts/${postId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'First Post Updated',
                content: 'Updated content',
            });
        expect(res.status).toBe(200);

        // Check if revision was created
        const revs = await request(app)
            .get(`/posts/${postId}/revisions`)
            .set('Authorization', `Bearer ${token}`);

        expect(revs.status).toBe(200);
        expect(revs.body).toHaveLength(1);
        expect(revs.body[0].titleSnapshot).toBe('First Post');
    });

    it('Publishes a post', async () => {
        const res = await request(app)
            .post(`/posts/${postId}/publish`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('published');
    });

    it('Reads published posts publicly', async () => {
        const res = await request(app).get('/posts/published');
        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
    });

    it('Schedules a post', async () => {
        const futureDate = new Date();
        futureDate.setMinutes(futureDate.getMinutes() + 10);

        // create another post
        const draftUserParams = { title: 'Scheduled attempt', content: 'content' };
        const draftRes = await request(app).post('/posts').set('Authorization', `Bearer ${token}`).send(draftUserParams);

        const scheduleId = draftRes.body.id;

        const res = await request(app)
            .post(`/posts/${scheduleId}/schedule`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                scheduledFor: futureDate.toISOString()
            });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('scheduled');
    });
});
