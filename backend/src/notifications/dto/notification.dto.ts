import {
    IsOptional,
    IsBoolean,
    IsInt,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============================================================================
// QUERY NOTIFICATIONS
// ============================================================================

export class QueryNotificationsDto {
    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    unreadOnly?: boolean;

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