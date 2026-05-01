import { BadRequestException, Injectable } from '@nestjs/common';
import { signInDto } from './dto/signIn.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as argon from 'argon2';
import { signUpDto } from './dto/signUp.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OutboxService } from 'src/messaging/outbox/outbox.service';
import { EventNames } from 'src/messaging/events/event-names';


@Injectable()
export class AuthService {
    constructor(private prismaService : PrismaService,
         private jwtService : JwtService,
         private configService : ConfigService,
         private outboxService : OutboxService
        ) {}
    async signUp(signUpDto: signUpDto) {
        try {
            const userExists = await this.prismaService.user.findUnique({
            where: { email: signUpDto.email },
            });

            if (userExists) {
                throw new BadRequestException('User already exists');
            }

            const hashedPassword = await argon.hash(signUpDto.password);
            const newUser = await this.prismaService.$transaction(async (tx) => {
                const createdUser = await tx.user.create({
                    data: {
                        ...signUpDto,
                        password: hashedPassword,
                    },
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                });

                await this.outboxService.queueEvent(tx, {
                    eventName: EventNames.AuthUserSignedUp,
                    routingKey: EventNames.AuthUserSignedUp,
                    payload: {
                    userId: createdUser.id,
                    email: createdUser.email,
                    firstName: createdUser.firstName,
                    lastName: createdUser.lastName,
                    },
                });
                return createdUser;
            });

            return { message: 'User created successfully', user: newUser };
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            throw new Error('Error while signing up');
        }
    }

    async signIn(signInDto : signInDto){
        try {
            const userExists = await this.prismaService.user.findUnique({
                where : {
                    email : signInDto.email,
                }
            })
            if(!userExists) {
                throw new Error('User does not exist')
            }
            const passwordMatches = await argon.verify(userExists.password,signInDto.password);
            if(!passwordMatches) {
                throw new Error('Invalid credentials')
            }
            const signInEventPayload = {
                userId: userExists.id,
                email: userExists.email,
                firstName: userExists.firstName,
                lastName: userExists.lastName,
            }
            await this.prismaService.$transaction(async (tx) => {
                await this.outboxService.queueEvent(tx, {
                    eventName: EventNames.AuthUserSignedIn,
                    routingKey: EventNames.AuthUserSignedIn,
                    payload: signInEventPayload,
                });
            });
            const payLoad = {
                sub : userExists.id,
                email : userExists.email,
            }
            const token = this.jwtService.sign(payLoad,{expiresIn : '24h', secret : this.configService.get('JWT_SECRET')}); 
            return {message : 'User signed in successfully', token : token}
        } catch (error) {
            throw new Error('Error while signing in');
        }
    }
}
