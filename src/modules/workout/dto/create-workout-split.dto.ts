import { ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ExerciseDto } from "./exercises.dto";

export class CreateWorkoutSplitDto{
    @IsNotEmpty()
    @IsString()
    workoutSplitName: string;

    @IsArray()
    @IsOptional()
    exercises?: ExerciseDto[]

}