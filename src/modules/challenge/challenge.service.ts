import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { createChallengeDto } from './dto/create-challenge.dto';
import { PaginationDto } from 'src/common/pagination/pagination.dto';
import { updateChallengeDto } from './dto/update-challenge.dto';
import { updateParticipationDto } from './dto/update-participation.dto';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { OutboxService } from 'src/messaging/outbox/outbox.service';
import { EventNames } from 'src/messaging/events/event-names';



@Injectable()
export class ChallengeService {
    constructor(private prismaService : PrismaService,
         @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private outboxService: OutboxService
        ) {}

    async createChallenge(userId: number, createChallengeDto: createChallengeDto, file: Express.Multer.File) {
        try {
            //transaction to create challenge and queue event
            //transaction basically is to run all the database operations inside this block as one unit,
            //if any of the operation fails then all the operations will be rolled back to maintain data integrity
            const newChallenge = await this.prismaService.$transaction(async (tx) => {
                const created = await tx.challenge.create({
                    data: {
                    ...createChallengeDto,
                    image: file?.filename ?? null,
                    creator: { connect: { id: userId } },
                    },
            });
                // queue event in outbox table to be later picked by worker and published to rabbitmq
                await this.outboxService.queueEvent(tx, {
                    eventName: EventNames.ChallengeCreated,
                    routingKey: EventNames.ChallengeCreated,
                    payload: {
                    challengeId: created.id,
                    creatorId: userId,
                    title: created.title,
                    description: created.description,
                    image: created.image,
                    startDate: created.startDate.toISOString(),
                    endDate: created.endDate.toISOString(),
                    },
                });

                return created;
            });

            return { message: 'Challenge created successfully', challenge: newChallenge };
        } 
        catch (error) {
            throw new Error('Error creating challenge', error);
        }
    }

    async getChallengeById(challengeId : number) {
        const cacheKey = `challenge:${challengeId}`;
        const cachedChallenge = await this.cacheManager.get(cacheKey);
        if (cachedChallenge) {
          return { message: 'Challenge retrieved successfully (from cache)', challenge: cachedChallenge };
        }
        const challenge = await this.prismaService.challenge.findUnique({
            where : {
                id :challengeId
            }
        })
        await this.cacheManager.set(cacheKey, challenge, 120*1000); // Cache for 120 seconds
        return { message: 'Challenge retrieved successfully', challenge : challenge };
    }

    async getAllChallenges(paginationDto: PaginationDto): Promise<any> {
        const skip = (paginationDto.page-1) * paginationDto.limit;
        const take = paginationDto.limit;
        const cacheKey = `challenges:${paginationDto.page}_limit_${paginationDto.limit}`;
        const cachedChallenges = await this.cacheManager.get(cacheKey);
        if (cachedChallenges) {
          return { message: 'Challenges retrieved successfully (from cache)', challenges: cachedChallenges };
        }
        const allChallenges = await this.prismaService.challenge.findMany({
            skip,
            take,
          orderBy: { createdAt: 'desc' },
          include: {
            creator: {
            select:{firstName: true, lastName: true},
            },
            _count: {
              select: { participants: true },
            },
          },
        });
        await this.cacheManager.set(cacheKey, allChallenges, 60000); // Cache for 60 seconds
        return allChallenges;
      }

    async updateChallenge(challengeId: number, updateChallengeDto: updateChallengeDto, file: Express.Multer.File) {
        try {
            const challenge = await this.prismaService.challenge.findUnique({
                where: { id: challengeId },
            });

            if (!challenge) {
            throw new Error('Challenge not found');
            }

            const updatedChallenge = await this.prismaService.$transaction(async (tx) => {
            const updated = await tx.challenge.update({
                where: { id: challengeId },
                data: {
                ...updateChallengeDto,
                image: file ? file.filename : challenge.image,
                },
            });

            await this.outboxService.queueEvent(tx, {
                eventName: EventNames.ChallengeUpdated,
                routingKey: EventNames.ChallengeUpdated,
                payload: {
                challengeId: updated.id,
                title: updated.title,
                updatedFields: Object.keys(updateChallengeDto),
                },
            });

            return updated;
            });

            return { message: 'Challenge updated successfully', challenge: updatedChallenge };
        } catch {
            throw new Error('Error updating challenge');
        }
    }

