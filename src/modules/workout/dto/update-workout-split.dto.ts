import { IsNotEmpty, IsString } from "class-validator";

export class updateWorkoutSplitDto{

    @IsString()
    @IsNotEmpty()
    workoutSplitName: string;
}