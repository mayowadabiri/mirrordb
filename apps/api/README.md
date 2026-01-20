# API Server

Fastify API server with Prisma ORM integration and comprehensive security plugins.

## Features

- **🔒 Security**: Helmet, CORS, Rate Limiting
- **🔑 Authentication**: JWT with cookie support
- **📦 Database**: Prisma ORM with PostgreSQL
- **📝 API Docs**: Swagger/OpenAPI documentation
- **⚡ Performance**: Compression, caching
- **🛠️ Developer Experience**: TypeScript, hot reload, logging

## Setup

### 1. Install Dependencies

```bash
yarn install
```

### 2. Environment Configuration

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Update the `.env` file with your configuration:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/dbname?schema=public"

# Server
PORT=3000
NODE_ENV=development
API_URL=http://localhost:3000

# CORS
CORS_ORIGIN=http://localhost:5173

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW="1 minute"

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

### 3. Prisma Setup

Generate the Prisma Client:

```bash
yarn prisma:generate
```

Run migrations (after adding models to schema.prisma):

```bash
yarn prisma:migrate
```

Open Prisma Studio to view your data:

```bash
yarn prisma:studio
```

## Development

Start the development server with hot reload:

```bash
yarn dev
```

The server will start on `http://localhost:3000` (or the port specified in your `.env` file).

## Production

Build the TypeScript code:

```bash
yarn build
```

Start the production server:

```bash
yarn start
```

## API Documentation

Once the server is running, you can access:

- **API Docs**: http://localhost:3000/docs
- **Health Check**: http://localhost:3000/health
- **DB Health**: http://localhost:3000/health/db

## Installed Plugins

### Security
- **@fastify/helmet** - Sets security headers
- **@fastify/cors** - CORS support
- **@fastify/rate-limit** - Rate limiting protection

### Authentication
- **@fastify/jwt** - JWT authentication
- **@fastify/cookie** - Cookie handling

### Body Parsing
- **@fastify/multipart** - Multipart form data (file uploads)
- **@fastify/formbody** - URL-encoded form data

### Utilities
- **@fastify/sensible** - Useful HTTP utilities
- **@fastify/compress** - Response compression
- **@fastify/swagger** - OpenAPI schema generation
- **@fastify/swagger-ui** - Interactive API documentation

## API Endpoints

### Health Checks

- `GET /health` - Basic health check
- `GET /health/db` - Database connection health check

### Authentication

- `POST /auth/device/start` - Start device authentication flow
- `POST /auth/device/unstart` - Cancel device authentication

## Using Prisma in Routes

The Prisma client is available on the Fastify instance via `fastify.prisma`:

```typescript
import { FastifyInstance } from "fastify";

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.get("/users", async (request, reply) => {
    const users = await fastify.prisma.user.findMany();
    return users;
  });

  fastify.post("/users", async (request, reply) => {
    const user = await fastify.prisma.user.create({
      data: request.body,
    });
    return user;
  });
}
```

## Using JWT Authentication

Protect routes with JWT authentication:

```typescript
export default async function protectedRoutes(fastify: FastifyInstance) {
  // Add authentication hook
  fastify.addHook("onRequest", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  fastify.get("/protected", async (request, reply) => {
    return { user: request.user };
  });
}
```

Generate a token:

```typescript
const token = fastify.jwt.sign({ userId: 1, email: "user@example.com" });
reply.setCookie("token", token, {
  path: "/",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
});
```

## Project Structure

```
src/
  ├── app.ts              # Fastify app configuration & plugins
  ├── server.ts           # Server startup
  ├── lib/
  │   └── prisma.ts       # Prisma client instance
  ├── plugins/
  │   ├── prisma.ts       # Prisma Fastify plugin
  │   └── config.ts       # Configuration plugin
  └── routes/
      ├── health.ts       # Health check routes
      └── auth/
          ├── index.ts    # Auth route aggregator
          └── devices.ts  # Device auth routes
prisma/
  ├── schema.prisma       # Prisma schema
  └── migrations/         # Database migrations
```

## Adding Database Models

1. Edit `prisma/schema.prisma` to add your models:

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

2. Create and apply migration:

```bash
yarn prisma:migrate
```

3. The Prisma Client will be automatically regenerated with the new models.

## Available Scripts

- `yarn dev` - Start development server with hot reload
- `yarn build` - Build TypeScript to JavaScript
- `yarn start` - Start production server
- `yarn prisma:generate` - Generate Prisma Client
- `yarn prisma:migrate` - Run database migrations
- `yarn prisma:studio` - Open Prisma Studio

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment (development/production) | development |
| `API_URL` | API base URL | http://localhost:3000 |
| `CORS_ORIGIN` | Allowed CORS origins | true (all origins) |
| `RATE_LIMIT_MAX` | Max requests per window | 100 |
| `RATE_LIMIT_WINDOW` | Rate limit time window | 1 minute |
| `JWT_SECRET` | JWT signing secret | Required in production |
