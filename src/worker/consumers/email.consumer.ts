import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Channel, ConsumeMessage } from 'amqplib';
import { EmailService } from 'src/mailer/email.service';
import { EventNames } from 'src/messaging/events/event-names';
import { RabbitMqConnection } from 'src/messaging/rabbitmq/rabbitmq.connection';
import { PrismaService } from 'src/prisma/prisma.service';

type MailRecipient = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
};

type DomainEvent<T = any> = {
  eventId: string;
  eventName: string;
  occurredAt: string;
  version: number;
  payload: T;
};
// This consumer is responsible for processing events. It listens to the notifications.email.q queue and sends 
// appropriate email notifications to users based on the event type. The consumer also implements idempotency by 
// tracking processed event IDs in the database to prevent duplicate email sending in case of message redelivery.
@Injectable()
export class EmailConsumer implements OnModuleInit {
  private readonly logger = new Logger(EmailConsumer.name);
  private readonly consumerName = 'email-consumer';
  private channel!: Channel;

  constructor(
    private readonly rabbitMqConnection: RabbitMqConnection,
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async onModuleInit(): Promise<void> {
    const queue = this.configService.get<string>('EMAIL_QUEUE', 'notifications.email.q');
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
    // Bind to specific event routing keys that this consumer should handle. This allows for more efficient message 
    // routing and ensures that the consumer only receives relevant events.
    const bindings = [
      EventNames.AuthUserSignedUp,
      EventNames.AuthUserSignedIn,
      EventNames.ChallengeCreated,
      EventNames.ChallengeUpdated,
      EventNames.ChallengeDeleted,
      EventNames.ChallengeJoined,
      EventNames.ChallengeLeft,
      EventNames.ChallengeProgressUpdated,
      EventNames.WorkoutPlanCreated,
      EventNames.WorkoutPlanUpdated,
      EventNames.WorkoutPlanDeleted,
    ];

    for (const routingKey of bindings) {
      await this.channel.bindQueue(queue, this.rabbitMqConnection.exchange, routingKey);
    }

    await this.channel.consume(queue, (msg) => void this.handleMessage(msg), { noAck: false });
    this.logger.log(`Email consumer listening on ${queue}`);
  }

  private async handleMessage(msg: ConsumeMessage | null): Promise<void> {
    if (!msg) return;

    try {
      const event = JSON.parse(msg.content.toString()) as DomainEvent;
      const eventId = msg.properties.messageId || event.eventId || `delivery-${msg.fields.deliveryTag}`;

      const firstProcess = await this.markProcessed(eventId);
      if (!firstProcess) {
        this.channel.ack(msg);
        return;
      }

      await this.routeEvent(msg.fields.routingKey, event);
      this.channel.ack(msg);
    } catch (error) {
      this.logger.error(`Email consumer failed: ${error instanceof Error ? error.message : String(error)}`);
      this.channel.nack(msg, false, false);
    }
  }

  private async routeEvent(routingKey: string, event: DomainEvent): Promise<void> {
    switch (routingKey) {
      case EventNames.AuthUserSignedUp:
        await this.handleUserSignedUp(event);
        return;
      case EventNames.AuthUserSignedIn:
        await this.handleUserSignedIn(event);
        return;
      case EventNames.ChallengeCreated:
        await this.handleChallengeCreated(event);
        return;
      case EventNames.ChallengeUpdated:
        await this.handleChallengeUpdated(event);
        return;
      case EventNames.ChallengeDeleted:
        await this.handleChallengeDeleted(event);
        return;
      case EventNames.ChallengeJoined:
        await this.handleChallengeJoined(event);
        return;
      case EventNames.ChallengeLeft:
        await this.handleChallengeLeft(event);
        return;
      case EventNames.ChallengeProgressUpdated:
        await this.handleChallengeProgressUpdated(event);
        return;
      case EventNames.WorkoutPlanCreated:
        await this.handleWorkoutPlanCreated(event);
        return;
      case EventNames.WorkoutPlanUpdated:
        await this.handleWorkoutPlanUpdated(event);
        return;
      case EventNames.WorkoutPlanDeleted:
        await this.handleWorkoutPlanDeleted(event);
        return;
      default:
        this.logger.warn(`No email handler for routing key ${routingKey}`);
    }
  }

  private async handleUserSignedUp(event: DomainEvent<{ email: string; firstName: string }>): Promise<void> {
    await this.emailService.sendMail(
      event.payload.email,
      'Welcome to ChallengeFit Platform',
      `<p>Hi ${event.payload.firstName},</p><p>Your account has been created successfully.</p>`,
    );
  }

  private async handleUserSignedIn(event: DomainEvent<{ email: string; firstName: string }>): Promise<void> {
    await this.emailService.sendMail(
      event.payload.email,
      'New sign-in to your account',
      `<p>Hi ${event.payload.firstName},</p><p>Your account was just signed in. If this was you, you can safely ignore this email. If you suspect any unauthorized access, please secure your account.</p>`,
    );
  }

  private async handleChallengeCreated(
    event: DomainEvent<{ creatorId: number; title: string; description: string; image: string | null; startDate: string; endDate: string }>,
  ): Promise<void> {
    const users = await this.prismaService.user.findMany({
      where: {
        id: {
          not: event.payload.creatorId,
        },
      },
      select: {
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    await this.sendToMany(
      users,
      `New challenge: ${event.payload.title}`,
      (user) =>
        `<p>Hi ${user.firstName ?? 'there'},</p><p>A new challenge "<strong>${event.payload.title}</strong>" has been created.</p><p>${event.payload.description}</p><p>Starts: ${new Date(event.payload.startDate).toLocaleString()}<br/>Ends: ${new Date(event.payload.endDate).toLocaleString()}</p><p>${event.payload.image ? `<img src="${event.payload.image}" alt="${event.payload.title}" />` : ''}</p>`,
    );
  }

  private async handleChallengeUpdated(
    event: DomainEvent<{ challengeId: number; title: string; updatedFields: string[] }>,
  ): Promise<void> {
    const recipients = await this.getChallengeRecipients(event.payload.challengeId);

    await this.sendToMany(
      recipients,
      `Challenge updated: ${event.payload.title}`,
      (user) =>
        `<p>Hi ${user.firstName ?? 'there'},</p><p>The challenge "<strong>${event.payload.title}</strong>" was updated.</p>`,
    );
  }

  private async handleChallengeDeleted(
    event: DomainEvent<{ title: string; recipients: MailRecipient[] }>,
  ): Promise<void> {
    await this.sendToMany(
      event.payload.recipients,
      `Challenge deleted: ${event.payload.title}`,
      (user) =>
        `<p>Hi ${user.firstName ?? 'there'},</p><p>The challenge "<strong>${event.payload.title}</strong>" has been deleted.</p>`,
    );
  }

  private async handleChallengeJoined(
    event: DomainEvent<{ challengeId: number; userId: number; challengeTitle: string }>,
  ): Promise<void> {
    const joinedUser = await this.getUserRecipient(event.payload.userId);
    const creator = await this.getChallengeCreatorRecipient(event.payload.challengeId);

    await this.sendToMany(
      joinedUser ? [joinedUser] : [],
      `Joined challenge: ${event.payload.challengeTitle}`,
      (user) =>
        `<p>Hi ${user.firstName ?? 'there'},</p><p>You successfully joined "<strong>${event.payload.challengeTitle}</strong>".</p>`,
    );

    await this.sendToMany(
      creator ? [creator] : [],
      `New participant in ${event.payload.challengeTitle}`,
      (user) =>
        `<p>Hi ${user.firstName ?? 'there'},</p><p>A new user joined your challenge "<strong>${event.payload.challengeTitle}</strong>".</p>`,
    );
  }

  private async handleChallengeLeft(
    event: DomainEvent<{ challengeId: number; userId: number; challengeTitle: string }>,
  ): Promise<void> {
    const leavingUser = await this.getUserRecipient(event.payload.userId);
    const creator = await this.getChallengeCreatorRecipient(event.payload.challengeId);

    await this.sendToMany(
      leavingUser ? [leavingUser] : [],
      `Left challenge: ${event.payload.challengeTitle}`,
      (user) =>
        `<p>Hi ${user.firstName ?? 'there'},</p><p>You left "<strong>${event.payload.challengeTitle}</strong>".</p>`,
    );

    await this.sendToMany(
      creator ? [creator] : [],
      `Participant left ${event.payload.challengeTitle}`,
      (user) =>
        `<p>Hi ${user.firstName ?? 'there'},</p><p>A participant left your challenge "<strong>${event.payload.challengeTitle}</strong>".</p>`,
    );
  }

  private async handleChallengeProgressUpdated(
    event: DomainEvent<{ challengeId: number; userId: number; progress: number | null; challengeTitle: string }>,
  ): Promise<void> {
    const participant = await this.getUserRecipient(event.payload.userId);
    const creator = await this.getChallengeCreatorRecipient(event.payload.challengeId);

    await this.sendToMany(
      participant ? [participant] : [],
      `Progress updated: ${event.payload.challengeTitle}`,
      (user) =>
        `<p>Hi ${user.firstName ?? 'there'},</p><p>Your progress for "<strong>${event.payload.challengeTitle}</strong>" is now <strong>${event.payload.progress ?? 0}%</strong>.</p>`,
    );

    await this.sendToMany(
      creator ? [creator] : [],
      `Participant progress updated`,
      (user) =>
        `<p>Hi ${user.firstName ?? 'there'},</p><p>A participant updated progress in "<strong>${event.payload.challengeTitle}</strong>" to <strong>${event.payload.progress ?? 0}%</strong>.</p>`,
    );
  }

  private async handleWorkoutPlanCreated(
    event: DomainEvent<{ userId: number; title: string }>,
  ): Promise<void> {
    const user = await this.getUserRecipient(event.payload.userId);

    await this.sendToMany(
      user ? [user] : [],
      `Workout plan created: ${event.payload.title}`,
      (recipient) =>
        `<p>Hi ${recipient.firstName ?? 'there'},</p><p>Your workout plan "<strong>${event.payload.title}</strong>" was created successfully.</p>`,
    );
  }

  private async handleWorkoutPlanUpdated(
    event: DomainEvent<{ userId: number; title: string; updatedFields: string[] }>,
  ): Promise<void> {
    const user = await this.getUserRecipient(event.payload.userId);

    await this.sendToMany(
      user ? [user] : [],
      `Workout plan updated: ${event.payload.title}`,
      (recipient) =>
        `<p>Hi ${recipient.firstName ?? 'there'},</p><p>Your workout plan "<strong>${event.payload.title}</strong>" was updated.</p><p>Updated fields: ${event.payload.updatedFields.join(', ') || 'details changed'}</p>`,
    );
  }

  private async handleWorkoutPlanDeleted(
    event: DomainEvent<{ userId: number; title: string }>,
  ): Promise<void> {
    const user = await this.getUserRecipient(event.payload.userId);

    await this.sendToMany(
      user ? [user] : [],
      `Workout plan deleted: ${event.payload.title}`,
      (recipient) =>
        `<p>Hi ${recipient.firstName ?? 'there'},</p><p>Your workout plan "<strong>${event.payload.title}</strong>" was deleted.</p>`,
    );
  }

  private async getChallengeRecipients(challengeId: number): Promise<MailRecipient[]> {
    const challenge = await this.prismaService.challenge.findUnique({
      where: { id: challengeId },
      include: {
        creator: {
          select: { email: true, firstName: true, lastName: true },
        },
        participants: {
          select: {
            user: {
              select: { email: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (!challenge) return [];

    return this.uniqueRecipients([
      {
        email: challenge.creator.email,
        firstName: challenge.creator.firstName,
        lastName: challenge.creator.lastName,
      },
      ...challenge.participants.map((p) => ({
        email: p.user.email,
        firstName: p.user.firstName,
        lastName: p.user.lastName,
      })),
    ]);
  }

  private async getChallengeCreatorRecipient(challengeId: number): Promise<MailRecipient | null> {
    const challenge = await this.prismaService.challenge.findUnique({
      where: { id: challengeId },
      select: {
        creator: {
          select: { email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!challenge) return null;

    return {
      email: challenge.creator.email,
      firstName: challenge.creator.firstName,
      lastName: challenge.creator.lastName,
    };
  }

  private async getUserRecipient(userId: number): Promise<MailRecipient | null> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user) return null;

    return {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  private async sendToMany(
    recipients: MailRecipient[],
    subject: string,
    htmlBuilder: (recipient: MailRecipient) => string,
  ): Promise<void> {
    const uniqueRecipients = this.uniqueRecipients(recipients);

    for (const recipient of uniqueRecipients) {
      await this.emailService.sendMail(recipient.email, subject, htmlBuilder(recipient));
    }
  }

  private uniqueRecipients(recipients: MailRecipient[]): MailRecipient[] {
    const map = new Map<string, MailRecipient>();

    for (const recipient of recipients) {
      if (!recipient?.email) continue;
      map.set(recipient.email, recipient);
    }

    return [...map.values()];
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
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }
}
