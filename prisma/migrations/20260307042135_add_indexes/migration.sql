-- Index for FKs
CREATE INDEX IF NOT EXISTS "posts_author_id_idx" ON "posts"("author_id");
CREATE INDEX IF NOT EXISTS "post_revisions_post_id_idx" ON "post_revisions"("post_id");
CREATE INDEX IF NOT EXISTS "post_revisions_revision_author_id_idx" ON "post_revisions"("revision_author_id");

-- Index for status fields and timestamps
CREATE INDEX IF NOT EXISTS "posts_status_scheduled_for_idx" ON "posts"("status", "scheduled_for");
CREATE INDEX IF NOT EXISTS "posts_status_published_at_idx" ON "posts"("status", "published_at");

-- Expressional GIN Index for search performance
CREATE INDEX IF NOT EXISTS "posts_search_idx" ON "posts" USING GIN ((to_tsvector('english', title) || to_tsvector('english', content)));
