import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
    CreateLeaveRequestDto,
    ReviewLeaveRequestDto,
    QueryLeavesDto,
    CalendarQueryDto,
    AdjustBalanceDto,
} from './dto/leave.dto';
import {
    GlobalRole,
    GroupRole,
    LeaveStatus,
    TimeSlot,
} from '../generated/prisma/client';

// ============================================================================
// TYPES
// ============================================================================

interface AuthenticatedUser {
    id: string;
    email: string;
    globalRole: GlobalRole;
}

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class LeavesService {
    private readonly logger = new Logger(LeavesService.name);

    constructor(private prisma: PrismaService) {}

    // ==========================================================================
    // CREATE LEAVE REQUEST
    // ==========================================================================

    async create(userId: string, dto: CreateLeaveRequestDto) {
        const startDate = new Date(dto.startDate);
        const endDate = new Date(dto.endDate);
        const timeSlot = dto.timeSlot || TimeSlot.FULL_DAY;

        // --- Validation ---

        if (endDate < startDate) {
            throw new BadRequestException('End date cannot be before start date');
        }

        // Half-day slots only make sense for single-day requests
        if (timeSlot !== TimeSlot.FULL_DAY) {
            const startStr = startDate.toISOString().split('T')[0];
            const endStr = endDate.toISOString().split('T')[0];
            if (startStr !== endStr) {
                throw new BadRequestException(
                    'Morning/Afternoon time slots can only be used for single-day requests',
                );
            }
        }

        // Verify leave type exists and is active
        const leaveType = await this.prisma.leaveType.findUnique({
            where: { id: dto.leaveTypeId },
        });

        if (!leaveType || !leaveType.isActive) {
            throw new BadRequestException('Invalid or inactive leave type');
        }

        // Check for overlapping requests on the same dates/slot
        await this.checkOverlap(userId, startDate, endDate, timeSlot);

        // Check balance if the leave type is deductible
        if (leaveType.isDeductible) {
            const daysRequested = this.calculateDays(startDate, endDate, timeSlot);
            const balance = await this.getOrCreateBalance(userId, startDate.getFullYear());
            const usedDays = await this.calculateUsedDays(userId, startDate.getFullYear());
            const pendingDays = await this.calculatePendingDays(userId, startDate.getFullYear());
            const available = balance.totalAllowance + balance.additionalDays - usedDays - pendingDays;

            if (daysRequested > available) {
                throw new BadRequestException(
                    `Insufficient leave balance. You have ${available} day(s) available but requested ${daysRequested} day(s).`,
                );
            }
        }

        // --- Create the request ---

        const leaveRequest = await this.prisma.leaveRequest.create({
            data: {
                userId,
                leaveTypeId: dto.leaveTypeId,
                startDate,
                endDate,
                timeSlot,
                notes: dto.notes || null,
                status: LeaveStatus.PENDING,
            },
            include: {
                leaveType: true,
                user: {
                    select: { id: true, name: true, surname: true, email: true },
                },
            },
        });

        // Notify DMs in user's groups and all admins
        await this.notifyReviewers(userId, leaveRequest.id);

        // Log activity
        await this.prisma.activityLog.create({
            data: {
                actorId: userId,
                action: 'leave_requested',
                targetType: 'leave_request',
                targetId: leaveRequest.id,
                metadata: {
                    leaveType: leaveType.name,
                    startDate: dto.startDate,
                    endDate: dto.endDate,
                    timeSlot,
                },
            },
        });

        this.logger.log(`Leave request created by user ${userId}`);

        return leaveRequest;
    }

    // ==========================================================================
    // REVIEW LEAVE REQUEST (approve/refuse)
    // ==========================================================================

    async review(
        reviewerId: string,
        reviewerRole: GlobalRole,
        leaveRequestId: string,
        dto: ReviewLeaveRequestDto,
    ) {
        if (dto.status === LeaveStatus.PENDING) {
            throw new BadRequestException('Cannot set status back to PENDING');
        }

        const leaveRequest = await this.prisma.leaveRequest.findUnique({
            where: { id: leaveRequestId },
            include: {
                user: {
                    select: { id: true, name: true, surname: true, email: true },
                },
                leaveType: true,
            },
        });

        if (!leaveRequest) {
            throw new NotFoundException('Leave request not found');
        }

        if (leaveRequest.status !== LeaveStatus.PENDING) {
            throw new BadRequestException(
                `This request has already been ${leaveRequest.status.toLowerCase()}`,
            );
        }

        // Cannot review your own request
        if (leaveRequest.userId === reviewerId && reviewerRole !== GlobalRole.ADMIN) {
            throw new ForbiddenException('You cannot review your own leave request');
        }

        // Permission check: admin can review any, DM can only review within their groups
        if (reviewerRole !== GlobalRole.ADMIN) {
            const canReview = await this.canDMReview(reviewerId, leaveRequest.userId);
            if (!canReview) {
                throw new ForbiddenException(
                    'You can only review leave requests from members of your group',
                );
            }
        }

        // If refusing, re-check nothing — balance is freed automatically since pending days won't count
        // If approving and deductible, verify balance once more (in case things changed)
        if (dto.status === LeaveStatus.ACCEPTED && leaveRequest.leaveType.isDeductible) {
            const daysRequested = this.calculateDays(
                leaveRequest.startDate,
                leaveRequest.endDate,
                leaveRequest.timeSlot,
            );
            const year = leaveRequest.startDate.getFullYear();
            const balance = await this.getOrCreateBalance(leaveRequest.userId, year);
            const usedDays = await this.calculateUsedDays(leaveRequest.userId, year);
            // Exclude this request from pending since it's about to be approved
            const pendingDays = await this.calculatePendingDays(
                leaveRequest.userId,
                year,
                leaveRequestId,
            );
            const available = balance.totalAllowance + balance.additionalDays - usedDays - pendingDays;

            if (daysRequested > available) {
                throw new BadRequestException(
                    `Cannot approve: user only has ${available} day(s) available but this request is for ${daysRequested} day(s).`,
                );
            }
        }

        const updated = await this.prisma.leaveRequest.update({
            where: { id: leaveRequestId },
            data: {
                status: dto.status,
                reviewedBy: reviewerId,
                reviewedAt: new Date(),
            },
            include: {
                leaveType: true,
                user: {
                    select: { id: true, name: true, surname: true, email: true },
                },
                reviewer: {
                    select: { id: true, name: true, surname: true },
                },
            },
        });

        // Notify the requesting user
        await this.prisma.notification.create({
            data: {
                recipientId: leaveRequest.userId,
                typeKey: dto.status === LeaveStatus.ACCEPTED ? 'leave_approved' : 'leave_refused',
                params: {
                    startDate: leaveRequest.startDate.toISOString().split('T')[0],
                    endDate: leaveRequest.endDate.toISOString().split('T')[0],
                    leaveType: leaveRequest.leaveType.name,
                },
                relatedType: 'leave_request',
                relatedId: leaveRequestId,
            },
        });

        // Log activity
        await this.prisma.activityLog.create({
            data: {
                actorId: reviewerId,
                action: dto.status === LeaveStatus.ACCEPTED ? 'leave_approved' : 'leave_refused',
                targetType: 'leave_request',
                targetId: leaveRequestId,
                metadata: {
                    userId: leaveRequest.userId,
                    leaveType: leaveRequest.leaveType.name,
                    notes: dto.notes,
                },
            },
        });

        this.logger.log(
            `Leave request ${leaveRequestId} ${dto.status.toLowerCase()} by ${reviewerId}`,
        );

        return updated;
    }

    // ==========================================================================
    // CANCEL LEAVE REQUEST (by the requesting user, only if still pending)
    // ==========================================================================

    async cancel(userId: string, leaveRequestId: string) {
        const leaveRequest = await this.prisma.leaveRequest.findUnique({
            where: { id: leaveRequestId },
        });

        if (!leaveRequest) {
            throw new NotFoundException('Leave request not found');
        }

        if (leaveRequest.userId !== userId) {
            throw new ForbiddenException('You can only cancel your own leave requests');
        }

        if (leaveRequest.status !== LeaveStatus.PENDING) {
            throw new BadRequestException(
                'Only pending leave requests can be cancelled',
            );
        }

        await this.prisma.leaveRequest.delete({
            where: { id: leaveRequestId },
        });

        await this.prisma.activityLog.create({
            data: {
                actorId: userId,
                action: 'leave_cancelled',
                targetType: 'leave_request',
                targetId: leaveRequestId,
            },
        });

        this.logger.log(`Leave request ${leaveRequestId} cancelled by user ${userId}`);

        return { message: 'Leave request has been cancelled' };
    }

    // ==========================================================================
    // FIND ALL (with filters and permission scoping)
    // ==========================================================================

    async findAll(query: QueryLeavesDto, currentUser: AuthenticatedUser) {
        const {
            userId,
            groupId,
            status,
            leaveTypeId,
            startDate,
            endDate,
            page = 1,
            limit = 20,
        } = query;

        const where: any = {};

        // Scope visibility based on role
        if (currentUser.globalRole === GlobalRole.ADMIN) {
            // Admin sees everything, optionally filtered
            if (userId) where.userId = userId;
        } else {
            if (userId && userId === currentUser.id) {
                // User viewing their own requests
                where.userId = currentUser.id;
            } else if (userId) {
                // Non-admin trying to view specific user — must share a group
                const sharedGroup = await this.shareGroup(currentUser.id, userId);
                if (!sharedGroup) {
                    throw new ForbiddenException('You can only view leave requests from your group members');
                }
                where.userId = userId;
            } else {
                // No userId filter: show own + group members' requests
                const groupMemberIds = await this.getGroupMemberIds(currentUser.id);
                where.userId = { in: groupMemberIds };
            }
        }

        if (groupId) {
            where.user = {
                groupMemberships: { some: { groupId } },
            };
        }

        if (status) where.status = status;
        if (leaveTypeId) where.leaveTypeId = leaveTypeId;

        if (startDate || endDate) {
            where.startDate = {};
            if (startDate) where.startDate.gte = new Date(startDate);
            if (endDate) where.endDate = { lte: new Date(endDate) };
        }

        const skip = (page - 1) * limit;

        const [requests, total] = await Promise.all([
            this.prisma.leaveRequest.findMany({
                where,
                include: {
                    leaveType: true,
                    user: {
                        select: { id: true, name: true, surname: true, email: true },
                    },
                    reviewer: {
                        select: { id: true, name: true, surname: true },
                    },
                    attachments: {
                        select: { id: true, fileName: true, fileSize: true, mimeType: true, uploadedAt: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.leaveRequest.count({ where }),
        ]);

        return {
            data: requests,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    // ==========================================================================
    // FIND ONE
    // ==========================================================================

    async findOne(leaveRequestId: string) {
        const request = await this.prisma.leaveRequest.findUnique({
            where: { id: leaveRequestId },
            include: {
                leaveType: true,
                user: {
                    select: { id: true, name: true, surname: true, email: true },
                },
                reviewer: {
                    select: { id: true, name: true, surname: true },
                },
                attachments: true,
            },
        });

        if (!request) {
            throw new NotFoundException('Leave request not found');
        }

        return request;
    }

    // ==========================================================================
    // PENDING REQUESTS FOR REVIEWER (DM sees their groups, admin sees all)
    // ==========================================================================

    async getPendingForReviewer(reviewerId: string, reviewerRole: GlobalRole) {
        let where: any = { status: LeaveStatus.PENDING };

        if (reviewerRole !== GlobalRole.ADMIN) {
            // DM: only pending requests from users in groups where reviewer is DM
            const dmGroups = await this.prisma.groupMembership.findMany({
                where: {
                    userId: reviewerId,
                    role: GroupRole.DEPARTMENT_MANAGER,
                },
                select: { groupId: true },
            });

            const groupIds = dmGroups.map((g) => g.groupId);

            if (groupIds.length === 0) {
                return [];
            }

            where.user = {
                groupMemberships: {
                    some: { groupId: { in: groupIds } },
                },
            };
            // Exclude reviewer's own requests
            where.userId = { not: reviewerId };
        }

        const requests = await this.prisma.leaveRequest.findMany({
            where,
            include: {
                leaveType: true,
                user: {
                    select: { id: true, name: true, surname: true, email: true },
                },
                attachments: {
                    select: { id: true, fileName: true },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        return requests;
    }

    // ==========================================================================
    // BULK REVIEW (admin-only — approve/refuse multiple at once)
    // ==========================================================================

    async bulkReview(
        adminId: string,
        leaveRequestIds: string[],
        status: LeaveStatus,
    ) {
        if (status === LeaveStatus.PENDING) {
            throw new BadRequestException('Cannot set status back to PENDING');
        }

        const results: { id: string; success: boolean; error?: string }[] = [];

        for (const id of leaveRequestIds) {
            try {
                await this.review(adminId, GlobalRole.ADMIN, id, { status });
                results.push({ id, success: true });
            } catch (error: any) {
                results.push({ id, success: false, error: error.message });
            }
        }

        return results;
    }

    // ==========================================================================
    // CALENDAR DATA (team view — who's off when)
    // ==========================================================================

    async getCalendar(query: CalendarQueryDto, currentUser: AuthenticatedUser) {
        const startDate = new Date(query.startDate);
        const endDate = new Date(query.endDate);

        const where: any = {
            status: LeaveStatus.ACCEPTED,
            startDate: { lte: endDate },
            endDate: { gte: startDate },
        };

        // Scope to specific group or user's groups
        if (query.groupId) {
            where.user = {
                groupMemberships: { some: { groupId: query.groupId } },
            };
        } else if (currentUser.globalRole !== GlobalRole.ADMIN) {
            const groupMemberIds = await this.getGroupMemberIds(currentUser.id);
            where.userId = { in: groupMemberIds };
        }

        const requests = await this.prisma.leaveRequest.findMany({
            where,
            select: {
                id: true,
                startDate: true,
                endDate: true,
                timeSlot: true,
                status: true,
                leaveType: {
                    select: { name: true, labelEn: true, labelFr: true, color: true },
                },
                user: {
                    select: { id: true, name: true, surname: true },
                },
            },
            orderBy: { startDate: 'asc' },
        });

        return requests;
    }

    // ==========================================================================
    // GET BALANCE (for a specific user and year)
    // ==========================================================================

    async getBalance(userId: string, year?: number) {
        const targetYear = year || new Date().getFullYear();

        const balance = await this.getOrCreateBalance(userId, targetYear);
        const usedDays = await this.calculateUsedDays(userId, targetYear);
        const pendingDays = await this.calculatePendingDays(userId, targetYear);

        return {
            year: targetYear,
            totalAllowance: balance.totalAllowance,
            additionalDays: balance.additionalDays,
            usedDays,
            pendingDays,
            availableDays: balance.totalAllowance + balance.additionalDays - usedDays,
            availableAfterPending: balance.totalAllowance + balance.additionalDays - usedDays - pendingDays,
        };
    }

    // ==========================================================================
    // ADJUST BALANCE (admin-only)
    // ==========================================================================

    async adjustBalance(
        adminId: string,
        userId: string,
        year: number,
        dto: AdjustBalanceDto,
    ) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user || user.isDeleted) {
            throw new NotFoundException('User not found');
        }

        const balance = await this.getOrCreateBalance(userId, year);

        const updated = await this.prisma.leaveBalance.update({
            where: { id: balance.id },
            data: {
                additionalDays: dto.additionalDays,
                adjustmentReason: dto.reason,
            },
        });

        // Notify the user
        await this.prisma.notification.create({
            data: {
                recipientId: userId,
                typeKey: 'balance_adjusted',
                params: {
                    year,
                    additionalDays: dto.additionalDays,
                    reason: dto.reason,
                },
                relatedType: 'leave_balance',
                relatedId: balance.id,
            },
        });

        await this.prisma.activityLog.create({
            data: {
                actorId: adminId,
                action: 'balance_adjusted',
                targetType: 'leave_balance',
                targetId: balance.id,
                metadata: {
                    userId,
                    year,
                    previousAdditionalDays: balance.additionalDays,
                    newAdditionalDays: dto.additionalDays,
                    reason: dto.reason,
                },
            },
        });

        this.logger.log(
            `Balance adjusted for user ${userId} (${year}): ${dto.additionalDays} additional days — ${dto.reason}`,
        );

        return this.getBalance(userId, year);
    }

    // ==========================================================================
    // PRIVATE HELPERS
    // ==========================================================================

    /**
     * Calculate number of leave days for a request.
     * Half-day slots count as 0.5 days.
     */
    private calculateDays(
        startDate: Date,
        endDate: Date,
        timeSlot: TimeSlot,
    ): number {
        if (timeSlot !== TimeSlot.FULL_DAY) {
            return 0.5;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        let days = 0;

        const current = new Date(start);
        while (current <= end) {
            const dayOfWeek = current.getDay();
            // Skip weekends (Saturday = 6, Sunday = 0)
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                days++;
            }
            current.setDate(current.getDate() + 1);
        }

        return days;
    }

    /**
     * Check for overlapping leave requests on the same dates/slot.
     */
    private async checkOverlap(
        userId: string,
        startDate: Date,
        endDate: Date,
        timeSlot: TimeSlot,
    ) {
        // Find any existing non-refused requests that overlap
        const overlapping = await this.prisma.leaveRequest.findMany({
            where: {
                userId,
                status: { not: LeaveStatus.REFUSED },
                startDate: { lte: endDate },
                endDate: { gte: startDate },
            },
        });

        for (const existing of overlapping) {
            // For single-day half-day requests, only conflict if same slot or one is full day
            if (timeSlot !== TimeSlot.FULL_DAY && existing.timeSlot !== TimeSlot.FULL_DAY) {
                // Both are half-day — only conflict if same slot
                if (timeSlot === existing.timeSlot) {
                    throw new BadRequestException(
                        'You already have a leave request for this time slot on this date',
                    );
                }
                // Different slots (morning vs afternoon) — allowed
                continue;
            }

            // One or both are full day — they conflict
            throw new BadRequestException(
                'You already have a leave request that overlaps with these dates',
            );
        }
    }

    /**
     * Get or create a leave balance for a user/year.
     */
    private async getOrCreateBalance(userId: string, year: number) {
        let balance = await this.prisma.leaveBalance.findUnique({
            where: { userId_year: { userId, year } },
        });

        if (!balance) {
            balance = await this.prisma.leaveBalance.create({
                data: {
                    userId,
                    year,
                    totalAllowance: 25,
                    additionalDays: 0,
                },
            });
        }

        return balance;
    }

    /**
     * Calculate total used (accepted) deductible days for a user in a given year.
     */
    private async calculateUsedDays(userId: string, year: number): Promise<number> {
        const acceptedRequests = await this.prisma.leaveRequest.findMany({
            where: {
                userId,
                status: LeaveStatus.ACCEPTED,
                startDate: {
                    gte: new Date(`${year}-01-01`),
                    lt: new Date(`${year + 1}-01-01`),
                },
                leaveType: { isDeductible: true },
            },
        });

        return acceptedRequests.reduce(
            (sum, req) => sum + this.calculateDays(req.startDate, req.endDate, req.timeSlot),
            0,
        );
    }

    /**
     * Calculate total pending deductible days for a user in a given year.
     * Optionally exclude a specific request (used during approval to avoid double-counting).
     */
    private async calculatePendingDays(
        userId: string,
        year: number,
        excludeRequestId?: string,
    ): Promise<number> {
        const where: any = {
            userId,
            status: LeaveStatus.PENDING,
            startDate: {
                gte: new Date(`${year}-01-01`),
                lt: new Date(`${year + 1}-01-01`),
            },
            leaveType: { isDeductible: true },
        };

        if (excludeRequestId) {
            where.id = { not: excludeRequestId };
        }

        const pendingRequests = await this.prisma.leaveRequest.findMany({ where });

        return pendingRequests.reduce(
            (sum, req) => sum + this.calculateDays(req.startDate, req.endDate, req.timeSlot),
            0,
        );
    }

    /**
     * Check if a DM can review a user's leave request.
     * DM must be in at least one group where the user is also a member.
     */
    private async canDMReview(dmId: string, userId: string): Promise<boolean> {
        const dmGroups = await this.prisma.groupMembership.findMany({
            where: {
                userId: dmId,
                role: GroupRole.DEPARTMENT_MANAGER,
            },
            select: { groupId: true },
        });

        const groupIds = dmGroups.map((g) => g.groupId);

        if (groupIds.length === 0) return false;

        const userInGroup = await this.prisma.groupMembership.findFirst({
            where: {
                userId,
                groupId: { in: groupIds },
            },
        });

        return !!userInGroup;
    }

    /**
     * Check if two users share at least one group.
     */
    private async shareGroup(userAId: string, userBId: string): Promise<boolean> {
        const userAGroups = await this.prisma.groupMembership.findMany({
            where: { userId: userAId },
            select: { groupId: true },
        });

        const groupIds = userAGroups.map((g) => g.groupId);

        if (groupIds.length === 0) return false;

        const shared = await this.prisma.groupMembership.findFirst({
            where: {
                userId: userBId,
                groupId: { in: groupIds },
            },
        });

        return !!shared;
    }

    /**
     * Get all user IDs that share a group with the given user (including self).
     */
    private async getGroupMemberIds(userId: string): Promise<string[]> {
        const userGroups = await this.prisma.groupMembership.findMany({
            where: { userId },
            select: { groupId: true },
        });

        const groupIds = userGroups.map((g) => g.groupId);

        if (groupIds.length === 0) return [userId];

        const memberships = await this.prisma.groupMembership.findMany({
            where: { groupId: { in: groupIds } },
            select: { userId: true },
        });

        const memberIds = [...new Set(memberships.map((m) => m.userId))];

        // Always include self
        if (!memberIds.includes(userId)) {
            memberIds.push(userId);
        }

        return memberIds;
    }

    /**
     * Notify all DMs in the requesting user's groups + all admins.
     */
    private async notifyReviewers(userId: string, leaveRequestId: string) {
        // Get user's groups
        const userGroups = await this.prisma.groupMembership.findMany({
            where: { userId },
            select: { groupId: true },
        });

        const groupIds = userGroups.map((g) => g.groupId);

        // Get DMs in those groups
        const dms = await this.prisma.groupMembership.findMany({
            where: {
                groupId: { in: groupIds },
                role: GroupRole.DEPARTMENT_MANAGER,
                userId: { not: userId },
            },
            select: { userId: true },
        });

        // Get all admins
        const admins = await this.prisma.user.findMany({
            where: {
                globalRole: GlobalRole.ADMIN,
                isActive: true,
                isDeleted: false,
                id: { not: userId },
            },
            select: { id: true },
        });

        // Deduplicate recipient IDs
        const recipientIds = [
            ...new Set([...dms.map((d) => d.userId), ...admins.map((a) => a.id)]),
        ];

        // Create notifications
        const notifications = recipientIds.map((recipientId) =>
            this.prisma.notification.create({
                data: {
                    recipientId,
                    typeKey: 'leave_submitted',
                    params: { userId },
                    relatedType: 'leave_request',
                    relatedId: leaveRequestId,
                },
            }),
        );

        await Promise.all(notifications);
    }
}