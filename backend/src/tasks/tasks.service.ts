import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
    CreateTaskDto,
    UpdateTaskDto,
    UpdateTaskStatusDto,
    QueryTasksDto,
} from './dto/task.dto';
import { GlobalRole, GroupRole, TaskStatus } from '../generated/prisma/client';

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
export class TasksService {
    private readonly logger = new Logger(TasksService.name);

    constructor(private prisma: PrismaService) {}

    // ==========================================================================
    // CREATE TASK (DM in the group or admin)
    // ==========================================================================

    async create(currentUser: AuthenticatedUser, dto: CreateTaskDto) {
        // Verify group exists
        const group = await this.prisma.group.findUnique({
            where: { id: dto.groupId },
        });

        if (!group) {
            throw new NotFoundException('Group not found');
        }

        // Permission check: must be DM in this group or admin
        await this.assertCanManageGroupTasks(currentUser, dto.groupId);

        // If assigning to someone, verify they are a member of the group
        if (dto.assignedTo) {
            await this.assertUserInGroup(dto.assignedTo, dto.groupId);
        }

        const task = await this.prisma.task.create({
            data: {
                title: dto.title,
                description: dto.description || null,
                groupId: dto.groupId,
                createdBy: currentUser.id,
                assignedTo: dto.assignedTo || null,
                status: TaskStatus.OPEN,
            },
            include: {
                group: { select: { id: true, name: true } },
                creator: { select: { id: true, name: true, surname: true } },
                assignee: { select: { id: true, name: true, surname: true, email: true } },
            },
        });

        // Notify assignee if assigned
        if (dto.assignedTo) {
            await this.prisma.notification.create({
                data: {
                    recipientId: dto.assignedTo,
                    typeKey: 'task_assigned',
                    params: {
                        taskTitle: task.title,
                        groupName: group.name,
                    },
                    relatedType: 'task',
                    relatedId: task.id,
                },
            });
        }

        // Log activity
        await this.prisma.activityLog.create({
            data: {
                actorId: currentUser.id,
                action: 'task_created',
                targetType: 'task',
                targetId: task.id,
                metadata: {
                    title: task.title,
                    groupId: dto.groupId,
                    groupName: group.name,
                    assignedTo: dto.assignedTo,
                },
            },
        });

        this.logger.log(`Task "${task.title}" created in group "${group.name}"`);

        return task;
    }

    // ==========================================================================
    // FIND ALL (scoped by role and group membership)
    // ==========================================================================

