import { Injectable } from '@nestjs/common';
import { RabbitMqConnection } from './rabbitmq.connection';

@Injectable()
export class EventPublisher {
  constructor(private readonly rabbitMqConnection: RabbitMqConnection) {}
  // The publish method is responsible for sending messages to RabbitMQ. It takes a routing key, the message payload, and an 
  // optional message ID. The message is published to the exchange defined in the RabbitMqConnection with the specified routing key.
  //  The message is marked as persistent to ensure it survives broker restarts, and it includes metadata such as content type and timestamp.
  async publish(routingKey: string, payload: unknown, messageId?: string): Promise<void> {
    const channel = await this.rabbitMqConnection.getPublisherChannel();
    const body = Buffer.from(JSON.stringify(payload));

    await new Promise<void>((resolve, reject) => {
      channel.publish(
        this.rabbitMqConnection.exchange,
        routingKey,
        body,
        {
          persistent: true,
          contentType: 'application/json',
          contentEncoding: 'utf-8',
          timestamp: Date.now(),
          messageId,
        },
        (err) => {
          if (err) reject(err);
          else resolve();
        },
      );
    });
  }
}
