import {
    Controller,
    Post,
    Body,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { AuthService, AuthResponse, TokenPair } from './auth.service';
import {
    LoginDto,
    SetupPasswordDto,
    ForgotPasswordDto,
    ResetPasswordDto,
    RefreshTokenDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { GlobalRole } from '../generated/prisma/client';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) {}

    // ==========================================================================
    // POST /auth/login
    // ==========================================================================

    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(@Body() dto: LoginDto): Promise<AuthResponse> {
        return this.authService.login(dto);
    }

    // ==========================================================================
    // POST /auth/register (admin-only: creates user + sends invitation)
    // ==========================================================================

    @Post('register')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(GlobalRole.ADMIN)
    async register(
        @CurrentUser('id') adminId: string,
        @Body()
        body: {
            email: string;
            name: string;
            surname: string;
            phone?: string;
            birthday?: string;
            city?: string;
            address?: string;
            postalCode?: string;
            globalRole?: GlobalRole;
            language?: 'EN' | 'FR';
        },
    ): Promise<{ id: string; email: string }> {
        return this.authService.registerUser(adminId, {
            ...body,
            birthday: body.birthday ? new Date(body.birthday) : undefined,
        });
    }

    // ==========================================================================
    // POST /auth/setup-password (from invitation link)
    // ==========================================================================

    @Post('setup-password')
    @HttpCode(HttpStatus.OK)
    async setupPassword(@Body() dto: SetupPasswordDto): Promise<AuthResponse> {
        return this.authService.setupPassword(dto);
    }

    // ==========================================================================
    // POST /auth/forgot-password
    // ==========================================================================

    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
        return this.authService.forgotPassword(dto);
    }

    // ==========================================================================
    // POST /auth/reset-password (from reset link)
    // ==========================================================================

    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() dto: ResetPasswordDto): Promise<AuthResponse> {
        return this.authService.resetPassword(dto);
    }

    // ==========================================================================
    // POST /auth/refresh
    // ==========================================================================

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refresh(@Body() dto: RefreshTokenDto): Promise<TokenPair> {
        return this.authService.refreshToken(dto.refreshToken);
    }
}