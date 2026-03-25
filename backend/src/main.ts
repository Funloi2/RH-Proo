import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix: all routes start with /api
  app.setGlobalPrefix('api');

  // Validation: automatically validate all incoming DTOs
  app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,       // Strip properties not in the DTO
        forbidNonWhitelisted: true, // Throw error if unknown properties are sent
        transform: true,       // Auto-transform payloads to DTO instances
      }),
  );

  // CORS: allow frontend to call the API
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = process.env.BACKEND_PORT || 3001;
  await app.listen(port);

  console.log(`HR-Proo API running on http://localhost:${port}/api`);
}

bootstrap();