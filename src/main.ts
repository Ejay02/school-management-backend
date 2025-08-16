import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { EventEmitter } from 'events';
import rateLimit from 'express-rate-limit';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  console.log(`
    _____  _     
   | ____|(_)    
   |  _|  | |    
   | |___ | |    
   |_____|/ |    
        |__/      
  
   🔧 Crafted with 🖤 by Ej  
   🔗 github.com/Ejay02
  `);

  // Increase default max listeners globally
  EventEmitter.defaultMaxListeners = 20;

  // SSL/TLS Configuration
  let httpsOptions = undefined;

  // Helper to resolve SSL file paths relative to compiled code
  const resolveSsl = (p: string) => path.resolve(__dirname, p);

  // Check if we're in production mode but not on Render (Render handles SSL for us)
  if (process.env.NODE_ENV === 'production' && !process.env.RENDER) {
    const keyPath =
      process.env.SSL_KEY_PATH || resolveSsl('../ssl/private-key.pem');
    const certPath =
      process.env.SSL_CERT_PATH || resolveSsl('../ssl/certificate.pem');
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      httpsOptions = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      };
    } else {
      // eslint-disable-next-line no-console
      console.warn('Production SSL files not found, starting without HTTPS');
    }
  } else if (process.env.USE_HTTPS_DEV === 'true') {
    // Use development self-signed certificates if specified
    const keyPath = resolveSsl('../ssl/dev-key.pem');
    const certPath = resolveSsl('../ssl/dev-cert.pem');
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      httpsOptions = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      };
    } else {
      // eslint-disable-next-line no-console
      console.warn('Dev SSL files not found, starting without HTTPS');
    }
  }

  // Create the app with HTTPS options if available
  const app = await NestFactory.create(AppModule, { httpsOptions });

  app.useWebSocketAdapter(new IoAdapter(app));

  // Configure CORS
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? ['https://eduhub-portal.netlify.app']
        : '*',
    credentials: true,
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

  // Set up HSTS ?? for production
  if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
      next();
    });
  }

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
