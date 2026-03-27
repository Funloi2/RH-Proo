import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import {
    CreateGroupDto,
    UpdateGroupDto,
    AddMemberDto,
    UpdateMemberRoleDto,
    QueryGroupsDto,
} from './dto/group.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GlobalRole } from '../generated/prisma/client';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
    constructor(private groupsService: GroupsService) {}

    // ==========================================================================
    // GET /groups — list groups (admin sees all, others see their own)
    // ==========================================================================

    @Get()
    async findAll(
        @Query() query: QueryGroupsDto,
        @CurrentUser() user: { id: string; globalRole: GlobalRole },
    ) {
        const isAdmin = user.globalRole === GlobalRole.ADMIN;
        return this.groupsService.findAll(query, user.id, isAdmin);
    }

    // ==========================================================================
    // POST /groups — create group (admin-only)
    // ==========================================================================

    @Post()
    @UseGuards(RolesGuard)
    @Roles(GlobalRole.ADMIN)
    async create(
        @CurrentUser('id') adminId: string,
        @Body() dto: CreateGroupDto,
    ) {
        return this.groupsService.create(adminId, dto);
    }

    // ==========================================================================
    // GET /groups/:groupId — get group details
    // ==========================================================================

    @Get(':groupId')
    async findOne(@Param('groupId') groupId: string) {
        return this.groupsService.findOne(groupId);
    }

    // ==========================================================================
    // PATCH /groups/:groupId — update group (admin-only)
    // ==========================================================================

    @Patch(':groupId')
    @UseGuards(RolesGuard)
    @Roles(GlobalRole.ADMIN)
    async update(
        @CurrentUser('id') adminId: string,
        @Param('groupId') groupId: string,
        @Body() dto: UpdateGroupDto,
    ) {
        return this.groupsService.update(adminId, groupId, dto);
    }

    // ==========================================================================
    // DELETE /groups/:groupId — delete group (admin-only)
    // ==========================================================================

    @Delete(':groupId')
    @UseGuards(RolesGuard)
    @Roles(GlobalRole.ADMIN)
    async delete(
        @CurrentUser('id') adminId: string,
        @Param('groupId') groupId: string,
    ) {
        return this.groupsService.delete(adminId, groupId);
    }

    // ==========================================================================
    // GET /groups/:groupId/members — list group members
    // ==========================================================================

    @Get(':groupId/members')
    async getMembers(@Param('groupId') groupId: string) {
        return this.groupsService.getMembers(groupId);
    }

    // ==========================================================================
    // POST /groups/:groupId/members — add member (admin-only)
    // ==========================================================================

    @Post(':groupId/members')
    @UseGuards(RolesGuard)
    @Roles(GlobalRole.ADMIN)
    async addMember(
        @CurrentUser('id') adminId: string,
        @Param('groupId') groupId: string,
        @Body() dto: AddMemberDto,
    ) {
        return this.groupsService.addMember(adminId, groupId, dto);
    }

    // ==========================================================================
    // PATCH /groups/:groupId/members/:membershipId — update member role (admin-only)
    // ==========================================================================

    @Patch(':groupId/members/:membershipId')
    @UseGuards(RolesGuard)
    @Roles(GlobalRole.ADMIN)
    async updateMemberRole(
        @CurrentUser('id') adminId: string,
        @Param('groupId') groupId: string,
        @Param('membershipId') membershipId: string,
        @Body() dto: UpdateMemberRoleDto,
    ) {
        return this.groupsService.updateMemberRole(adminId, groupId, membershipId, dto);
    }

    // ==========================================================================
    // DELETE /groups/:groupId/members/:membershipId — remove member (admin-only)
    // ==========================================================================

    @Delete(':groupId/members/:membershipId')
    @UseGuards(RolesGuard)
    @Roles(GlobalRole.ADMIN)
    async removeMember(
        @CurrentUser('id') adminId: string,
        @Param('groupId') groupId: string,
        @Param('membershipId') membershipId: string,
    ) {
        return this.groupsService.removeMember(adminId, groupId, membershipId);
    }
}