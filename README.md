# Content Publishing API

A production-ready Content Publishing API built with **Node.js, Express, TypeScript, Prisma, PostgreSQL, Redis, and BullMQ**. This service fulfills all the requirements set out by the Partnr Network task, featuring JWT role-based access control, rich content lifecycle management, automated post versioning history, background scheduled publishing jobs, caching, and GIN `tsvector` indexed full-text search.

## Overview & Architecture

### Core Technologies
- **Express.js (TypeScript)**: Scalable, decoupled routing framework handling API endpoints securely.
- **PostgreSQL**: Primary data store hosting tables for `users`, `posts`, and `post_revisions`. It powers complex operations like full-text searching natively through parameterized queries securely interfacing to Prisma.
- **Prisma**: Type-safe ORM mediating all database commands. Every API request that mutates multiple tables (such as updating a post & taking a snapshot) executes within **Prisma `$transaction`** blocks to ensure absolute atomic integrity.
- **Redis & BullMQ**: Operates the entire asynchronous architecture. Redis provides a fast, persistent message queue that BullMQ natively consumes. Redis is also used manually via `ioredis` to cache `GET /posts/published` listings, drastically improving throughput for intensive public read activities.
- **Microservice Layout**: Designed across two primary Node processes. An `api` process capturing requests, and a decoupled `worker` process continuously iterating a repeatable BullMQ job. 

### Data Flow
1. **Creation/Update**: Authors manipulate `draft` posts. Updating a post invokes a transactional sequence triggering a snapshot insertion directly into `post_revisions` maintaining identical historical integrity alongside the primary post edit.
2. **Scheduling**: Authors set `status=scheduled` pointing to a future `scheduled_for` timestamp. The asynchronous BullMQ worker repetitively scans for these items safely, flipping their status directly into `published` once their specified time successfully elapses in the past.
3. **Reading**: Published feeds cache their output directly into Redis. Whenever an author executes modifications, explicitly transitions a post into the `published` status, or the worker unlocks a `scheduled` transition independently, they aggressively invalidate correlated metadata in Redis.

## Getting Started

The entire cluster is strictly containerized using `docker-compose.yml`. No manual database seeding or migration setup is required. The `docker-compose` orchestration handles migrating the PostgreSQL database, executing tests, and safely initializing both the Express API and the BullMQ Scheduler.

### Deployment / Running Locally

If it is your first time bootstrapping the environment, Docker will safely deploy and populate everything automatically. It runs in the background.

```bash
docker-compose up -d
```

### Automated Testing

We bundled an intricate **Jest & SuperTest** end-to-end framework testing every specification, transaction edge-case, validation, routing policy, and database insertion flawlessly mapping to the system behaviors explicitly requested.
There is a custom `submission.yml` mapping execution commands natively:

```bash
# Easily invoke the test runner through standard Docker mechanisms
docker-compose run --rm api npm test
```

## API Usage Reference

### Authentication
`POST /auth/login`
Authenticates a user and returns a signed JWT token mapping directly to their internal integer `user.id`.

### Author Posts (Protected)
- `POST /posts` -> Create a new `draft` Post. Automatically structures URL-friendly slugs tracking suffix uniqueness.
- `GET /posts` -> Paginated overview tracking the authenticated Author's created footprint.
- `GET /posts/:id` -> Reads a given post.
- `PUT /posts/:id` -> Updates post content or title, automatically generating a historical snapshot.
- `DELETE /posts/:id` -> Soft or hard deletes a record.
- `POST /posts/:id/publish` -> Immediately activates a post to public. 
- `POST /posts/:id/schedule` -> Requires `scheduledFor` mapping payload to automate eventual publication via worker.
- `GET /posts/:id/revisions` -> Exposes the snapshot integrity history mapping to schema formats.

### Public Posts
- `GET /posts/published` -> Read purely `published` items tracking active Redis Cache responses.
- `GET /posts/published/:id` -> Deep read single items.
- `GET /search?q=` -> Raw Postgres full-text query search engine filtering public assets mapped accurately.

### Media 
- `POST /media/upload` -> Encodes & streams arbitrary image content storing file structures on the `/uploads` disk layout reliably. Returns the public web hook embedding URL string referencing it.
