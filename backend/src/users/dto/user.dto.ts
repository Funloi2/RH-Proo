import {
    IsEmail,
    IsString,
    IsOptional,
    IsEnum,
    IsDateString,
    IsBoolean,
    IsInt,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GlobalRole, Language } from '../../generated/prisma/client';

// ============================================================================
// CREATE USER (admin-only)
// ============================================================================

export class CreateUserDto {
    @IsString()
    name: string;

    @IsString()
    surname: string;

    @IsEmail()
    email: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsDateString()
    birthday?: string;

    @IsOptional()
    @IsString()
    city?: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @IsString()
    postalCode?: string;

    @IsOptional()
    @IsEnum(GlobalRole)
    globalRole?: GlobalRole;

    @IsOptional()
    @IsEnum(Language)
    language?: Language;
}

// ============================================================================
// UPDATE USER (admin or self)
// ============================================================================

export class UpdateUserDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    surname?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsDateString()
    birthday?: string;

    @IsOptional()
    @IsString()
    city?: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @IsString()
    postalCode?: string;

    @IsOptional()
    @IsEnum(Language)
    language?: Language;
}

// ============================================================================
// ADMIN UPDATE USER (admin-only fields like role, active status)
// ============================================================================

export class AdminUpdateUserDto extends UpdateUserDto {
    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsEnum(GlobalRole)
    globalRole?: GlobalRole;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

// ============================================================================
// QUERY PARAMS (for listing/filtering users)
// ============================================================================

export class QueryUsersDto {
    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsEnum(GlobalRole)
    globalRole?: GlobalRole;

    @IsOptional()
    @IsString()
    groupId?: string;

    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    isActive?: boolean;

    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    includeDeleted?: boolean;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Type(() => Number)
    page?: number = 1;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Type(() => Number)
    limit?: number = 20;
}