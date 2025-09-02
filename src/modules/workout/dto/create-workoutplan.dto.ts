import { ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { CreateWorkoutSplitDto } from "./create-workout-split.dto";

export class CreateWorkoutPlanDto {

    @IsNotEmpty()
    @IsString()
    title: string
    
    @IsOptional()
    @IsArray()
    workoutSplits?: CreateWorkoutSplitDto[];
}