    async deleteChallenge(challengeId: number) {
        const deletedTitle = await this.prismaService.$transaction(async (tx) => {
            const challenge = await tx.challenge.findUnique({
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

            if (!challenge) {
            throw new Error('Challenge not found');
            }

            await tx.challenge.delete({
            where: { id: challengeId },
            });

            await this.outboxService.queueEvent(tx, {
            eventName: EventNames.ChallengeDeleted,
            routingKey: EventNames.ChallengeDeleted,
            payload: {
                challengeId,
                title: challenge.title,
                recipients: [
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
                ],
            },
            });

            return challenge.title;
        });

        return { message: `Challenge '${deletedTitle}' deleted successfully` };
    }

    async joinChallenge(userId: number, challengeId: number) {
        const user = await this.prismaService.user.findUnique({
            where: { id: userId },
        });
        if (!user) throw new Error('User not found');

        const challenge = await this.prismaService.challenge.findUnique({
            where: { id: challengeId },
        });
        if (!challenge) {
            throw new Error('Challenge not found');
        }

        const participantExists = await this.prismaService.challengeEnrollment.findFirst({
            where: { userId, challengeId },
        });
        if (participantExists) {
            throw new Error('You have already joined this challenge');
        }

        const participation = await this.prismaService.$transaction(async (tx) => {
            const created = await tx.challengeEnrollment.create({
            data: {
                user: { connect: { id: userId } },
                challenge: { connect: { id: challengeId } },
            },
            });

            await this.outboxService.queueEvent(tx, {
            eventName: EventNames.ChallengeJoined,
            routingKey: EventNames.ChallengeJoined,
            payload: {
                challengeId,
                userId,
                challengeTitle: challenge.title,
            },
            });

            return created;
        });

        return { message: 'Participation created successfully', participation };
    }
    async leaveChallenge(userId: number, challengeId: number) {
        const challenge = await this.prismaService.challenge.findUnique({
            where: { id: challengeId },
        });
        if (!challenge) throw new Error('Challenge not found');

        const participantExists = await this.prismaService.challengeEnrollment.findUnique({
            where: {
            userId_challengeId: { challengeId, userId },
            },
        });

        if (!participantExists) {
            throw new BadRequestException('You have not joined this challenge');
        }

        await this.prismaService.$transaction(async (tx) => {
            await tx.challengeEnrollment.delete({
            where: {
                userId_challengeId: { challengeId, userId },
            },
            });

            await this.outboxService.queueEvent(tx, {
            eventName: EventNames.ChallengeLeft,
            routingKey: EventNames.ChallengeLeft,
            payload: {
                challengeId,
                userId,
                challengeTitle: challenge.title,
            },
            });
        });

        return { message: 'Participation deleted successfully' };
    }

    async getParticipants(challengeId : number, paginationDto : PaginationDto) {
        const skip = (paginationDto.page-1) * paginationDto.limit;
        const take = paginationDto.limit;
        const cacheKey = `challenge:${challengeId}:participants_page_${paginationDto.page}_limit_${paginationDto.limit}`;
        const cachedParticipants = await this.cacheManager.get(cacheKey);
        if (cachedParticipants) {
          return { message: 'Participants retrieved successfully (from cache)', participants: cachedParticipants };
        }
        const challenge = await this.prismaService.challenge.findUnique({
            where : {
                id : challengeId,
            },
            include : {
                _count: {
                    select: { participants: true },
                }
            }
        })
        if(challenge?._count.participants === 0) {
            throw new BadRequestException('No participants found for this challenge');
        }
        if (!challenge) {
            throw new Error('Challenge not found');
        }
        const participants = await this.prismaService.challengeEnrollment.findMany({
            skip,
            take,
            where : {
                challengeId : challengeId,
            },
            orderBy: { joinedAt: 'desc' },
            include : {
                user : {
                    select : {
                        firstName : true,
                        lastName : true,
                    }
                }
            }
        })
        await this.cacheManager.set(cacheKey, participants, 60000); // Cache for 60 seconds
        return { message: 'Participants retrieved successfully', participants };    
    }
    async getParticipations(userId : number){
        const user = await this.prismaService.user.findUnique({
            where : {
                id : userId,
            }
        })
        if (!user) {
            throw new BadRequestException('User not found');
        }
        const participations = await this.prismaService.challengeEnrollment.findMany({
            where : {
                userId : userId
            },
            include : {
                challenge :{
                    select :{
                        title :true,
                        description :true
                    }
                }
            }
        })
        return {message : "Retrived all participations",participations}
    }
    async updateParticipation(challengeId : number, participantId : number, updateParticipationDto : updateParticipationDto) {
        const participant = await this.prismaService.challengeEnrollment.findUnique({
            where : {
                userId_challengeId: {
                    challengeId : challengeId,
                    userId : participantId,
                }
            }
        })
        if(!participant) {
            throw new NotFoundException('Participant not found');
        }
        const updatedParticipation = await this.prismaService.challengeEnrollment.update({
            where : {
                userId_challengeId: {
                    challengeId : challengeId,
                    userId : participantId,
                }
            },
            data : {
                progress : updateParticipationDto.progress,
            }
        })
        return { message: 'Participation updated successfully', updatedParticipation };
    }
    
    async getActiveChallenges() {
        const now = new Date();
        const cacheKey = 'active_challenges';
        const cachedActiveChallenges = await this.cacheManager.get(cacheKey);
        if (cachedActiveChallenges) {
          return { message: 'Active challenges retrieved successfully (from cache)', activeParticipants: cachedActiveChallenges };
        }
        const activeParticipants = await this.prismaService.challenge.findMany({
            where : {
                startDate  : {lte : now},
                endDate  : {gte : now},
            },
            include : {
                creator: {
                    select:{firstName: true, lastName: true},
                },
                _count: {
                    select: { participants: true },
                },
            }
        });
        if(activeParticipants.length === 0) {
            throw new BadRequestException('No active challenges found');
        }
        await this.cacheManager.set(cacheKey, activeParticipants, 45*1000); // Cache for 45 seconds
        return { message: 'Active challenges retrieved successfully', activeParticipants };
    }
}
