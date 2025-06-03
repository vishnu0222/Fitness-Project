import { IsOptional, Max, Min } from "class-validator";

export class updateParticipationDto {

    @Min(0)
    @Max(100)
    progress : number;
}