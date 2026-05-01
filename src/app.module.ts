import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { ChallengeModule } from './modules/challenge/challenge.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { WorkoutModule } from './modules/workout/workout.module';
import { ChatModule } from './modules/chat/chat.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { OutboxModule } from './messaging/outbox/outbox.module';
import { RabbitMqModule } from './messaging/rabbitmq/rabbitmq.module';



@Module({
  imports: [AuthModule, UserModule, ChallengeModule, PrismaModule, OutboxModule, RabbitMqModule, ConfigModule.forRoot({isGlobal : true}),
    MulterModule.register({dest: './uploads', limits : {fileSize : 1024 * 1024 * 5}}),
    WorkoutModule, ChatModule,
    ThrottlerModule.forRoot([{
      ttl: 5000,
      limit : 2,
    }]),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          socket: {
            host: configService.get<string>('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379),
          },
          ttl: configService.get<number>('REDIS_TTL', 60),
        }),
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService,
    { provide: 'APP_GUARD', useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
