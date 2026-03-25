import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
    CreateLeaveTypeDto,
    UpdateLeaveTypeDto,
    QueryLeaveTypesDto,
} from './dto/leave-type.dto';

@Injectable()
export class LeaveTypesService {
    private readonly logger = new Logger(LeaveTypesService.name);

    constructor(private prisma: PrismaService) {}

    // ==========================================================================
    // CREATE (admin-only)
    // ==========================================================================

    async create(adminId: string, dto: CreateLeaveTypeDto) {
        // Check name uniqueness
        const existing = await this.prisma.leaveType.findUnique({
            where: { name: dto.name },
        });

        if (existing) {
            throw new ConflictException('A leave type with this name already exists');
        }

        // If no sortOrder provided, place it at the end
        if (dto.sortOrder === undefined) {
            const lastType = await this.prisma.leaveType.findFirst({
                orderBy: { sortOrder: 'desc' },
                select: { sortOrder: true },
            });
            dto.sortOrder = (lastType?.sortOrder ?? 0) + 1;
        }

        const leaveType = await this.prisma.leaveType.create({
            data: {
                name: dto.name,
                labelEn: dto.labelEn,
                labelFr: dto.labelFr,
                color: dto.color || '#3B82F6',
                isDeductible: dto.isDeductible ?? true,
                sortOrder: dto.sortOrder,
            },
        });

        await this.prisma.activityLog.create({
            data: {
                actorId: adminId,
                action: 'leave_type_created',
                targetType: 'leave_type',
                targetId: leaveType.id,
                metadata: { name: leaveType.name, labelEn: leaveType.labelEn, labelFr: leaveType.labelFr },
            },
        });

        this.logger.log(`Leave type "${leaveType.name}" created by admin ${adminId}`);

        return leaveType;
    }

    // ==========================================================================
    // FIND ALL (all authenticated users can see active types)
    // ==========================================================================

    async findAll(query: QueryLeaveTypesDto) {
        const { includeInactive = false } = query;

        const where: any = {};

        if (!includeInactive) {
            where.isActive = true;
        }

        const leaveTypes = await this.prisma.leaveType.findMany({
            where,
            orderBy: { sortOrder: 'asc' },
        });

        return leaveTypes;
    }

    // ==========================================================================
    // FIND ONE
    // ==========================================================================

    async findOne(id: string) {
        const leaveType = await this.prisma.leaveType.findUnique({
            where: { id },
        });

        if (!leaveType) {
            throw new NotFoundException('Leave type not found');
        }

        return leaveType;
    }

    // ==========================================================================
    // UPDATE (admin-only)
    // ==========================================================================

    async update(adminId: string, id: string, dto: UpdateLeaveTypeDto) {
        const leaveType = await this.prisma.leaveType.findUnique({
            where: { id },
        });

        if (!leaveType) {
            throw new NotFoundException('Leave type not found');
        }

        // Check name uniqueness if changing name
        if (dto.name && dto.name !== leaveType.name) {
            const nameExists = await this.prisma.leaveType.findUnique({
                where: { name: dto.name },
            });
            if (nameExists) {
                throw new ConflictException('A leave type with this name already exists');
            }
        }

        const updated = await this.prisma.leaveType.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.labelEn !== undefined && { labelEn: dto.labelEn }),
                ...(dto.labelFr !== undefined && { labelFr: dto.labelFr }),
                ...(dto.color !== undefined && { color: dto.color }),
                ...(dto.isDeductible !== undefined && { isDeductible: dto.isDeductible }),
                ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
        });

        await this.prisma.activityLog.create({
            data: {
                actorId: adminId,
                action: 'leave_type_updated',
                targetType: 'leave_type',
                targetId: id,
                metadata: { fields: Object.keys(dto) },
            },
        });

        this.logger.log(`Leave type "${updated.name}" updated by admin ${adminId}`);

        return updated;
    }

    // ==========================================================================
    // DEACTIVATE (admin-only — soft removal)
    // ==========================================================================

    async deactivate(adminId: string, id: string) {
        const leaveType = await this.prisma.leaveType.findUnique({
            where: { id },
        });

        if (!leaveType) {
            throw new NotFoundException('Leave type not found');
        }

        if (!leaveType.isActive) {
            throw new BadRequestException('Leave type is already inactive');
        }

        const updated = await this.prisma.leaveType.update({
            where: { id },
            data: { isActive: false },
        });

        await this.prisma.activityLog.create({
            data: {
                actorId: adminId,
                action: 'leave_type_deactivated',
                targetType: 'leave_type',
                targetId: id,
                metadata: { name: leaveType.name },
            },
        });

        this.logger.log(`Leave type "${leaveType.name}" deactivated by admin ${adminId}`);

        return updated;
    }

    // ==========================================================================
    // REACTIVATE (admin-only)
    // ==========================================================================

    async reactivate(adminId: string, id: string) {
        const leaveType = await this.prisma.leaveType.findUnique({
            where: { id },
        });

        if (!leaveType) {
            throw new NotFoundException('Leave type not found');
        }

        if (leaveType.isActive) {
            throw new BadRequestException('Leave type is already active');
        }

        const updated = await this.prisma.leaveType.update({
            where: { id },
            data: { isActive: true },
        });

        await this.prisma.activityLog.create({
            data: {
                actorId: adminId,
                action: 'leave_type_reactivated',
                targetType: 'leave_type',
                targetId: id,
                metadata: { name: leaveType.name },
            },
        });

        this.logger.log(`Leave type "${leaveType.name}" reactivated by admin ${adminId}`);

        return updated;
    }

    // ==========================================================================
    // REORDER (admin-only — update sort order for all types at once)
    // ==========================================================================

    async reorder(adminId: string, orderedIds: string[]) {
        // Verify all IDs exist
        const existingTypes = await this.prisma.leaveType.findMany({
            select: { id: true },
        });

        const existingIds = new Set(existingTypes.map((t) => t.id));
        const invalidIds = orderedIds.filter((id) => !existingIds.has(id));

        if (invalidIds.length > 0) {
            throw new BadRequestException(
                `Invalid leave type IDs: ${invalidIds.join(', ')}`,
            );
        }

        // Update sort order for each type
        const updates = orderedIds.map((id, index) =>
            this.prisma.leaveType.update({
                where: { id },
                data: { sortOrder: index + 1 },
            }),
        );

        await this.prisma.$transaction(updates);

        await this.prisma.activityLog.create({
            data: {
                actorId: adminId,
                action: 'leave_types_reordered',
                targetType: 'leave_type',
                metadata: { newOrder: orderedIds },
            },
        });

        this.logger.log(`Leave types reordered by admin ${adminId}`);

        return this.findAll({ includeInactive: true });
    }
}