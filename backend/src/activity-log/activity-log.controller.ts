import {
    Controller,
    Get,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { QueryActivityLogsDto } from './dto/activity-log.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GlobalRole } from '../generated/prisma/client';

@Controller('activity-log')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(GlobalRole.ADMIN)
export class ActivityLogController {
    constructor(private activityLogService: ActivityLogService) {}

    // ==========================================================================
    // GET /activity-log — list activity logs with filters
    // ==========================================================================

    @Get()
    async findAll(@Query() query: QueryActivityLogsDto) {
        return this.activityLogService.findAll(query);
    }

    // ==========================================================================
    // GET /activity-log/actions — list distinct action types (for filter dropdown)
    // ==========================================================================

    @Get('actions')
    async getActionTypes() {
        return this.activityLogService.getActionTypes();
    }

    // ==========================================================================
    // GET /activity-log/summary — activity summary for dashboard
    // ==========================================================================

    @Get('summary')
    async getSummary(@Query('days') days?: string) {
        return this.activityLogService.getSummary(
            days ? parseInt(days, 10) : 30,
        );
    }

    // ==========================================================================
    // POST /activity-log/archive — manually trigger archive + cleanup
    // ==========================================================================

    @Post('archive')
    async triggerArchive() {
        return this.activityLogService.triggerArchive();
    }
}