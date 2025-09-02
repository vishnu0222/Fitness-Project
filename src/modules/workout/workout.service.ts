import { BadRequestException, HttpException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateWorkoutPlanDto } from './dto/create-workoutplan.dto';
import { updateWorkoutPlanDto } from './dto/update-workout-plan.dto';
import { CreateWorkoutSplitDto } from './dto/create-workout-split.dto';
import { connect } from 'http2';
import { updateWorkoutSplitDto } from './dto/update-workout-split.dto';
import { ExerciseDto } from './dto/exercises.dto';
import { updateExerciseDto } from './dto/update-exercise.dto';

@Injectable()
export class WorkoutService {
    constructor(private prismaService: PrismaService){}

    // Workout Plan API

    async createWorkoutPlan(userId : number, createWorkoutPlanDto : CreateWorkoutPlanDto) {
        try {
            let newWorkoutPlan : CreateWorkoutPlanDto;
            const planExists = await this.prismaService.workoutPlan.findFirst({
                where :{
                    title : createWorkoutPlanDto.title
                }
            })
            if(planExists) {
                return {message : "Plan name already exists, please try something new"};
            }
            if(!createWorkoutPlanDto.workoutSplits){
                newWorkoutPlan = await this.prismaService.workoutPlan.create({
                    data : {
                        title : createWorkoutPlanDto.title,
                        user : {connect:{id:userId}},
                    }
                })
            }
            else{
                newWorkoutPlan = await this.prismaService.workoutPlan.create({
                    data : {
                        title: createWorkoutPlanDto.title,
                        user: {connect:{id:userId}},
                        workoutSplits:{
                            create: createWorkoutPlanDto.workoutSplits.map(split=>({
                                workoutSplitName: split.workoutSplitName,
                                exercises:{
                                    create: split.exercises?.map(exercise=>({
                                        exerciseName: exercise.exerciseName,
                                        sets: exercise.sets,
                                    }))
                                }
                            }))
                        }
                    },
                    include: {
                        workoutSplits:{
                            include: {
                                exercises: true,
                            }
                        }
                    }
                })
            }
            
            return { message: 'Workout plan created successfully', workoutPlan: newWorkoutPlan };
        } catch (error) {
            throw new Error('Error creating workout plan');
        }
    }

    async getAllWorkoutPlans(userId: number){
        try {
            const getAllWorkoutPlans = await this.prismaService.workoutPlan.findMany({
                where:{
                    userId: userId
                },
                select: {
                    title: true,
                    workoutSplits:{
                        select:{
                            workoutSplitName: true,
                            exercises:{
                                select: {
                                    exerciseName: true,
                                    sets: true,
                                    createdAt: true,
                                }
                            }
                        }
                    },
                }
            })
            return { message: 'Workout plans retrieved successfully', workoutPlans: getAllWorkoutPlans };
        } catch (error) {
            throw new Error('Error retrieving workout plans');
        }
    }

    async getWorkoutPlanById(workoutPlanId: number) {
        try {
            const WorkoutplanById = await this.prismaService.workoutPlan.findUnique({
                where:{
                    id: workoutPlanId
                },
                select: {
                    title: true,
                    workoutSplits:{
                        select:{
                            workoutSplitName: true,
                            exercises:{
                                select: {
                                    exerciseName: true,
                                    sets: true,
                                    createdAt: true,
                                }
                            }
                        }
                    },
                }
            })
            return { message: 'Workout plan retrieved successfully', workoutPlan: WorkoutplanById };
        } catch (error) {
            throw new Error('Error retrieving workout plan by ID');
            
        }
    }

    async updateWorkoutPlan(planId: number, updateWorkoutPlanDto:updateWorkoutPlanDto){
        try {
            const workoutPlan = await this.prismaService.workoutPlan.findUnique({
                where: {
                    id: planId,
                },
            })
            if (!workoutPlan) {
                throw new BadRequestException('Workout plan not found');
            }
            const updateWorkoutPlan = await this.prismaService.workoutPlan.update({
                where:{
                    id: planId,
                },
                data:{
                    ...updateWorkoutPlanDto, 
                    updatedAt: new Date(),
                }
            })
            return {message : 'Workoutplan updated successfully', workoutPlan: updateWorkoutPlan}
        } catch (error) {
            throw new Error('Error updating workout plan');
        }
    }

