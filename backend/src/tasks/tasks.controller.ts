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
import { TasksService } from './tasks.service';
import {
    CreateTaskDto,
    UpdateTaskDto,
    UpdateTaskStatusDto,
    QueryTasksDto,
} from './dto/task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GlobalRole } from '../generated/prisma/client';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
    constructor(private tasksService: TasksService) {}

    // ==========================================================================
    // GET /tasks — list tasks (scoped by group membership)
    // ==========================================================================

    @Get()
    async findAll(
        @Query() query: QueryTasksDto,
        @CurrentUser() user: { id: string; email: string; globalRole: GlobalRole },
    ) {
        return this.tasksService.findAll(query, user);
    }

    // ==========================================================================
    // POST /tasks — create task (DM or admin)
    // ==========================================================================

    @Post()
    async create(
        @CurrentUser() user: { id: string; email: string; globalRole: GlobalRole },
        @Body() dto: CreateTaskDto,
    ) {
        return this.tasksService.create(user, dto);
    }

    // ==========================================================================
    // GET /tasks/:id — get task details
    // ==========================================================================

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.tasksService.findOne(id);
    }

    // ==========================================================================
    // PATCH /tasks/:id — update task (DM or admin)
    // ==========================================================================

    @Patch(':id')
    async update(
        @CurrentUser() user: { id: string; email: string; globalRole: GlobalRole },
        @Param('id') id: string,
        @Body() dto: UpdateTaskDto,
    ) {
        return this.tasksService.update(user, id, dto);
    }

    // ==========================================================================
    // PATCH /tasks/:id/status — update task status (assignee, DM, or admin)
    // ==========================================================================

    @Patch(':id/status')
    async updateStatus(
        @CurrentUser() user: { id: string; email: string; globalRole: GlobalRole },
        @Param('id') id: string,
        @Body() dto: UpdateTaskStatusDto,
    ) {
        return this.tasksService.updateStatus(user, id, dto);
    }

    // ==========================================================================
    // DELETE /tasks/:id — delete task (DM or admin)
    // ==========================================================================

    @Delete(':id')
    async delete(
        @CurrentUser() user: { id: string; email: string; globalRole: GlobalRole },
        @Param('id') id: string,
    ) {
        return this.tasksService.delete(user, id);
    }
}