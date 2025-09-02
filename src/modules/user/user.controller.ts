import { Body, Controller, Get, Param, ParseIntPipe, Put, Request, UseGuards } from '@nestjs/common';
import { JwtGuard } from 'src/modules/auth/guard/jwt.guard';
import { UserService } from './user.service';
import { editProfileDto } from './dto/editProfile.dto';

@UseGuards(JwtGuard)
@Controller('users')
export class UserController {
    constructor(private userService : UserService){}

    @Get('profile')
    getProfile(@Request() req:any) {
        const {email, firstName, lastName} = req.user;
        return {
            email,firstName,lastName
        };
    }

    @Put('EditProfile/:id')
    editProfile(@Param('id', ParseIntPipe) id : number,@Body() editProfileDto : editProfileDto){
        return this.userService.editProfile(id, editProfileDto);
    }

    //List all challenges a user has created
    @Get(':userId/created-challenges')
    getCreatedChallenges(@Request() req : any){
        return this.userService.getCreatedChallenges(req.user.id);
    }

    //List all challenges a user has joined
    @Get(':userId/participated-challenges')
    getParticipatedChallenges(){}
}
