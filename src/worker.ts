import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker/worker.module';

// This is the entry point for the worker process. It initializes the NestJS application context and starts the worker. The worker 
// will listen for events in the outbox table, publish them to RabbitMQ, and then update their status to PROCESSED.
async function bootstrap() {
  const logger = new Logger('WorkerBootstrap');
  const app = await NestFactory.createApplicationContext(WorkerModule);

  logger.log('Worker started');
  // The worker will run indefinitely, so we don't need to do anything else here. We just need to make sure to handle shutdown signals gracefully.
  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}. Closing worker...`);
    await app.close();
    process.exit(0);
  };
  // Listen for shutdown signals to gracefully shut down the worker
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}
bootstrap();
