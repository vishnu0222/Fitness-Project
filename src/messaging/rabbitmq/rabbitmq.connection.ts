import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { Channel, ChannelModel, ConfirmChannel } from 'amqplib';


@Injectable()
export class RabbitMqConnection implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqConnection.name);
  private connection?: ChannelModel;
  private publishChannel?: ConfirmChannel;
  private connecting?: Promise<void>;

  readonly exchange: string;

  constructor(private readonly configService: ConfigService) {
    this.exchange = this.configService.get<string>('RABBITMQ_EXCHANGE', 'fitness.events');
  }

  async onModuleInit(): Promise<void> {
    await this.ensureConnected();
  }

  async onModuleDestroy(): Promise<void> {
    await this.publishChannel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  async ensureConnected(): Promise<void> {
    if (this.publishChannel) return;

    if (!this.connecting) {
      this.connecting = this.connect();
    }

    await this.connecting;
    this.connecting = undefined;
  }
  // The getPublisherChannel method ensures that the connection to RabbitMQ is established and returns a confirm channel for publishing messages.
  async getPublisherChannel(): Promise<ConfirmChannel> {
    await this.ensureConnected();

    if (!this.publishChannel) {
      throw new Error('RabbitMQ publisher channel is not initialized.');
    }

    return this.publishChannel;
  }
  // The createConsumerChannel method creates a new channel for consuming messages. It ensures that the connection is established and asserts the exchange before returning the channel.
  async createConsumerChannel(): Promise<Channel> {
    await this.ensureConnected();

    if (!this.connection) {
      throw new Error('RabbitMQ connection is not initialized.');
    }

    const channel = await this.connection.createChannel();
    await channel.assertExchange(this.exchange, 'topic', { durable: true });
    return channel;
  }
  // The connect method establishes a connection to RabbitMQ using the URL from the configuration. It sets up event listeners 
  // for connection errors and closures, and creates a confirm channel for publishing messages. 
  // The exchange is asserted to ensure it exists before any messages are published.

  private async connect(): Promise<void> {
    const url = this.configService.get<string>('RABBITMQ_URL');
    if (!url) {
      throw new Error('RABBITMQ_URL is missing.');
    }

    const connection = await amqp.connect(url);

    connection.on('error', (err) => {
      this.logger.error(`RabbitMQ connection error: ${err.message}`);
    });

    connection.on('close', () => {
      this.logger.warn('RabbitMQ connection closed.');
      this.publishChannel = undefined;
      this.connection = undefined;
    });

    const publishChannel = await connection.createConfirmChannel();
    await publishChannel.assertExchange(this.exchange, 'topic', { durable: true });

    this.connection = connection;
    this.publishChannel = publishChannel;

    this.logger.log(`Connected to RabbitMQ exchange "${this.exchange}".`);
  }
}
