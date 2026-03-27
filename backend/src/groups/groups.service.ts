import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
    CreateGroupDto,
    UpdateGroupDto,
    AddMemberDto,
    UpdateMemberRoleDto,
    QueryGroupsDto,
} from './dto/group.dto';
import { GroupRole } from '../generated/prisma/client';

@Injectable()
export class GroupsService {
    private readonly logger = new Logger(GroupsService.name);

    constructor(private prisma: PrismaService) {}

    // ==========================================================================
    // CREATE GROUP (admin-only)
    // ==========================================================================

    async create(adminId: string, dto: CreateGroupDto) {
        const existing = await this.prisma.group.findUnique({
            where: { name: dto.name },
        });

        if (existing) {
            throw new ConflictException('A group with this name already exists');
        }

        const group = await this.prisma.group.create({
            data: {
                name: dto.name,
                description: dto.description || null,
            },
        });

        await this.prisma.activityLog.create({
            data: {
                actorId: adminId,
                action: 'group_created',
                targetType: 'group',
                targetId: group.id,
                metadata: { name: group.name },
            },
        });

        this.logger.log(`Group "${group.name}" created by admin ${adminId}`);

        return group;
    }

    // ==========================================================================
    // FIND ALL GROUPS (admin sees all, DM/user sees their own)
    // ==========================================================================

