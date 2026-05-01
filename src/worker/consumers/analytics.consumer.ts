import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Channel, ConsumeMessage } from 'amqplib';
import { RabbitMqConnection } from 'src/messaging/rabbitmq/rabbitmq.connection';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AnalyticsConsumer implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsConsumer.name);
  private readonly consumerName = 'analytics-consumer';
  private channel!: Channel;

  constructor(
    private readonly rabbitMqConnection: RabbitMqConnection,
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const queue = this.configService.get<string>('ANALYTICS_QUEUE', 'analytics.activity.q');
    const dlq = `${queue}.dlq`;
    const prefetch = Number(this.configService.get<string>('RABBITMQ_PREFETCH', '10'));

    this.channel = await this.rabbitMqConnection.createConsumerChannel();
    this.channel.prefetch(prefetch);

    await this.channel.assertQueue(dlq, { durable: true });
    await this.channel.assertQueue(queue, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': dlq,
      },
    });

    await this.channel.bindQueue(queue, this.rabbitMqConnection.exchange, '#');

    await this.channel.consume(queue, (msg) => void this.handleMessage(msg), { noAck: false });
    this.logger.log(`Analytics consumer listening on ${queue}`);
  }

  private async handleMessage(msg: ConsumeMessage | null): Promise<void> {
    if (!msg) return;

    try {
      const eventId = msg.properties.messageId || `delivery-${msg.fields.deliveryTag}`;
      const firstProcess = await this.markProcessed(eventId);
      if (!firstProcess) {
        this.channel.ack(msg);
        return;
      }

      const body = JSON.parse(msg.content.toString()) as any;
      this.logger.log(`Analytics event ${msg.fields.routingKey} user=${body?.payload?.userId ?? 'n/a'}`);

      this.channel.ack(msg);
    } catch (error) {
      this.logger.error(`Analytics consumer failed: ${error instanceof Error ? error.message : String(error)}`);
      this.channel.nack(msg, false, false);
    }
  }

  private async markProcessed(eventId: string): Promise<boolean> {
    try {
      await this.prismaService.processedEvent.create({
        data: {
          consumer: this.consumerName,
          eventId,
        },
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }
}