    async deleteWorkoutPlan(planId: number){
        try {
            const workoutPlan = await this.prismaService.workoutPlan.findUnique({
                where: {
                    id: planId,
                },
            })
            if (!workoutPlan) {
                throw new BadRequestException('Workout plan not found');
            }
            const workoutPlanTitle = workoutPlan.title;
            const deleteWorkouPlan = await this.prismaService.workoutPlan.delete({
                where:{
                    id: planId
                }
            })
            return { message: `Workout plan '${workoutPlanTitle}' deleted successfully`};
        } catch (error) {
            if(error instanceof HttpException) {
                throw error;
            }
            throw new InternalServerErrorException('Error deleting workout plan');
        }
    }


    // Workout Split API
    async createWorkoutSplit(planId : number, createWorkoutSplitDto : CreateWorkoutSplitDto) {
        try {
            let newWorkoutSplit : CreateWorkoutSplitDto;
            const workoutPlan = await this.prismaService.workoutPlan.findUnique({
                where : {
                    id: planId,
                }
            })
            if(!workoutPlan) {
                throw new BadRequestException('Workout plan not found');
            }
            if(!createWorkoutSplitDto.exercises){
                newWorkoutSplit = await this.prismaService.workoutSplit.create({
                    data : {
                        workoutSplitName : createWorkoutSplitDto.workoutSplitName,
                        plan : {connect : {id : planId}},
                    }
                })
            }
            else {
                newWorkoutSplit = await this.prismaService.workoutSplit.create({
                    data: {
                        workoutSplitName: createWorkoutSplitDto.workoutSplitName,
                        plan : {connect : {id : planId}},
                        exercises:{
                            create: createWorkoutSplitDto.exercises?.map(exercise =>({
                                exerciseName : exercise.exerciseName,
                                sets : exercise.sets
                            }))
                        }
                    },
                    
                    include: {
                        plan: true,
                        exercises: true,
                    }
                })
            }
            const workoutSplitName = newWorkoutSplit.workoutSplitName;
            return { message: `Workout split '${workoutSplitName}' created successfully`, workoutSplit: newWorkoutSplit };
        } catch (error) {
            throw new Error('Error creating workout split');
        }
    }

    async getAllWorkoutSplits(planId: number) {
        try {
            const workoutPlan = await this.prismaService.workoutPlan.findUnique({
                where: {
                    id:planId
                }
            })
            if(!workoutPlan){
                throw new BadRequestException('Workout plan not found');
            }
            const allWorkoutSplits = await this.prismaService.workoutSplit.findMany({
                where:{
                    planId: planId,
                },
                select:{
                    workoutSplitName:true,
                    exercises:{
                        select:{
                            exerciseName: true,
                            sets: true,
                            createdAt: true,
                        }
                    }
                }
            })
            const workoutPlanTitle = workoutPlan.title;
            return { message: `All workout splits for plan '${workoutPlanTitle}' retrieved successfully`, workoutSplits: allWorkoutSplits };
        } catch (error) {
            
        }
    }
    async getWorkoutSplitById(planId: number, splitId: number) {
        try {
            const workoutPlan = await this.prismaService.workoutPlan.findUnique({
                where: {
                    id : planId
                }
            })
            if(!workoutPlan) {
                throw new BadRequestException('Workout plan not found');
            }
            const workoutSplit = await this.prismaService.workoutSplit.findUnique({
                where: {
                    id: splitId,
                }
            })
            if(!workoutSplit){
                throw new BadRequestException('Workout split not found');
            }
            return { message: 'Workout split retrieved successfully', workoutSplit: workoutSplit };
        } catch (error) {
            
        }
    }

