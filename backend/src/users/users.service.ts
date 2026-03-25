import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import {
    CreateUserDto,
    UpdateUserDto,
    AdminUpdateUserDto,
    QueryUsersDto,
} from './dto/user.dto';
import { GlobalRole } from '../generated/prisma/client';

// ============================================================================
// TYPES
// ============================================================================

// Fields we never expose to the client
const SAFE_USER_SELECT = {
    id: true,
    name: true,
    surname: true,
    email: true,
    phone: true,
    birthday: true,
    city: true,
    address: true,
    postalCode: true,
    globalRole: true,
    language: true,
    isActive: true,
    isDeleted: true,
    createdAt: true,
    updatedAt: true,
} as const;

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class UsersService {
    private readonly logger = new Logger(UsersService.name);

    constructor(
        private prisma: PrismaService,
        private authService: AuthService,
    ) {}

    // ==========================================================================
    // CREATE USER (admin-only — delegates to AuthService for invitation flow)
    // ==========================================================================

    async create(adminId: string, dto: CreateUserDto) {
        return this.authService.registerUser(adminId, {
            email: dto.email,
            name: dto.name,
            surname: dto.surname,
            phone: dto.phone,
            birthday: dto.birthday ? new Date(dto.birthday) : undefined,
            city: dto.city,
            address: dto.address,
            postalCode: dto.postalCode,
            globalRole: dto.globalRole,
            language: dto.language,
        });
    }

    // ==========================================================================
    // FIND ALL (with filtering, search, pagination)
    // ==========================================================================

    async findAll(query: QueryUsersDto) {
        const {
            search,
            globalRole,
            groupId,
            isActive,
            includeDeleted = false,
            page = 1,
            limit = 20,
        } = query;

        const where: any = {};

        // By default, exclude soft-deleted users
        if (!includeDeleted) {
            where.isDeleted = false;
        }

        // Filter by active status
        if (isActive !== undefined) {
            where.isActive = isActive;
        }

        // Filter by global role
        if (globalRole) {
            where.globalRole = globalRole;
        }

        // Filter by group membership
        if (groupId) {
            where.groupMemberships = {
                some: { groupId },
            };
        }

        // Search by name, surname, or email
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { surname: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                select: {
                    ...SAFE_USER_SELECT,
                    groupMemberships: {
                        select: {
                            id: true,
                            role: true,
                            group: {
                                select: { id: true, name: true },
                            },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.user.count({ where }),
        ]);

        return {
            data: users,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    // ==========================================================================
    // FIND ONE BY ID
    // ==========================================================================

    async findOne(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                ...SAFE_USER_SELECT,
                groupMemberships: {
                    select: {
                        id: true,
                        role: true,
                        joinedAt: true,
                        group: {
                            select: { id: true, name: true },
                        },
                    },
                },
            },
        });

        if (!user || user.isDeleted) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    // ==========================================================================
    // GET CURRENT USER PROFILE
    // ==========================================================================

    async getProfile(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                ...SAFE_USER_SELECT,
                groupMemberships: {
                    select: {
                        id: true,
                        role: true,
                        joinedAt: true,
                        group: {
                            select: { id: true, name: true },
                        },
                    },
                },
                leaveBalances: {
                    where: { year: new Date().getFullYear() },
                    select: {
                        year: true,
                        totalAllowance: true,
                        additionalDays: true,
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    // ==========================================================================
    // UPDATE (self — user can update their own profile)
    // ==========================================================================

    async updateSelf(userId: string, dto: UpdateUserDto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user || user.isDeleted) {
            throw new NotFoundException('User not found');
        }

        const updated = await this.prisma.user.update({
            where: { id: userId },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.surname !== undefined && { surname: dto.surname }),
                ...(dto.phone !== undefined && { phone: dto.phone }),
                ...(dto.birthday !== undefined && { birthday: new Date(dto.birthday) }),
                ...(dto.city !== undefined && { city: dto.city }),
                ...(dto.address !== undefined && { address: dto.address }),
                ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
                ...(dto.language !== undefined && { language: dto.language }),
            },
            select: SAFE_USER_SELECT,
        });

        // Log activity
        await this.prisma.activityLog.create({
            data: {
                actorId: userId,
                action: 'profile_updated',
                targetType: 'user',
                targetId: userId,
                metadata: { fields: Object.keys(dto) },
            },
        });

        return updated;
    }

    // ==========================================================================
    // UPDATE (admin — can update any user including role and status)
    // ==========================================================================

    async adminUpdate(adminId: string, userId: string, dto: AdminUpdateUserDto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user || user.isDeleted) {
            throw new NotFoundException('User not found');
        }

        const updated = await this.prisma.user.update({
            where: { id: userId },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.surname !== undefined && { surname: dto.surname }),
                ...(dto.email !== undefined && { email: dto.email.toLowerCase() }),
                ...(dto.phone !== undefined && { phone: dto.phone }),
                ...(dto.birthday !== undefined && { birthday: new Date(dto.birthday) }),
                ...(dto.city !== undefined && { city: dto.city }),
                ...(dto.address !== undefined && { address: dto.address }),
                ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
                ...(dto.language !== undefined && { language: dto.language }),
                ...(dto.globalRole !== undefined && { globalRole: dto.globalRole }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
            select: SAFE_USER_SELECT,
        });

        // Log activity
        await this.prisma.activityLog.create({
            data: {
                actorId: adminId,
                action: 'user_updated',
                targetType: 'user',
                targetId: userId,
                metadata: { fields: Object.keys(dto) },
            },
        });

        this.logger.log(`User ${userId} updated by admin ${adminId}`);

        return updated;
    }

    // ==========================================================================
    // SOFT DELETE (admin-only)
    // ==========================================================================

    async softDelete(adminId: string, userId: string) {
        if (adminId === userId) {
            throw new ForbiddenException('You cannot delete your own account');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.isDeleted) {
            throw new NotFoundException('User is already deleted');
        }

        await this.prisma.user.update({
            where: { id: userId },
            data: {
                isDeleted: true,
                isActive: false,
            },
        });

        // Log activity
        await this.prisma.activityLog.create({
            data: {
                actorId: adminId,
                action: 'user_deleted',
                targetType: 'user',
                targetId: userId,
                metadata: { email: user.email, name: user.name, surname: user.surname },
            },
        });

        this.logger.log(`User ${userId} (${user.email}) soft-deleted by admin ${adminId}`);

        return { message: 'User has been deleted' };
    }

    // ==========================================================================
    // RESTORE (admin-only — undo soft delete)
    // ==========================================================================

    async restore(adminId: string, userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (!user.isDeleted) {
            throw new NotFoundException('User is not deleted');
        }

        await this.prisma.user.update({
            where: { id: userId },
            data: {
                isDeleted: false,
                isActive: true,
            },
        });

        // Log activity
        await this.prisma.activityLog.create({
            data: {
                actorId: adminId,
                action: 'user_restored',
                targetType: 'user',
                targetId: userId,
                metadata: { email: user.email },
            },
        });

        this.logger.log(`User ${userId} (${user.email}) restored by admin ${adminId}`);

        return { message: 'User has been restored' };
    }
}