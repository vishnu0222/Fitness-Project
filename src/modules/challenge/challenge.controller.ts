import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ChallengeService } from './challenge.service';
import { ImageUploadInterceptor } from 'src/common/interceptors/image-upload.interceptor';
import { createChallengeDto } from './dto/create-challenge.dto';
import { JwtGuard } from 'src/modules/auth/guard/jwt.guard';
import { PaginationDto } from 'src/common/pagination/pagination.dto';
import { updateChallengeDto } from './dto/update-challenge.dto';
import { User } from 'generated/prisma';
import { updateParticipationDto } from './dto/update-participation.dto';

@UseGuards(JwtGuard)
@Controller('challenge')
export class ChallengeController {
    constructor(private challengeService : ChallengeService){}
    //Challenge API
    @Post('create')
    @UseInterceptors(ImageUploadInterceptor('image'))
    createChallenge(@Request() req : any, @Body() createChallengeDto : createChallengeDto, @UploadedFile() file : Express.Multer.File) {
        return this.challengeService.createChallenge(req.user.id, createChallengeDto, file);
    }

    //Get one challenge’s full details
    @Get('getById/:id')
    getChallengeById(@Param('id', ParseIntPipe) challengeId : number) {
        return this.challengeService.getChallengeById(challengeId);
    }

    //List all challenges (with pagination, filtering & sorting)
    @Get('getAll')
    getAllChallenges(@Query() PaginationDto : PaginationDto) {
        return this.challengeService.getAllChallenges( PaginationDto);
    }

    @Patch('update/:id')
    @UseInterceptors(ImageUploadInterceptor('image'))
    updateChallenge(
        @Param('id', ParseIntPipe) challengeId: number, @Body() updateChallengeDto : updateChallengeDto, @UploadedFile() file : Express.Multer.File) {
        return this.challengeService.updateChallenge(challengeId, updateChallengeDto, file);
    }

    @Delete('delete/:id')
    deleteChallenge(@Param('id',ParseIntPipe) challengeId : number) {
        return this.challengeService.deleteChallenge(challengeId);
    }

    //----------->>Participation API

    @Post(':id/join')
    joinChallenge(@Request() req : any, @Param('id',ParseIntPipe) challengeId : number) {
        return this.challengeService.joinChallenge(req.user.id, challengeId)
    }

    @Delete(':id/leave')
    leaveChallenge(@Request() req : any, @Param('id',ParseIntPipe) challengeId : number) {
        return this.challengeService.leaveChallenge(req.user.id, challengeId)
    }

    //List all participants for a challenge
    @Get(':id/participants')
    getParticipants(@Param('id', ParseIntPipe) challengeId : number, @Query() paginationDto : PaginationDto) {
        return this.challengeService.getParticipants(challengeId, paginationDto);
    }

    //List all challenges a user has joined
    @Get(':id/participations')
    getParticipations(@Request() req : any) {
        return this.challengeService.getParticipations(req.user.id);
    }

    //Update a user’s participation
    @Patch(':cid/participants/:pid')
    updateParticipation(@Param('cid',ParseIntPipe) challengeId : number, @Param('pid',ParseIntPipe) participantId : number,@Body() updateParticipationDto : updateParticipationDto) {
        return this.challengeService.updateParticipation(challengeId, participantId,updateParticipationDto);
    }

    //----------->>Bonus API

    @Get('active')
    getActiveChallenges() {
        return this.challengeService.getActiveChallenges();
    }

    @Get('completed')
    getCompletedChallenges() {}

    @Get('upcoming')
    getUpcomingChallenges() {}
}
