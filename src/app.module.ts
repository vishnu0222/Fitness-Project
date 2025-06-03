import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ChallengeModule } from './challenge/challenge.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [AuthModule, UserModule, ChallengeModule, PrismaModule, ConfigModule.forRoot({isGlobal : true}),
    MulterModule.register({dest: './uploads', limits : {fileSize : 1024 * 1024 * 5}}) // 5MB
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
