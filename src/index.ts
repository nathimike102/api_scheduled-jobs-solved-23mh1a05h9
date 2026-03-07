import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import postsRouter from "./routes/posts";
import publicRouter, { searchHandler } from "./routes/public";
import mediaRouter from "./routes/media";
import { setupScheduler } from "./worker";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/static", express.static("uploads"));

const apiV1Router = express.Router();
apiV1Router.use("/auth", authRouter);
apiV1Router.use("/posts", publicRouter);
apiV1Router.use("/posts", postsRouter);
apiV1Router.use("/media", mediaRouter);
apiV1Router.get("/search", searchHandler);
apiV1Router.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});
apiV1Router.get("/", (req, res) => {
  res.json({ status: "ok", message: "API V1 is running" });
});

app.use("/api/v1", apiV1Router);

app.use("/auth", authRouter);
app.use("/posts", publicRouter); // public endpoints intercepting /published etc before dynamic IDs
app.use("/posts", postsRouter);
app.use("/media", mediaRouter);

// Alias to satisfy strict requirement paths
app.get("/search", searchHandler);

app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

const PORT = process.env.PORT || 8000;

if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`Server listening on port ${PORT}`);
    await setupScheduler();
  });
}

export default app;
