# System Architecture & Design Choices

## Components & Interaction Diagram

```mermaid
graph TD
    Client((Client)) --> |HTTP Requests| API(Express.js API Server)
    
    subgraph Containerized Application
        API --> |Reads & Writes| DB[(PostgreSQL Database)]
        API --> |Caching (Reads/Writes)| Cache[(Redis Cache)]
        API --> |Queues Jobs| WorkerQueue[(Redis Queue)]
        
        Worker[BullMQ Worker Job] --> |Polls| WorkerQueue
        Worker --> |Publishes Scheduled Posts| DB
        Worker --> |Invalidates Cache| Cache
    end
```

## Component Descriptions

1.  **API Server (Node.js/Express.js)**
    *   **Role**: Handles all incoming HTTP traffic, authentication, routing, input validation (via Zod), and business logic.
    *   **Design**: Built gracefully using modular routes (`auth`, `posts`, `public`, `media`). Uses stateless JWT authentication per requirements to maximize horizontal scalability.

2.  **Database (PostgreSQL via Prisma ORM)**
    *   **Role**: Primary persistent data store.
    *   **Design**: Used heavily for executing complex relationships, specifically using `Prisma.$transaction` natively for the `post_revisions` audit logging feature, guaranteeing atomic resilience during content modifications. Utilizes raw PostgreSQL queries specifically for `to_tsvector` full-text search mappings over published titles and content.

3.  **Cache & Queues (Redis)**
    *   **Role**: Operates in dual concurrency as an in-memory datastore for caching responses and message broker storage for the BullMQ workers.
    *   **Design**: Heavily utilized by `GET /published` to drastically mitigate direct recursive data loads on the database engine. Invalidation commands trigger dynamically when `author` roles explicitly update material, allowing Redis to clear overlapping memory stores safely.

4.  **Background Worker (BullMQ + Node.js)**
    *   **Role**: Continuously processes time-sensitive content transitions.
    *   **Design**: Built safely utilizing `repeat` job rules, executing completely detached from the `API Server`. When identified drafts pass their set time sequence chronologically, the Worker maps through them safely, issues the atomic PostgreSQL state updates, and aggressively flushes the required Redis nodes identically to standard API overrides.
