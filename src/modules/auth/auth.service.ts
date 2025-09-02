import { BadRequestException, Injectable } from '@nestjs/common';
import { signInDto } from './dto/signIn.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as argon from 'argon2';
import { signUpDto } from './dto/signUp.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';

@Injectable()
export class AuthService {
    constructor(private prismaService : PrismaService,
         private jwtService : JwtService,
         private configService : ConfigService
        ) {}
    async signUp(signUpDto : signUpDto) {
        try {
            const userExists = await this.prismaService.user.findUnique({
                where : {
                    email : signUpDto.email
                }
            });
            if(userExists) {
                throw new BadRequestException('User already exists')
            }
            const hashedPassword = await argon.hash(signUpDto.password);
            const newUser = await this.prismaService.user.create({
                data : {
                    ...signUpDto,
                    password : hashedPassword
                }
            })
            return {message: 'User created successfully', user : newUser}
        } catch (error) {
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
