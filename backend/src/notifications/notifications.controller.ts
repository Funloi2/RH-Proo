import {
    Controller,
    Get,
    Patch,
    Delete,
    Param,
    Query,
    UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto/notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private notificationsService: NotificationsService) {}

    // ==========================================================================
    // GET /notifications — list notifications for current user
    // ==========================================================================

    @Get()
    async findAll(
        @CurrentUser('id') userId: string,
        @Query() query: QueryNotificationsDto,
    ) {
        return this.notificationsService.findAll(userId, query);
    }

    // ==========================================================================
    // GET /notifications/unread-count — get unread notification count
    // ==========================================================================

    @Get('unread-count')
    async getUnreadCount(@CurrentUser('id') userId: string) {
        return this.notificationsService.getUnreadCount(userId);
    }

    // ==========================================================================
    // PATCH /notifications/read-all — mark all as read
    // ==========================================================================

    @Patch('read-all')
    async markAllAsRead(@CurrentUser('id') userId: string) {
        return this.notificationsService.markAllAsRead(userId);
    }

    // ==========================================================================
    // DELETE /notifications/clear-read — delete all read notifications
    // ==========================================================================

    @Delete('clear-read')
    async deleteAllRead(@CurrentUser('id') userId: string) {
        return this.notificationsService.deleteAllRead(userId);
    }

    // ==========================================================================
    // PATCH /notifications/:id/read — mark one as read
    // ==========================================================================

    @Patch(':id/read')
    async markAsRead(
        @CurrentUser('id') userId: string,
        @Param('id') id: string,
    ) {
        return this.notificationsService.markAsRead(userId, id);
    }

    // ==========================================================================
    // DELETE /notifications/:id — delete one notification
    // ==========================================================================

    @Delete(':id')
    async delete(
        @CurrentUser('id') userId: string,
        @Param('id') id: string,
    ) {
        return this.notificationsService.delete(userId, id);
    }
}