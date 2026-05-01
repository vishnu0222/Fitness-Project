import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RabbitMqConnection } from './rabbitmq.connection';
import { EventPublisher } from './event.publisher';

@Module({
  imports: [ConfigModule],
  providers: [RabbitMqConnection, EventPublisher],
  exports: [RabbitMqConnection, EventPublisher],
})
export class RabbitMqModule {}
