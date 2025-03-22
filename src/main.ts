import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { EventEmitter } from 'events';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
  // Increase default max listeners globally
  EventEmitter.defaultMaxListeners = 20;

  const app = await NestFactory.create(AppModule);

  app.useWebSocketAdapter(new IoAdapter(app));

  // Configure CORS
  app.enableCors({
    origin: '*',
  });

  // Apply rate limiting with generous limits
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 500, // limit each IP to 500 requests per windowMs
      standardHeaders: true,
      legacyHeaders: false,
      message: 'Too many requests from this IP, please try again later',
      // Skip rate limiting for WebSocket and GraphQL requests
      skip: (request) => {
        // Skip WebSocket connections
        if (request.headers.upgrade === 'websocket') {
          return true;
        }

        // Skip GraphQL operations
        if (request.path.includes('/graphql')) {
          return true;
        }

        return false;
      },
    }),
  );

  // Use raw middleware for Stripe webhook endpoint
  app.use(
    '/webhook',
    express.raw({ type: 'application/json' }), // Stripe requires raw body for webhooks
  );

  await app.listen(3000);
}
bootstrap();
