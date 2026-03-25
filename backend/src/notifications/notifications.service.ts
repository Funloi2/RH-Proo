import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryNotificationsDto } from './dto/notification.dto';

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);

    constructor(private prisma: PrismaService) {}

    // ==========================================================================
    // GET ALL NOTIFICATIONS (for current user, with pagination)
    // ==========================================================================

    async findAll(userId: string, query: QueryNotificationsDto) {
        const { unreadOnly = false, page = 1, limit = 20 } = query;

        const where: any = { recipientId: userId };

        if (unreadOnly) {
            where.isRead = false;
        }

        const skip = (page - 1) * limit;

        const [notifications, total] = await Promise.all([
            this.prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.notification.count({ where }),
        ]);

        return {
            data: notifications,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    // ==========================================================================
    // GET UNREAD COUNT
    // ==========================================================================

    async getUnreadCount(userId: string): Promise<{ count: number }> {
        const count = await this.prisma.notification.count({
            where: {
                recipientId: userId,
                isRead: false,
            },
        });

        return { count };
    }

    // ==========================================================================
    // MARK ONE AS READ
    // ==========================================================================

    async markAsRead(userId: string, notificationId: string) {
        const notification = await this.prisma.notification.findUnique({
            where: { id: notificationId },
        });

        if (!notification) {
            throw new NotFoundException('Notification not found');
        }

        if (notification.recipientId !== userId) {
            throw new ForbiddenException('You can only manage your own notifications');
        }

        if (notification.isRead) {
            return notification;
        }

        return this.prisma.notification.update({
            where: { id: notificationId },
            data: { isRead: true },
        });
    }

    // ==========================================================================
    // MARK ALL AS READ
    // ==========================================================================

    async markAllAsRead(userId: string): Promise<{ updated: number }> {
        const result = await this.prisma.notification.updateMany({
            where: {
                recipientId: userId,
                isRead: false,
            },
            data: { isRead: true },
        });

        this.logger.log(`Marked ${result.count} notifications as read for user ${userId}`);

        return { updated: result.count };
    }

    // ==========================================================================
    // DELETE ONE NOTIFICATION
    // ==========================================================================

    async delete(userId: string, notificationId: string) {
        const notification = await this.prisma.notification.findUnique({
            where: { id: notificationId },
        });

        if (!notification) {
            throw new NotFoundException('Notification not found');
        }

        if (notification.recipientId !== userId) {
            throw new ForbiddenException('You can only manage your own notifications');
        }

        await this.prisma.notification.delete({
            where: { id: notificationId },
        });

        return { message: 'Notification deleted' };
    }

    // ==========================================================================
    // DELETE ALL READ NOTIFICATIONS (cleanup)
    // ==========================================================================

    async deleteAllRead(userId: string): Promise<{ deleted: number }> {
        const result = await this.prisma.notification.deleteMany({
            where: {
                recipientId: userId,
                isRead: true,
            },
        });

        return { deleted: result.count };
    }
}