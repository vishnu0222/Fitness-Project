import { IsOptional, IsString } from "class-validator";
import { signInDto } from "./signIn.dto";

export class signUpDto extends signInDto {

    @IsString()
    @IsOptional()
    firstName : string
    
    @IsString()
    @IsOptional()
    lastName : string
}