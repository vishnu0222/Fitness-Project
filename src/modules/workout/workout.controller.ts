import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { WorkoutService } from './workout.service';
import { CreateWorkoutPlanDto } from './dto/create-workoutplan.dto';
import { JwtGuard } from '../auth/guard/jwt.guard';
import { updateWorkoutPlanDto } from './dto/update-workout-plan.dto';
import { CreateWorkoutSplitDto } from './dto/create-workout-split.dto';
import { updateWorkoutSplitDto } from './dto/update-workout-split.dto';
import { ExerciseDto } from './dto/exercises.dto';
import { updateExerciseDto } from './dto/update-exercise.dto';

@UseGuards(JwtGuard)
@Controller('workout')
export class WorkoutController {
    constructor(private workoutService: WorkoutService) {

    }
    // Workout Plan API

    @Post('create-workout-plan')
    async createWorkoutPlan(@Request() req : any, @Body() createWorkoutPlanDto : CreateWorkoutPlanDto) {
        return this.workoutService.createWorkoutPlan(req.user.id, createWorkoutPlanDto);
    }

    @Get('get-all-plans')
    async getAllWorkoutPlans(@Request() req:any) {
        return this.workoutService.getAllWorkoutPlans(req.user.id);
    }

    @Get('get-plan/:id')
    async getWorkoutPlanById(@Param('id') planId: number) {
        return this.workoutService.getWorkoutPlanById(planId);
    }

    @Patch('update-plan/:id')
    async updateWorkoutPlan(@Param('id',ParseIntPipe) planId : number, @Body() updateWorkoutPlanDto : updateWorkoutPlanDto){
        return this.workoutService.updateWorkoutPlan(planId, updateWorkoutPlanDto);
    }

    @Delete('delete-plan/:id')
    async deleteWorkoutPlan(@Param('id', ParseIntPipe) planId : number) {
        return this.workoutService.deleteWorkoutPlan(planId);
    }

    //Workout Split API

    @Post('create-split/:id')
    async createWorkoutSplit(@Param('id',ParseIntPipe) planId : number, @Body() createWorkoutSplitDto: CreateWorkoutSplitDto){
        return this.workoutService.createWorkoutSplit(planId, createWorkoutSplitDto)
    }

    @Get('get-all-splits/:id')
    async getAllWorkoutSplits(@Param('id', ParseIntPipe) planId:number){
        return this.workoutService.getAllWorkoutSplits(planId);
    }

    @Get('get-split/:planId/:splitId')
    async getWorkoutSplitById(@Param('planId', ParseIntPipe) planId : number, @Param('splitId', ParseIntPipe) splitId : number) {
        return this.workoutService.getWorkoutSplitById(planId, splitId);
    }

    @Patch('update/plan/:planId/split/:splitId')
    async updateWorkoutSplit(@Param('planId', ParseIntPipe) planId : number,@Param('splitId', ParseIntPipe) splitId : number, @Body() updateWorkoutSplitDto: updateWorkoutSplitDto ) {
        return this.workoutService.updateWorkoutSplit(planId, splitId,updateWorkoutSplitDto)
    }

    @Delete('delete/plan/:planId/split/:splitId')
    async deleteWorkoutSplit(@Param('planId', ParseIntPipe) planId : number,@Param('splitId', ParseIntPipe) splitId : number){
        return this.workoutService.deleteWorkoutSplit(planId, splitId);
    }
    @Post('add-split/:planId')
    async addSplitToPlan(@Param('planId',ParseIntPipe) planId : number, @Body() splitDto : CreateWorkoutSplitDto){
        return this.workoutService.addSplitToPlan(planId, splitDto);
    }

    //Exercises API
    @Post('create-exercise/:splitId')
    async createExercise(@Param('splitId', ParseIntPipe) splitId : number, @Body() createExercisesDto: ExerciseDto){
        return this.workoutService.createExercise(splitId, createExercisesDto);
    }
    @Patch('update-exercise/:id')
    async updateExercise(@Param('id', ParseIntPipe) exerciseId : number, @Body() updateExerciseDto : updateExerciseDto){
        return this.workoutService.updateExercise(exerciseId, updateExerciseDto);
    }

    @Delete('delete-exercise/:id')
    async deleteExercise(@Param('id', ParseIntPipe) exerciseId : number){
        return this.workoutService.deleteExercise(exerciseId);
    }
}
