import {
    IsString,
    IsOptional,
    IsBoolean,
    IsInt,
    Min,
    Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============================================================================
// CREATE LEAVE TYPE (admin-only)
// ============================================================================

export class CreateLeaveTypeDto {
    @IsString()
    name: string;

    @IsString()
    labelEn: string;

    @IsString()
    labelFr: string;

    @IsOptional()
    @IsString()
    @Matches(/^#[0-9A-Fa-f]{6}$/, {
        message: 'Color must be a valid hex color (e.g. #3B82F6)',
    })
    color?: string;

    @IsOptional()
    @IsBoolean()
    isDeductible?: boolean;

    @IsOptional()
    @IsInt()
    @Min(0)
    sortOrder?: number;
}

// ============================================================================
// UPDATE LEAVE TYPE (admin-only)
// ============================================================================

export class UpdateLeaveTypeDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    labelEn?: string;

    @IsOptional()
    @IsString()
    labelFr?: string;

    @IsOptional()
    @IsString()
    @Matches(/^#[0-9A-Fa-f]{6}$/, {
        message: 'Color must be a valid hex color (e.g. #3B82F6)',
    })
    color?: string;

    @IsOptional()
    @IsBoolean()
    isDeductible?: boolean;

    @IsOptional()
    @IsInt()
    @Min(0)
    sortOrder?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

// ============================================================================
// QUERY PARAMS
// ============================================================================

export class QueryLeaveTypesDto {
    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    includeInactive?: boolean;
}