    async findAll(query: QueryTasksDto, currentUser: AuthenticatedUser) {
        const { groupId, assignedTo, status, page = 1, limit = 20 } = query;

        const where: any = {};

        if (currentUser.globalRole === GlobalRole.ADMIN) {
            // Admin sees all, optionally filtered
            if (groupId) where.groupId = groupId;
            if (assignedTo) where.assignedTo = assignedTo;
        } else {
            // Non-admin: only see tasks from groups they belong to
            const userGroups = await this.prisma.groupMembership.findMany({
                where: { userId: currentUser.id },
                select: { groupId: true },
            });

            const groupIds = userGroups.map((g) => g.groupId);

            if (groupIds.length === 0) {
                return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
            }

            where.groupId = groupId
                ? { in: groupIds.includes(groupId) ? [groupId] : [] }
                : { in: groupIds };

            if (assignedTo) where.assignedTo = assignedTo;
        }

        if (status) where.status = status;

        const skip = (page - 1) * limit;

        const [tasks, total] = await Promise.all([
            this.prisma.task.findMany({
                where,
                include: {
                    group: { select: { id: true, name: true } },
                    creator: { select: { id: true, name: true, surname: true } },
                    assignee: { select: { id: true, name: true, surname: true, email: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.task.count({ where }),
        ]);

        return {
            data: tasks,
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

    async findOne(taskId: string) {
        const task = await this.prisma.task.findUnique({
            where: { id: taskId },
            include: {
                group: { select: { id: true, name: true } },
                creator: { select: { id: true, name: true, surname: true } },
                assignee: { select: { id: true, name: true, surname: true, email: true } },
            },
        });

        if (!task) {
            throw new NotFoundException('Task not found');
        }

        return task;
    }

    // ==========================================================================
    // UPDATE TASK (DM in the group or admin)
    // ==========================================================================

    async update(
        currentUser: AuthenticatedUser,
        taskId: string,
        dto: UpdateTaskDto,
    ) {
        const task = await this.prisma.task.findUnique({
            where: { id: taskId },
            include: { group: { select: { id: true, name: true } } },
        });

        if (!task) {
            throw new NotFoundException('Task not found');
        }

        // Permission: must be DM in the task's group or admin
        await this.assertCanManageGroupTasks(currentUser, task.groupId);

        // If reassigning, verify the new assignee is in the group
        if (dto.assignedTo) {
            await this.assertUserInGroup(dto.assignedTo, task.groupId);
        }

        const previousAssignee = task.assignedTo;

        const updated = await this.prisma.task.update({
            where: { id: taskId },
            data: {
                ...(dto.title !== undefined && { title: dto.title }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.assignedTo !== undefined && { assignedTo: dto.assignedTo }),
                ...(dto.status !== undefined && { status: dto.status }),
            },
            include: {
                group: { select: { id: true, name: true } },
                creator: { select: { id: true, name: true, surname: true } },
                assignee: { select: { id: true, name: true, surname: true, email: true } },
            },
        });

        // Notify new assignee if assignment changed
        if (dto.assignedTo && dto.assignedTo !== previousAssignee) {
            await this.prisma.notification.create({
                data: {
                    recipientId: dto.assignedTo,
                    typeKey: 'task_assigned',
                    params: {
                        taskTitle: updated.title,
                        groupName: task.group.name,
                    },
                    relatedType: 'task',
                    relatedId: taskId,
                },
            });
        }

        // Log activity
        await this.prisma.activityLog.create({
            data: {
                actorId: currentUser.id,
                action: 'task_updated',
                targetType: 'task',
                targetId: taskId,
                metadata: { fields: Object.keys(dto) },
            },
        });

        return updated;
    }

    // ==========================================================================
    // UPDATE STATUS (assigned user can update their own task status)
    // ==========================================================================

    async updateStatus(
        currentUser: AuthenticatedUser,
        taskId: string,
        dto: UpdateTaskStatusDto,
    ) {
        const task = await this.prisma.task.findUnique({
            where: { id: taskId },
            include: { group: { select: { id: true, name: true } } },
        });

        if (!task) {
            throw new NotFoundException('Task not found');
        }

        // Permission: assigned user, DM in the group, or admin
        const isAssignee = task.assignedTo === currentUser.id;
        const isAdmin = currentUser.globalRole === GlobalRole.ADMIN;

        if (!isAssignee && !isAdmin) {
            const isDM = await this.isDMInGroup(currentUser.id, task.groupId);
            if (!isDM) {
                throw new ForbiddenException(
                    'Only the assigned user, a DM in this group, or an admin can update task status',
                );
            }
        }

        const previousStatus = task.status;

        const updated = await this.prisma.task.update({
            where: { id: taskId },
            data: { status: dto.status },
            include: {
                group: { select: { id: true, name: true } },
                creator: { select: { id: true, name: true, surname: true } },
                assignee: { select: { id: true, name: true, surname: true, email: true } },
            },
        });

        // If task was closed by assignee, notify the creator
        if (dto.status === TaskStatus.CLOSED && isAssignee && task.createdBy !== currentUser.id) {
            await this.prisma.notification.create({
                data: {
                    recipientId: task.createdBy,
                    typeKey: 'task_closed',
                    params: {
                        taskTitle: task.title,
                        closedBy: currentUser.id,
                    },
                    relatedType: 'task',
                    relatedId: taskId,
                },
            });
        }

        // Log activity
        await this.prisma.activityLog.create({
            data: {
                actorId: currentUser.id,
                action: dto.status === TaskStatus.CLOSED ? 'task_closed' : 'task_status_updated',
                targetType: 'task',
                targetId: taskId,
                metadata: {
                    previousStatus,
                    newStatus: dto.status,
                },
            },
        });

        this.logger.log(`Task ${taskId} status: ${previousStatus} → ${dto.status}`);

        return updated;
    }

    // ==========================================================================
    // DELETE TASK (DM in the group or admin)
    // ==========================================================================

    async delete(currentUser: AuthenticatedUser, taskId: string) {
        const task = await this.prisma.task.findUnique({
            where: { id: taskId },
            include: { group: { select: { id: true, name: true } } },
        });

        if (!task) {
            throw new NotFoundException('Task not found');
        }

        await this.assertCanManageGroupTasks(currentUser, task.groupId);

        await this.prisma.task.delete({
            where: { id: taskId },
        });

        await this.prisma.activityLog.create({
            data: {
                actorId: currentUser.id,
                action: 'task_deleted',
                targetType: 'task',
                targetId: taskId,
                metadata: {
                    title: task.title,
                    groupName: task.group.name,
                },
            },
        });

        this.logger.log(`Task "${task.title}" deleted from group "${task.group.name}"`);

        return { message: 'Task has been deleted' };
    }

    // ==========================================================================
    // PRIVATE HELPERS
    // ==========================================================================

    /**
     * Assert the current user can manage tasks in a group (is DM or admin).
     */
    private async assertCanManageGroupTasks(
        user: AuthenticatedUser,
        groupId: string,
    ) {
        if (user.globalRole === GlobalRole.ADMIN) return;

        const isDM = await this.isDMInGroup(user.id, groupId);
        if (!isDM) {
            throw new ForbiddenException(
                'You must be a Department Manager in this group or an admin to manage tasks',
            );
        }
    }

    /**
     * Check if a user is a DM in a specific group.
     */
    private async isDMInGroup(userId: string, groupId: string): Promise<boolean> {
        const membership = await this.prisma.groupMembership.findUnique({
            where: {
                userId_groupId: { userId, groupId },
            },
        });

        return membership?.role === GroupRole.DEPARTMENT_MANAGER;
    }

    /**
     * Assert a user is a member of a group.
     */
    private async assertUserInGroup(userId: string, groupId: string) {
        const membership = await this.prisma.groupMembership.findUnique({
            where: {
                userId_groupId: { userId, groupId },
            },
        });

        if (!membership) {
            throw new BadRequestException(
                'The assigned user must be a member of the task group',
            );
        }
    }
}