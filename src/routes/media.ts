import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { authenticate, requireAuthor, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireAuthor);

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req: AuthRequest, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${req.user?.id}-${uniqueSuffix}-${file.originalname}`);
    },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'));
    }
};

const upload = multer({ storage, fileFilter });

router.post('/upload', upload.single('file'), (req: AuthRequest, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Please upload a file' });
        }

        const fileUrl = `/static/${req.file.filename}`;
        res.json({ url: fileUrl, identifier: req.file.filename });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
