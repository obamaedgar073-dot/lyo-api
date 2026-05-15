# LYO Backend API

REST API and WebSocket server for the LYO social platform.

## Features

- **Authentication**: JWT-based auth with refresh tokens, password hashing
- **Posts**: CRUD operations, media uploads, reactions (vibes), comments
- **Social Graph**: Follow/unfollow with private account support
- **Real-time**: WebSocket notifications and messaging
- **Admin Panel**: User management, content moderation, analytics
- **Rate Limiting**: Protection against abuse
- **File Uploads**: Image/video handling with size limits

## Tech Stack

- Node.js + Express + TypeScript
- Prisma ORM + PostgreSQL
- Redis (caching, sessions, rate limiting)
- Socket.io (WebSockets)
- JWT (jose library) - authentication
- Winston - logging
- Zod - validation
- Multer - file uploads

## Project Structure

```
src/
├── config/         # Environment, DB, Redis, Logger
├── controllers/    # Route handlers
├── middleware/     # Auth, validation, error handling, rate limiting
├── routes/         # API route definitions
├── validators/     # Zod validation schemas
├── utils/          # Helpers (JWT, password, upload, responses)
├── websocket/      # Socket.io setup
└── server.ts       # Entry point
```

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### Setup

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your database and Redis credentials

# Run database migrations
npx prisma migrate dev

# Generate Prisma client
npm run db:generate

# Seed database with test data
npm run db:seed

# Start development server
npm run dev
```

### Production

```bash
npm run build
npm start
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh tokens
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Posts
- `GET /api/posts/feed` - Get feed (following/discover/trending)
- `GET /api/posts/:id` - Get single post
- `POST /api/posts` - Create post (multipart/form-data)
- `DELETE /api/posts/:id` - Delete post
- `POST /api/posts/:id/vibe` - Add/remove vibe
- `POST /api/posts/:id/repost` - Repost/unrepost
- `GET /api/posts/:id/comments` - Get comments
- `POST /api/posts/:id/comments` - Add comment

### Users
- `GET /api/users/:username` - Get profile
- `PATCH /api/users/me` - Update profile
- `POST /api/users/me/avatar` - Upload avatar
- `POST /api/users/me/cover` - Upload cover
- `POST /api/users/:id/follow` - Follow user
- `DELETE /api/users/:id/follow` - Unfollow user

### Admin
- `GET /api/admin/users` - List users
- `PATCH /api/admin/users/:id/status` - Update user status
- `GET /api/admin/posts` - List posts
- `DELETE /api/admin/posts/:id` - Delete post
- `GET /api/admin/reports` - List reports
- `PATCH /api/admin/reports/:id/resolve` - Resolve report

## WebSocket Events

- `connect` - Authenticate with token
- `notification` - Receive real-time notifications
- `message` - Receive messages
- `typing` - Typing indicators
- `user_online` / `user_offline` - Presence updates

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 8000 |
| DATABASE_URL | PostgreSQL connection string | required |
| REDIS_URL | Redis connection string | redis://localhost:6379 |
| JWT_ACCESS_SECRET | JWT access token secret | required |
| JWT_REFRESH_SECRET | JWT refresh token secret | required |
| CLIENT_URL | Frontend URL for CORS | http://localhost:3000 |
| UPLOAD_DIR | File upload directory | ./uploads |

## Database Schema

15 models including: User, Post, Vibe, Comment, Follow, Repost, Bookmark, Notification, Report, Circle, Moment, Conversation, Message, RefreshToken, DailyStats.

See `prisma/schema.prisma` for full schema.
