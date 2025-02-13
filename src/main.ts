import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
  });

  // Use raw middleware for Stripe webhook endpoint
  app.use(
    '/webhook',
    express.raw({ type: 'application/json' }), // Stripe requires raw body for webhooks
  );

  await app.listen(3000);
}
bootstrap();
