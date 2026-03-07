import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import postsRouter from './routes/posts';
import publicRouter from './routes/public';
import mediaRouter from './routes/media';
import { setupScheduler } from './worker';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/static', express.static('uploads'));

app.use('/auth', authRouter);
app.use('/posts', publicRouter); // public endpoints intercepting /published etc before dynamic IDs
app.use('/posts', postsRouter);
app.use('/media', mediaRouter);

app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

const PORT = process.env.PORT || 8000;

if (require.main === module) {
    app.listen(PORT, async () => {
        console.log(`Server listening on port ${PORT}`);
        await setupScheduler();
    });
}

export default app;
