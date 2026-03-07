"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_1 = __importDefault(require("./routes/auth"));
const posts_1 = __importDefault(require("./routes/posts"));
const public_1 = __importDefault(require("./routes/public"));
const media_1 = __importDefault(require("./routes/media"));
const worker_1 = require("./worker");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/static', express_1.default.static('uploads'));
app.use('/auth', auth_1.default);
app.use('/posts', public_1.default); // public endpoints intercepting /published etc before dynamic IDs
app.use('/posts', posts_1.default);
app.use('/media', media_1.default);
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});
const PORT = process.env.PORT || 8000;
if (require.main === module) {
    app.listen(PORT, async () => {
        console.log(`Server listening on port ${PORT}`);
        await (0, worker_1.setupScheduler)();
    });
}
exports.default = app;
