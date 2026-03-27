import {
    IsString,
    IsOptional,
    IsEnum,
    IsUUID,
    IsInt,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaskStatus } from '../../generated/prisma/client';

// ============================================================================
// CREATE TASK (DM or admin)
// ============================================================================

export class CreateTaskDto {
    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsUUID()
    groupId: string;

    @IsOptional()
    @IsUUID()
    assignedTo?: string;
}

// ============================================================================
// UPDATE TASK (DM or admin)
// ============================================================================

export class UpdateTaskDto {
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsUUID()
    assignedTo?: string;

    @IsOptional()
    @IsEnum(TaskStatus)
    status?: TaskStatus;
}

// ============================================================================
// UPDATE TASK STATUS (assigned user can close their task)
// ============================================================================

export class UpdateTaskStatusDto {
    @IsEnum(TaskStatus)
    status: TaskStatus;
}

// ============================================================================
// QUERY PARAMS
// ============================================================================

export class QueryTasksDto {
    @IsOptional()
    @IsUUID()
    groupId?: string;

    @IsOptional()
    @IsUUID()
    assignedTo?: string;

    @IsOptional()
    @IsEnum(TaskStatus)
    status?: TaskStatus;

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