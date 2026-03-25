import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    // Load .env file and make ConfigService available globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),

    // Rate limiting: 10 requests per 60 seconds on throttled routes
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,  // 60 seconds in milliseconds
          limit: 10,
        },
      ],
    }),

    // Global modules
    PrismaModule,
    MailModule,

    // Feature modules
    AuthModule,
  ],
  providers: [
    // Apply rate limiting globally (individual routes can override)
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}