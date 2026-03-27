import {
    IsString,
    IsOptional,
    IsEnum,
    IsUUID,
    IsInt,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GroupRole } from '../../generated/prisma/client';

// ============================================================================
// CREATE GROUP (admin-only)
// ============================================================================

export class CreateGroupDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;
}

// ============================================================================
// UPDATE GROUP (admin-only)
// ============================================================================

export class UpdateGroupDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;
}

// ============================================================================
// ADD MEMBER TO GROUP (admin-only)
// ============================================================================

export class AddMemberDto {
    @IsUUID()
    userId: string;

    @IsOptional()
    @IsEnum(GroupRole)
    role?: GroupRole;
}

// ============================================================================
// UPDATE MEMBER ROLE (admin-only)
// ============================================================================

export class UpdateMemberRoleDto {
    @IsEnum(GroupRole)
    role: GroupRole;
}

// ============================================================================
// QUERY PARAMS (for listing groups)
// ============================================================================

export class QueryGroupsDto {
    @IsOptional()
    @IsString()
    search?: string;

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