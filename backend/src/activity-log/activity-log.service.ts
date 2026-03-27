import {
    Injectable,
    Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { QueryActivityLogsDto } from './dto/activity-log.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ActivityLogService {
    private readonly logger = new Logger(ActivityLogService.name);
    private readonly archiveDir = path.join(process.cwd(), 'logs', 'activity-archive');

    constructor(private prisma: PrismaService) {
        // Ensure archive directory exists
        if (!fs.existsSync(this.archiveDir)) {
            fs.mkdirSync(this.archiveDir, { recursive: true });
        }
    }

    // ==========================================================================
    // FIND ALL (admin-only, with filtering)
    // ==========================================================================

    async findAll(query: QueryActivityLogsDto) {
        const {
            actorId,
            action,
            targetType,
            targetId,
            startDate,
            endDate,
            page = 1,
            limit = 30,
        } = query;

        const where: any = {};

        if (actorId) where.actorId = actorId;
        if (action) where.action = action;
        if (targetType) where.targetType = targetType;
        if (targetId) where.targetId = targetId;

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            this.prisma.activityLog.findMany({
                where,
                include: {
                    actor: {
                        select: { id: true, name: true, surname: true, email: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.activityLog.count({ where }),
        ]);

        return {
            data: logs,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    // ==========================================================================
    // GET DISTINCT ACTION TYPES (for filter dropdown in frontend)
    // ==========================================================================

    async getActionTypes(): Promise<string[]> {
        const results = await this.prisma.activityLog.findMany({
            distinct: ['action'],
            select: { action: true },
            orderBy: { action: 'asc' },
        });

        return results.map((r) => r.action);
    }

    // ==========================================================================
    // GET ACTIVITY SUMMARY (counts per action type, for dashboard)
    // ==========================================================================

    async getSummary(days: number = 30) {
        const since = new Date();
        since.setDate(since.getDate() - days);

        const logs = await this.prisma.activityLog.groupBy({
            by: ['action'],
            where: {
                createdAt: { gte: since },
            },
            _count: { action: true },
            orderBy: { _count: { action: 'desc' } },
        });

        const totalCount = await this.prisma.activityLog.count({
            where: { createdAt: { gte: since } },
        });

        return {
            period: `${days} days`,
            since: since.toISOString(),
            totalActivities: totalCount,
            byAction: logs.map((l) => ({
                action: l.action,
                count: l._count.action,
            })),
        };
    }

    // ==========================================================================
    // ARCHIVE & CLEANUP (runs every day at 2 AM)
    // ==========================================================================

    @Cron(CronExpression.EVERY_DAY_AT_2AM)
    async archiveOldEntries() {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        this.logger.log('Starting activity log archive process...');

        // Fetch old entries (IDs only — no PII)
        const oldEntries = await this.prisma.activityLog.findMany({
            where: {
                createdAt: { lt: oneYearAgo },
            },
            select: {
                id: true,
                actorId: true,
                action: true,
                targetType: true,
                targetId: true,
                createdAt: true,
                // NO metadata — could contain names/emails
                // NO actor relation — would expose PII
            },
        });

        if (oldEntries.length === 0) {
            this.logger.log('No activity logs older than 1 year. Nothing to archive.');
            return;
        }

        // Write to archive file
        const timestamp = new Date().toISOString().split('T')[0];
        const fileName = `activity-archive-${timestamp}.log`;
        const filePath = path.join(this.archiveDir, fileName);

        const lines = oldEntries.map((entry) =>
            JSON.stringify({
                id: entry.id,
                actorId: entry.actorId,
                action: entry.action,
                targetType: entry.targetType,
                targetId: entry.targetId,
                createdAt: entry.createdAt.toISOString(),
            }),
        );

        fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');

        this.logger.log(
            `Archived ${oldEntries.length} activity log entries to ${fileName}`,
        );

        // Delete archived entries from database
        const deleteResult = await this.prisma.activityLog.deleteMany({
            where: {
                createdAt: { lt: oneYearAgo },
            },
        });

        this.logger.log(
            `Deleted ${deleteResult.count} archived activity log entries from database`,
        );
    }

    // ==========================================================================
    // MANUAL ARCHIVE TRIGGER (admin can trigger from the UI)
    // ==========================================================================

    async triggerArchive(): Promise<{ archived: number; fileName: string | null }> {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const count = await this.prisma.activityLog.count({
            where: { createdAt: { lt: oneYearAgo } },
        });

        if (count === 0) {
            return { archived: 0, fileName: null };
        }

        await this.archiveOldEntries();

        const timestamp = new Date().toISOString().split('T')[0];
        const fileName = `activity-archive-${timestamp}.log`;

        return { archived: count, fileName };
    }
}