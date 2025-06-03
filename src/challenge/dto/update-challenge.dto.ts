import { IsOptional, IsString } from "class-validator"

export class updateChallengeDto {

    @IsString()
    @IsOptional()
    title : string

    @IsString()
    @IsOptional()
    description : string

    @IsString()
    @IsOptional()
    startDate : string

    @IsString()
    @IsOptional()
    endDate : string

    @IsString()
    @IsOptional()
    image : string
}