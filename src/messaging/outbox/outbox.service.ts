import { Injectable } from '@nestjs/common';
import { OutboxStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

// This service is responsible for queuing domain events in the outbox table within the same transaction 
// as the main business logic. The worker process will later read from this table and publish events to 
// RabbitMQ.
export interface DomainEvent<TPayload = Record<string, unknown>> {
  eventId: string;
  eventName: string;
  occurredAt: string;
  version: number;
  payload: TPayload;
}

interface QueueEventInput<TPayload extends Record<string, unknown>> {
  eventName: string;
  routingKey: string;
  payload: TPayload;
}

@Injectable()
export class OutboxService {
  async queueEvent<TPayload extends Record<string, unknown>>(
    tx: Prisma.TransactionClient,
    input: QueueEventInput<TPayload>,
  ): Promise<string> {
    const eventId = randomUUID();

    // We store the event in the outbox table with a status of PENDING. The worker will later read this event, publish it to RabbitMQ, and then update the status to PROCESSED.
    const event = {
      eventId,
      eventName: input.eventName,
      occurredAt: new Date().toISOString(),
      version: 1,
      payload: input.payload,
    };

    // Using the transaction client to ensure that the event is only queued if the main business logic succeeds. If the transaction rolls back, the event won't be queued.
    await tx.outboxEvent.create({
      data: {
        id: eventId,
        eventName: input.eventName,
        routingKey: input.routingKey,
        payload: event as unknown as Prisma.InputJsonValue,
        status: OutboxStatus.PENDING,
      },
    });

    return eventId;
  }
}