    async findAll(query: QueryGroupsDto, userId?: string, isAdmin?: boolean) {
        const { search, page = 1, limit = 20 } = query;

        const where: any = {};

        // Non-admin users only see groups they belong to
        if (!isAdmin && userId) {
            where.members = {
                some: { userId },
            };
        }

        if (search) {
            where.name = { contains: search, mode: 'insensitive' };
        }

        const skip = (page - 1) * limit;

        const [groups, total] = await Promise.all([
            this.prisma.group.findMany({
                where,
                include: {
                    members: {
                        select: {
                            id: true,
                            role: true,
                            joinedAt: true,
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    surname: true,
                                    email: true,
                                    isActive: true,
                                },
                            },
                        },
                    },
                    _count: {
                        select: { members: true, tasks: true },
                    },
                },
                orderBy: { name: 'asc' },
                skip,
                take: limit,
            }),
            this.prisma.group.count({ where }),
        ]);

        return {
            data: groups,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    // ==========================================================================
    // FIND ONE GROUP
    // ==========================================================================

    async findOne(groupId: string) {
        const group = await this.prisma.group.findUnique({
            where: { id: groupId },
            include: {
                members: {
                    select: {
                        id: true,
                        role: true,
                        joinedAt: true,
                        user: {
                            select: {
                                id: true,
                                name: true,
                                surname: true,
                                email: true,
                                isActive: true,
                                isDeleted: true,
                            },
                        },
                    },
                    orderBy: { role: 'asc' }, // DMs first, then members
                },
                _count: {
                    select: { members: true, tasks: true },
                },
            },
        });

        if (!group) {
            throw new NotFoundException('Group not found');
        }

        return group;
    }

    // ==========================================================================
    // UPDATE GROUP (admin-only)
    // ==========================================================================

    async update(adminId: string, groupId: string, dto: UpdateGroupDto) {
        const group = await this.prisma.group.findUnique({
            where: { id: groupId },
        });

        if (!group) {
            throw new NotFoundException('Group not found');
        }

        // Check name uniqueness if changing name
        if (dto.name && dto.name !== group.name) {
            const nameExists = await this.prisma.group.findUnique({
                where: { name: dto.name },
            });
            if (nameExists) {
                throw new ConflictException('A group with this name already exists');
            }
        }

        const updated = await this.prisma.group.update({
            where: { id: groupId },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.description !== undefined && { description: dto.description }),
            },
        });

        await this.prisma.activityLog.create({
            data: {
                actorId: adminId,
                action: 'group_updated',
                targetType: 'group',
                targetId: groupId,
                metadata: { fields: Object.keys(dto) },
            },
        });

        return updated;
    }

    // ==========================================================================
    // DELETE GROUP (admin-only)
    // ==========================================================================

    async delete(adminId: string, groupId: string) {
        const group = await this.prisma.group.findUnique({
            where: { id: groupId },
            include: { _count: { select: { members: true } } },
        });

        if (!group) {
            throw new NotFoundException('Group not found');
        }

        if (group._count.members > 0) {
            throw new BadRequestException(
                'Cannot delete a group that still has members. Remove all members first.',
            );
        }

        await this.prisma.group.delete({
            where: { id: groupId },
        });

        await this.prisma.activityLog.create({
            data: {
                actorId: adminId,
                action: 'group_deleted',
                targetType: 'group',
                targetId: groupId,
                metadata: { name: group.name },
            },
        });

        this.logger.log(`Group "${group.name}" deleted by admin ${adminId}`);

        return { message: 'Group has been deleted' };
    }

    // ==========================================================================
    // ADD MEMBER (admin-only)
    // ==========================================================================

    async addMember(adminId: string, groupId: string, dto: AddMemberDto) {
        // Verify group exists
        const group = await this.prisma.group.findUnique({
            where: { id: groupId },
        });

        if (!group) {
            throw new NotFoundException('Group not found');
        }

        // Verify user exists and is active
        const user = await this.prisma.user.findUnique({
            where: { id: dto.userId },
        });

        if (!user || user.isDeleted) {
            throw new NotFoundException('User not found');
        }

        if (!user.isActive) {
            throw new BadRequestException('Cannot add an inactive user to a group');
        }

        // Check if already a member
        const existing = await this.prisma.groupMembership.findUnique({
            where: {
                userId_groupId: {
                    userId: dto.userId,
                    groupId,
                },
            },
        });

        if (existing) {
            throw new ConflictException('User is already a member of this group');
        }

        const membership = await this.prisma.groupMembership.create({
            data: {
                userId: dto.userId,
                groupId,
                role: dto.role || GroupRole.MEMBER,
            },
            include: {
                user: {
                    select: { id: true, name: true, surname: true, email: true },
                },
                group: {
                    select: { id: true, name: true },
                },
            },
        });

        // Create notification for the added user
        await this.prisma.notification.create({
            data: {
                recipientId: dto.userId,
                typeKey: 'added_to_group',
                params: { groupName: group.name },
                relatedType: 'group',
                relatedId: groupId,
            },
        });

        await this.prisma.activityLog.create({
            data: {
                actorId: adminId,
                action: 'member_added',
                targetType: 'group_membership',
                targetId: membership.id,
                metadata: {
                    userId: dto.userId,
                    groupId,
                    groupName: group.name,
                    userName: `${user.name} ${user.surname}`,
                    role: dto.role || GroupRole.MEMBER,
                },
            },
        });

        this.logger.log(
            `User ${dto.userId} added to group "${group.name}" by admin ${adminId}`,
        );

        return membership;
    }

    // ==========================================================================
    // UPDATE MEMBER ROLE (admin-only)
    // ==========================================================================

    async updateMemberRole(
        adminId: string,
        groupId: string,
        membershipId: string,
        dto: UpdateMemberRoleDto,
    ) {
        const membership = await this.prisma.groupMembership.findUnique({
            where: { id: membershipId },
            include: {
                user: { select: { id: true, name: true, surname: true } },
                group: { select: { id: true, name: true } },
            },
        });

        if (!membership || membership.groupId !== groupId) {
            throw new NotFoundException('Membership not found in this group');
        }

        const updated = await this.prisma.groupMembership.update({
            where: { id: membershipId },
            data: { role: dto.role },
            include: {
                user: {
                    select: { id: true, name: true, surname: true, email: true },
                },
                group: {
                    select: { id: true, name: true },
                },
            },
        });

        // Notify the user about role change
        await this.prisma.notification.create({
            data: {
                recipientId: membership.userId,
                typeKey: 'role_changed',
                params: {
                    groupName: membership.group.name,
                    newRole: dto.role,
                },
                relatedType: 'group',
                relatedId: groupId,
            },
        });

        await this.prisma.activityLog.create({
            data: {
                actorId: adminId,
                action: 'member_role_updated',
                targetType: 'group_membership',
                targetId: membershipId,
                metadata: {
                    userId: membership.userId,
                    groupId,
                    previousRole: membership.role,
                    newRole: dto.role,
                },
            },
        });

        this.logger.log(
            `Role updated to ${dto.role} for user ${membership.userId} in group "${membership.group.name}"`,
        );

        return updated;
    }

    // ==========================================================================
    // REMOVE MEMBER (admin-only)
    // ==========================================================================

    async removeMember(adminId: string, groupId: string, membershipId: string) {
        const membership = await this.prisma.groupMembership.findUnique({
            where: { id: membershipId },
            include: {
                user: { select: { id: true, name: true, surname: true } },
                group: { select: { id: true, name: true } },
            },
        });

        if (!membership || membership.groupId !== groupId) {
            throw new NotFoundException('Membership not found in this group');
        }

        await this.prisma.groupMembership.delete({
            where: { id: membershipId },
        });

        // Notify the removed user
        await this.prisma.notification.create({
            data: {
                recipientId: membership.userId,
                typeKey: 'removed_from_group',
                params: { groupName: membership.group.name },
                relatedType: 'group',
                relatedId: groupId,
            },
        });

        await this.prisma.activityLog.create({
            data: {
                actorId: adminId,
                action: 'member_removed',
                targetType: 'group_membership',
                targetId: membershipId,
                metadata: {
                    userId: membership.userId,
                    groupId,
                    groupName: membership.group.name,
                    userName: `${membership.user.name} ${membership.user.surname}`,
                },
            },
        });

        this.logger.log(
            `User ${membership.userId} removed from group "${membership.group.name}" by admin ${adminId}`,
        );

        return { message: 'Member has been removed from the group' };
    }

    // ==========================================================================
    // GET GROUP MEMBERS (accessible by group members)
    // ==========================================================================

    async getMembers(groupId: string) {
        const group = await this.prisma.group.findUnique({
            where: { id: groupId },
        });

        if (!group) {
            throw new NotFoundException('Group not found');
        }

        const members = await this.prisma.groupMembership.findMany({
            where: { groupId },
            select: {
                id: true,
                role: true,
                joinedAt: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        surname: true,
                        email: true,
                        isActive: true,
                    },
                },
            },
            orderBy: { role: 'asc' },
        });

        return members;
    }
}