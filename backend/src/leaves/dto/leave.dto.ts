import {
    IsString,
    IsOptional,
    IsEnum,
    IsUUID,
    IsDateString,
    IsInt,
    IsNumber,
    Min,
    IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TimeSlot, LeaveStatus } from '../../generated/prisma/client';

// ============================================================================
// CREATE LEAVE REQUEST
// ============================================================================

export class CreateLeaveRequestDto {
    @IsUUID()
    leaveTypeId: string;

    @IsDateString()
    startDate: string;

    @IsDateString()
    endDate: string;

    @IsOptional()
    @IsEnum(TimeSlot)
    timeSlot?: TimeSlot;

    @IsOptional()
    @IsString()
    notes?: string;
}

// ============================================================================
// REVIEW LEAVE REQUEST (approve/refuse — DM or admin)
// ============================================================================

export class ReviewLeaveRequestDto {
    @IsEnum(LeaveStatus, {
        message: 'Status must be either ACCEPTED or REFUSED',
    })
    status: LeaveStatus;

    @IsOptional()
    @IsString()
    notes?: string;
}

// ============================================================================
// QUERY LEAVE REQUESTS
// ============================================================================

export class QueryLeavesDto {
    @IsOptional()
    @IsUUID()
    userId?: string;

    @IsOptional()
    @IsUUID()
    groupId?: string;

    @IsOptional()
    @IsEnum(LeaveStatus)
    status?: LeaveStatus;

    @IsOptional()
    @IsUUID()
    leaveTypeId?: string;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;

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

// ============================================================================
// CALENDAR QUERY (for team calendar view)
// ============================================================================

export class CalendarQueryDto {
    @IsDateString()
    startDate: string;

    @IsDateString()
    endDate: string;

    @IsOptional()
    @IsUUID()
    groupId?: string;
}

// ============================================================================
// ADJUST LEAVE BALANCE (admin-only)
// ============================================================================

export class AdjustBalanceDto {
    @IsNumber()
    additionalDays: number;

    @IsString()
    reason: string;
}