    async updateWorkoutSplit(planId: number, splitId : number, updateWorkoutSplitDto: updateWorkoutSplitDto) {
        try {
            const workoutPlan = await this.prismaService.workoutPlan.findUnique({
                where: {
                    id : planId
                }
            })
            if(!workoutPlan) {
                throw new BadRequestException('Workout plan not found');
            }
            const workoutSplit = await this.prismaService.workoutSplit.findUnique({
                where: {
                    id: splitId,
                }
            })
            if(!workoutSplit){
                throw new BadRequestException('Workout split not found');
            }
            const updateWorkoutSplit = await this.prismaService.workoutSplit.update({
                where: {
                    id: splitId,
                },
                data:{
                    ...updateWorkoutSplitDto,
                    updatedAt: new Date(),
                }
            })
            const updatedWorkoutSplitName = updateWorkoutSplit.workoutSplitName;
            return {message : `Workout Split '${updatedWorkoutSplitName}' updated successfully`, workoutSplit: updateWorkoutSplit};
        } catch (error) {
            throw new Error('Error updating workout split');
        }
    }
    async deleteWorkoutSplit(planId: number, splitId : number){
        try {
            const workoutPlan = await this.prismaService.workoutPlan.findUnique({
                where: {
                    id : planId
                }
            })
            if(!workoutPlan) {
                throw new BadRequestException('Workout plan not found');
            }
            const workoutSplit = await this.prismaService.workoutSplit.findUnique({
                where: {
                    id: splitId,
                }
            })
            if(!workoutSplit){
                throw new BadRequestException('Workout split not found');
            }
            const workoutSplitName = workoutSplit.workoutSplitName;
            const deleteWorkoutSplit = await this.prismaService.workoutSplit.delete({
                where: {
                    id: splitId,
                }
            })
            return { message: `Workout split '${workoutSplitName}' deleted successfully` };
        } catch (error) {
            
        }
    }
    async addSplitToPlan(planId : number, splitDto : CreateWorkoutSplitDto){
        try {
            const planExists = await this.prismaService.workoutPlan.findUnique({
                where : {
                    id : planId
                }
            })
            if(!planExists) { 
                throw new BadRequestException('Workout plan does not exists');
            }
            const splitExists = await this.prismaService.workoutSplit.findFirst({
                where:{
                    planId: planId,
                    workoutSplitName: splitDto.workoutSplitName,
                }
            })
            if(splitExists){
                throw new BadRequestException("Split already exists");
            }
            const newWorkoutSplit = await this.prismaService.workoutSplit.create({
                data: {
                    workoutSplitName: splitDto.workoutSplitName,
                    plan : {connect : {id : planId}},
                    ...(splitDto.exercises?.length? {
                        exercises : {
                            create : splitDto.exercises.map((exercise) => ({
                                exerciseName : exercise.exerciseName,
                                sets : exercise.sets,
                            }))
                        },
                    }: {}),
                },
                select : {
                    id: true,
                    workoutSplitName : true,
                    plan: { select: { id: true, title: true } },
                    exercises: { select: { id: true, exerciseName: true, sets: true } },
                }
            })
            return{ message : 'New workout split added successfully', newWorkoutSplit};
        } catch (error) {
            throw new Error('Error while adding a new workout split');
        }
    }

    async createExercise(splitId : number, createExercisesDto : ExerciseDto){
        try {
            const splitExists = await this.prismaService.workoutSplit.findFirst({
                where : {
                    id : splitId,
                }
            })
            if(!splitExists) {
                throw new BadRequestException('split does not exists');
            }
            const newExercise = await this.prismaService.exercises.create({
                data :{
                    exerciseName : createExercisesDto.exerciseName,
                    split : {connect : {id : splitId}},
                    sets : createExercisesDto.sets
                }
            })
            return { message : 'New Exercise has been created', newExercise : newExercise};
        } catch (error) {
            throw new Error('Error while creating a new Exercise');
        }
    }
    async updateExercise(exerciseId : number, updateExerciseDto : updateExerciseDto){
        const exerciseExists = await this.prismaService.exercises.findFirst({
            where: {
                id : exerciseId,
            }
        })
        if(!exerciseExists) { 
            throw new BadRequestException('Exercise does not exists, try something else');
        }
        const updatedExercise = await this.prismaService.exercises.update({
            where : {
                id : exerciseId,
            },
            data : {
                ...(updateExerciseDto),
            }
        })
        return { message : 'Exercise has been updated', updatedExercise : updatedExercise};
    }
    async deleteExercise(exerciseId : number) {
        const exerciseExists = await this.prismaService.exercises.findFirst({
            where : {
                id : exerciseId,
            }
        })
        if(!exerciseExists) {
            throw new BadRequestException('Exercise does not exists');
        }
        const exerciseName = exerciseExists.exerciseName;
        await this.prismaService.exercises.delete({
            where : {
                id : exerciseId,
            }
        })
        return {message : `Exercise '${exerciseName}' has been deleted successfully`};
    }
}
