import { IsNotEmpty } from "class-validator";

export class updateWorkoutPlanDto {

    @IsNotEmpty()
    title: string;
}