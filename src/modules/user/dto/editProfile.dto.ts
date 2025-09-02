import { IsOptional, IsString } from "class-validator"

export class editProfileDto {

    @IsString()
    @IsOptional()
    firstName : string
    
    @IsString()
    @IsOptional()
    lastName : string

    @IsOptional()
    email : string

}