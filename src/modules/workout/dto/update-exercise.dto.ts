import { IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class updateExerciseDto{
    @IsOptional()
    @IsString()
    exerciseName: string;

    @IsInt()
    @IsOptional()
    sets: number;
}