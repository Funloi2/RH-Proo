import {
    Controller,
    Get,
    Post,
    Patch,
    Body,
    Param,
    Query,
    UseGuards,
} from '@nestjs/common';
import { LeaveTypesService } from './leave-types.service';
import {
    CreateLeaveTypeDto,
    UpdateLeaveTypeDto,
    QueryLeaveTypesDto,
} from './dto/leave-type.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GlobalRole } from '../generated/prisma/client';

@Controller('leave-types')
@UseGuards(JwtAuthGuard)
export class LeaveTypesController {
    constructor(private leaveTypesService: LeaveTypesService) {}

    // ==========================================================================
    // GET /leave-types — list all active leave types (all users)
    // ==========================================================================

    @Get()
    async findAll(@Query() query: QueryLeaveTypesDto) {
        return this.leaveTypesService.findAll(query);
    }

    // ==========================================================================
    // POST /leave-types — create leave type (admin-only)
    // ==========================================================================

    @Post()
    @UseGuards(RolesGuard)
    @Roles(GlobalRole.ADMIN)
    async create(
        @CurrentUser('id') adminId: string,
        @Body() dto: CreateLeaveTypeDto,
    ) {
        return this.leaveTypesService.create(adminId, dto);
    }

    // ==========================================================================
    // GET /leave-types/:id — get one leave type
    // ==========================================================================

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.leaveTypesService.findOne(id);
    }

    // ==========================================================================
    // PATCH /leave-types/:id — update leave type (admin-only)
    // ==========================================================================

    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles(GlobalRole.ADMIN)
    async update(
        @CurrentUser('id') adminId: string,
        @Param('id') id: string,
        @Body() dto: UpdateLeaveTypeDto,
    ) {
        return this.leaveTypesService.update(adminId, id, dto);
    }

    // ==========================================================================
    // PATCH /leave-types/:id/deactivate — soft remove (admin-only)
    // ==========================================================================

    @Patch(':id/deactivate')
    @UseGuards(RolesGuard)
    @Roles(GlobalRole.ADMIN)
    async deactivate(
        @CurrentUser('id') adminId: string,
        @Param('id') id: string,
    ) {
        return this.leaveTypesService.deactivate(adminId, id);
    }

    // ==========================================================================
    // PATCH /leave-types/:id/reactivate — restore (admin-only)
    // ==========================================================================

    @Patch(':id/reactivate')
    @UseGuards(RolesGuard)
    @Roles(GlobalRole.ADMIN)
    async reactivate(
        @CurrentUser('id') adminId: string,
        @Param('id') id: string,
    ) {
        return this.leaveTypesService.reactivate(adminId, id);
    }

    // ==========================================================================
    // POST /leave-types/reorder — reorder all types (admin-only)
    // ==========================================================================

    @Post('reorder')
    @UseGuards(RolesGuard)
    @Roles(GlobalRole.ADMIN)
    async reorder(
        @CurrentUser('id') adminId: string,
        @Body() body: { orderedIds: string[] },
    ) {
        return this.leaveTypesService.reorder(adminId, body.orderedIds);
    }
}