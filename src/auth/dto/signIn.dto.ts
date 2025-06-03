import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class signInDto {

    @IsString()
    @IsNotEmpty()
    email : string
    
    @IsNotEmpty()
    @IsString()
    password : string
    
}