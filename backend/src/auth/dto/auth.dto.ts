import {
    IsEmail,
    IsNotEmpty,
    IsString,
    MinLength,
    Matches,
} from 'class-validator';

// ============================================================================
// LOGIN
// ============================================================================

export class LoginDto {
    @IsEmail()
    email: string;

    @IsString()
    @IsNotEmpty()
    password: string;
}

// ============================================================================
// PASSWORD SETUP (invitation flow) & PASSWORD RESET
// ============================================================================

export class SetupPasswordDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @MinLength(12, { message: 'Password must be at least 12 characters long' })
    @Matches(/[A-Z]/, {
        message: 'Password must contain at least one uppercase letter',
    })
    @Matches(/[0-9]/, {
        message: 'Password must contain at least one number',
    })
    password: string;
}

export class ForgotPasswordDto {
    @IsEmail()
    email: string;
}

export class ResetPasswordDto {
    @IsString()
    @IsNotEmpty()
    token: string;

    @IsString()
    @MinLength(12, { message: 'Password must be at least 12 characters long' })
    @Matches(/[A-Z]/, {
        message: 'Password must contain at least one uppercase letter',
    })
    @Matches(/[0-9]/, {
        message: 'Password must contain at least one number',
    })
    password: string;
}

// ============================================================================
// REFRESH TOKEN
// ============================================================================

export class RefreshTokenDto {
    @IsString()
    @IsNotEmpty()
    refreshToken: string;
}