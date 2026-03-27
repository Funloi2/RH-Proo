import {
    IsOptional,
    IsString,
    IsDateString,
    IsInt,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============================================================================
// QUERY ACTIVITY LOGS
// ============================================================================

export class QueryActivityLogsDto {
    @IsOptional()
    @IsString()
    actorId?: string;

    @IsOptional()
    @IsString()
    action?: string;

    @IsOptional()
    @IsString()
    targetType?: string;

    @IsOptional()
    @IsString()
    targetId?: string;

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
    limit?: number = 30;
}