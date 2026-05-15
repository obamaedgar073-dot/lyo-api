// ============================================================
// LYO - WebSocket Handler (Socket.io)
// ============================================================

import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { verifyAccessToken } from '@/utils';
import { prisma } from '@/config';
import { logger } from '@/config';

interface SocketUser {
  id: string;
  username: string;
  socketId: string;
}

const onlineUsers = new Map<string, SocketUser>();

export function setupWebSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
    },
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token as string;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = await verifyAccessToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
        select: { id: true, username: true, status: true },
      });

      if (!user || user.status !== 'active') {
        return next(new Error('User not found or inactive'));
      }

      socket.data.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    logger.info(`User connected: ${user.username} (${socket.id})`);

    // Store online status
    onlineUsers.set(user.id, { id: user.id, username: user.username, socketId: socket.id });

    // Join personal room for notifications
    socket.join(`user:${user.id}`);

    // Broadcast online status to friends
    socket.broadcast.emit('user_online', user.id);

    // Handle typing indicators
    socket.on('typing', (data: { conversationId: string; isTyping: boolean }) => {
      socket.to(`conversation:${data.conversationId}`).emit('typing', {
        userId: user.id,
        isTyping: data.isTyping,
      });
    });

    // Handle messages
    socket.on('message', async (data: { conversationId: string; content: string }) => {
      try {
        const message = await prisma.message.create({
          data: {
            conversationId: data.conversationId,
            senderId: user.id,
            content: data.content,
          },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        });

        // Broadcast to conversation room
        io.to(`conversation:${data.conversationId}`).emit('message', message);
      } catch (err) {
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      onlineUsers.delete(user.id);
      socket.broadcast.emit('user_offline', user.id);
      logger.info(`User disconnected: ${user.username} (${socket.id})`);
    });
  });

  return io;
}

export function getOnlineUsers(): string[] {
  return Array.from(onlineUsers.keys());
}

export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}

export function getIO(): Server | null {
  // This will be set when setupWebSocket is called
  return null;
}
