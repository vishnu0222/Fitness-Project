import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { PassportStrategy } from "@nestjs/passport"
import { ExtractJwt, Strategy } from "passport-jwt"
import { PrismaService } from "src/prisma/prisma.service"

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy,'jwt') {
    constructor(private configService: ConfigService, private prismaService : PrismaService) {
        const secret = configService.get('JWT_SECRET')
        if (!secret) {
            throw new Error('JWT_SECRET is not defined')
        }
        super({
            jwtFromRequest : ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration : false,
            secretOrKey : secret,
        })
    }
    async validate(payLoad : {
        sub : number,
        email : string,
    }) {
        const user = this.prismaService.user.findUnique({
            where : {
                id : payLoad.sub
            }
        })
        if(!user) {
            throw new Error('User not found')
        }
        return user
    }
}