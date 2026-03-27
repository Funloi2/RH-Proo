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
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, AdminUpdateUserDto, QueryUsersDto } from './dto/user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GlobalRole } from '../generated/prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(private usersService: UsersService) {}

    // ==========================================================================
    // GET /users/me — current user's profile
    // ==========================================================================

    @Get('me')
    async getProfile(@CurrentUser('id') userId: string) {
        return this.usersService.getProfile(userId);
    }

    // ==========================================================================
    // PATCH /users/me — update own profile
    // ==========================================================================

    @Patch('me')
    async updateProfile(
        @CurrentUser('id') userId: string,
        @Body() dto: UpdateUserDto,
    ) {
        return this.usersService.updateSelf(userId, dto);
    }

    // ==========================================================================
    // GET /users — list all users (admin-only)
    // ==========================================================================

    @Get()
    @UseGuards(RolesGuard)
    @Roles(GlobalRole.ADMIN)
    async findAll(@Query() query: QueryUsersDto) {
        return this.usersService.findAll(query);
    }

    // ==========================================================================
    // POST /users — create user (admin-only, sends invitation)
    // ==========================================================================

    @Post()
    @UseGuards(RolesGuard)
    @Roles(GlobalRole.ADMIN)
    async create(
        @CurrentUser('id') adminId: string,
        @Body() dto: CreateUserDto,
    ) {
        return this.usersService.create(adminId, dto);
    }

    // ==========================================================================
    // GET /users/:id — get user by id (admin-only)
    // ==========================================================================

    @Get(':id')
    @UseGuards(RolesGuard)
    @Roles(GlobalRole.ADMIN)
    async findOne(@Param('id') id: string) {
        return this.usersService.findOne(id);
    }

    // ==========================================================================
    // PATCH /users/:id — admin update user
    // ==========================================================================

    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles(GlobalRole.ADMIN)
    async adminUpdate(
        @CurrentUser('id') adminId: string,
        @Param('id') userId: string,
        @Body() dto: AdminUpdateUserDto,
    ) {
        return this.usersService.adminUpdate(adminId, userId, dto);
    }

    // ==========================================================================
    // DELETE /users/:id — soft delete user (admin-only)
    // ==========================================================================

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(GlobalRole.ADMIN)
    async softDelete(
        @CurrentUser('id') adminId: string,
        @Param('id') userId: string,
    ) {
        return this.usersService.softDelete(adminId, userId);
    }

    // ==========================================================================
    // PATCH /users/:id/restore — restore soft-deleted user (admin-only)
    // ==========================================================================

    @Patch(':id/restore')
    @UseGuards(RolesGuard)
    @Roles(GlobalRole.ADMIN)
    async restore(
        @CurrentUser('id') adminId: string,
        @Param('id') userId: string,
    ) {
        return this.usersService.restore(adminId, userId);
    }
}