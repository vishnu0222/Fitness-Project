import { IsInt, IsNotEmpty, IsString } from "class-validator";

export class ExerciseDto{
    @IsNotEmpty()
    @IsString()
    exerciseName: string;

    @IsInt()
    @IsNotEmpty()
    sets: number;
}