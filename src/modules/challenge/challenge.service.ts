import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { createChallengeDto } from './dto/create-challenge.dto';
import { last } from 'rxjs';
import { PaginationDto } from 'src/common/pagination/pagination.dto';
import { updateChallengeDto } from './dto/update-challenge.dto';
import { updateParticipationDto } from './dto/update-participation.dto';


@Injectable()
export class ChallengeService {
    constructor(private prismaService : PrismaService) {}

    async createChallenge(userId : number, createChallengeDto : createChallengeDto, file : Express.Multer.File) {
        try {
            const newChallenge = await this.prismaService.challenge.create({
                data : {
                    ...createChallengeDto,
                    image : file.filename,
                    creator: { connect: { id: userId } } // Assuming userId is the ID of the creator
                }
            })
            return { message: 'Challenge created successfully', challenge: newChallenge };
        } catch (error) {
            throw new Error('Error creating challenge');
        }
    }

    async getChallengeById(challengeId : number) {
        const challenge = await this.prismaService.challenge.findUnique({
            where : {
                id :challengeId
            }
        })
        return { message: 'Challenge retrieved successfully', challenge : challenge };
    }

    async getAllChallenges(paginationDto: PaginationDto): Promise<any> {
        const skip = (paginationDto.page-1) * paginationDto.limit;
        const take = paginationDto.limit;
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
        return allChallenges;
      }

    async updateChallenge(challengeId:number, updateChallengeDto : updateChallengeDto, file : Express.Multer.File) { 
        try {
            const challenge = await this.prismaService.challenge.findUnique({
                where : {
                    id : challengeId,
                }
            })
            
            if(!challenge) {
                throw new Error('Challenge not found');
            }
            const updatedChallenge = await this.prismaService.challenge.update({
                where : {id : challengeId},
                data : {
                    ...updateChallengeDto,
                    image : file? file.filename : '',
                }
            })
            return { message: 'Challenge updated successfully', challenge: updatedChallenge };
        } catch (error) {
            throw new Error('Error updating challenge');
        }
    }

    async deleteChallenge(challengeId : number) {
        const challenge = await this.prismaService.challenge.findUnique({
            where : {
                id : challengeId,
            }
        })
        if (!challenge) {
            throw new Error('Challenge not found');
        }
        const challengeTitle = challenge.title;
        await this.prismaService.challenge.delete({
            where : {
                id : challengeId
            }
        })
        return { message: `Challenge '${challengeTitle}' deleted successfully`};
    }

    async joinChallenge(userId : number, challengeId : number) {
        const user = await this.prismaService.user.findUnique({
            where : {
                id : userId,
            }
        })
        if (!user) {
            throw new Error('User not found');
        }
        const challenge = await this.prismaService.challenge.findUnique({
            where : {
                id : challengeId,
            }
        })
        if (!challenge) {
            throw new Error('Challenge not found');
        }
        const participantExists = await this.prismaService.challengeEnrollment.findFirst({
            where : {
                userId: userId,
                challengeId: challengeId,
            }
        })
        if(participantExists) {
            // return { message: 'You have already joined the challenge',participantExists: participantExists };
            throw new BadRequestException('You have already joined this challenge');
        }
        const participation = await this.prismaService.challengeEnrollment.create({
            data : {
                user: { connect: { id: userId } },
                challenge: { connect: { id: challengeId } },
            }
        })
        return { message: 'Participation created successfully', participation };
    }
    async leaveChallenge(userId : number, challengeId : number){
        const user = await this.prismaService.user.findUnique({
            where : {
                id : userId,
            }
        })
        if (!user) {
            throw new Error('User not found');
        }
        const challenge = await this.prismaService.challenge.findUnique({
            where : {
                id : challengeId,
            }
        })
        if (!challenge) {
            throw new Error('Challenge not found');
        }
        const participantExists = await this.prismaService.challengeEnrollment.findUnique({
            where : {
                userId_challengeId: {
                    challengeId : challengeId,
                    userId : userId,
                }
            }
        }) 
        if(!participantExists) {
            throw new BadRequestException('You have not joined this challenge');
        }
        await this.prismaService.challengeEnrollment.delete({
            where : {
                userId_challengeId: {
                    challengeId : challengeId,
                    userId : userId,
                }
            }
        })
        return { message: 'Participation deleted successfully' };
    }

    async getParticipants(challengeId : number, paginationDto : PaginationDto) {
        const skip = (paginationDto.page-1) * paginationDto.limit;
        const take = paginationDto.limit;
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
        console.log(participants);
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
        console.log(participations);
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
        return { message: 'Active challenges retrieved successfully', activeParticipants };
    }
}
