import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RabbitMqModule } from 'src/messaging/rabbitmq/rabbitmq.module';
import { MailerModule } from 'src/mailer/mailer.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EmailConsumer } from './consumers/email.consumer';
import { AnalyticsConsumer } from './consumers/analytics.consumer';
import { OutboxRelayService } from './outbox-relay.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RabbitMqModule,
    MailerModule,
  ],
  providers: [OutboxRelayService, EmailConsumer, AnalyticsConsumer],
})
export class WorkerModule {}
