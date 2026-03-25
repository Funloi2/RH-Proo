import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GlobalRole, GroupRole } from '../../generated/prisma/enums';

/**
 * GroupRolesGuard checks whether the authenticated user is a
 * Department Manager in the group specified by :groupId param,
 * OR is a global ADMIN (who bypasses group-level checks).
 *
 * Usage: Apply to routes that have a :groupId route parameter.
 */
@Injectable()
export class GroupRolesGuard implements CanActivate {
    constructor(private prisma: PrismaService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new ForbiddenException('No user found in request');
        }

        // Global admins bypass group-level checks
        if (user.globalRole === GlobalRole.ADMIN) {
            return true;
        }

        // Extract groupId from route params, body, or query
        const groupId =
            request.params?.groupId ||
            request.body?.groupId ||
            request.query?.groupId;

        if (!groupId) {
            throw new ForbiddenException('No group specified');
        }

        // Check if user is a department manager in this group
        const membership = await this.prisma.groupMembership.findUnique({
            where: {
                userId_groupId: {
                    userId: user.id,
                    groupId: groupId,
                },
            },
        });

        if (!membership || membership.role !== GroupRole.DEPARTMENT_MANAGER) {
            throw new ForbiddenException(
                'You must be a Department Manager in this group to perform this action',
            );
        }

        return true;
    }
}