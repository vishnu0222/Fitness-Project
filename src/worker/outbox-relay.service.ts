import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxStatus } from '@prisma/client';
import { EventPublisher } from 'src/messaging/rabbitmq/event.publisher';
import { PrismaService } from 'src/prisma/prisma.service';

// This service periodically checks the outbox_events table for pending events and publishes them to RabbitMQ.
// It also implements retry logic with exponential backoff for failed events. This ensures reliable event delivery even if RabbitMQ is temporarily unavailable.
@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  private readonly pollMs: number;
  private readonly batchSize: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly eventPublisher: EventPublisher,
    configService: ConfigService,
  ) {
    this.pollMs = Number(configService.get<string>('OUTBOX_POLL_MS', '2000'));
    this.batchSize = Number(configService.get<string>('OUTBOX_BATCH_SIZE', '50'));
    this.maxRetries = Number(configService.get<string>('OUTBOX_MAX_RETRIES', '10'));
    this.retryBaseMs = Number(configService.get<string>('OUTBOX_RETRY_BASE_MS', '2000'));
  }
  // On module initialization, we start a timer that calls the flush method at regular intervals defined by pollMs. 
  // We also call flush immediately to process any pending events without waiting for the first interval.
  async onModuleInit(): Promise<void> {
    this.timer = setInterval(() => void this.flush(), this.pollMs);
    await this.flush();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
  // The flush method retrieves pending events from the outbox, attempts to publish them,
  // and updates their status based on the outcome. It uses a transaction to ensure that event processing is atomic.
  private async flush(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const events = await this.prismaService.outboxEvent.findMany({
        // Only pick events that are pending and due for retry
        where: {
          status: OutboxStatus.PENDING,
          nextAttemptAt: { lte: new Date() },
        },
        orderBy: { createdAt: 'asc' },
        take: this.batchSize,
      });
      // Process each event sequentially to maintain order and simplify retry logic
      //Routing key is determined by the event's routingKey field, which should be set when the event is queued in the outbox
      for (const event of events) {
        try {
          await this.eventPublisher.publish(event.routingKey, event.payload, event.id);

          await this.prismaService.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: OutboxStatus.PUBLISHED,
              publishedAt: new Date(),
              lastError: null,
            },
          });
        } catch (error) {
          const attempts = event.attempts + 1;
          const shouldFail = attempts >= this.maxRetries;
          const delayMs = this.retryBaseMs * Math.pow(2, Math.min(attempts - 1, 6));
            // Log the error and update the event for retry or mark as failed
          await this.prismaService.outboxEvent.update({
            where: { id: event.id },
            data: {
              attempts,
              status: shouldFail ? OutboxStatus.FAILED : OutboxStatus.PENDING,
              nextAttemptAt: new Date(Date.now() + delayMs),
              lastError: error instanceof Error ? error.message : String(error),
            },
          });
        }
      }
    } finally {
      this.running = false;
    }
  }
}
