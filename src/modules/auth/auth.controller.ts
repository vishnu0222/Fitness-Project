import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { signUpDto } from './dto/signUp.dto';
import { signInDto } from './dto/signIn.dto';

@Controller('auth')
export class AuthController {
    constructor(private authService : AuthService) {
    }

    @Post('signUp')
    signUp(@Body() signUpDto : signUpDto) {
        return this.authService.signUp(signUpDto);
    }
    @Post('signIn')
    signIn(@Body() signInDto : signInDto) {
        return this.authService.signIn(signInDto);
    }
}
