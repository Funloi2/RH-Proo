import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import {FilesInterceptor} from '@nestjs/platform-express';
import {diskStorage} from 'multer';
import {extname, join} from 'path';
import {v4 as uuidv4} from 'uuid';
import {LeavesService} from './leaves.service';
import {
    AdjustBalanceDto,
    CalendarQueryDto,
    CreateLeaveRequestDto,
    QueryLeavesDto,
    ReviewLeaveRequestDto,
} from './dto/leave.dto';
import {JwtAuthGuard} from '../auth/guards/jwt-auth.guard';
import {RolesGuard} from '../auth/guards/roles.guard';
import {Roles} from '../auth/decorators/roles.decorator';
import {CurrentUser} from '../auth/decorators/current-user.decorator';
import {GlobalRole, LeaveStatus} from '../generated/prisma/enums';
import {PrismaService} from '../prisma/prisma.service';

// File upload storage configuration
const uploadStorage = diskStorage({
    destination: join(process.cwd(), 'uploads', 'leave-attachments'),
    filename: (_req, file, cb) => {
        const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
        cb(null, uniqueName);
    },
});

@Controller('leaves')
@UseGuards(JwtAuthGuard)
export class LeavesController {
    constructor(
        private leavesService: LeavesService,
        private prisma: PrismaService,
    ) {}

    // ==========================================================================
    // POST /leaves — create leave request
    // ==========================================================================

    @Post()
    async create(
        @CurrentUser('id') userId: string,
        @Body() dto: CreateLeaveRequestDto,
    ) {
        return this.leavesService.create(userId, dto);
    }

    // ==========================================================================
    // GET /leaves — list leave requests (scoped by role)
    // ==========================================================================

    @Get()
    async findAll(
        @Query() query: QueryLeavesDto,
        @CurrentUser() user: { id: string; email: string; globalRole: GlobalRole },
        ) {
        return this.leavesService.findAll(query, user);
    }

    // ==========================================================================
    // GET /leaves/pending — pending requests for current reviewer
    // ==========================================================================

    @Get('pending')
    async getPending(
        @CurrentUser() user: { id: string; globalRole: GlobalRole },
    ) {
        return this.leavesService.getPendingForReviewer(user.id, user.globalRole);
    }

    // ==========================================================================
    // GET /leaves/calendar — calendar data for team view
    // ==========================================================================

    @Get('calendar')
    async getCalendar(
        @Query() query: CalendarQueryDto,
        @CurrentUser() user: { id: string; email: string; globalRole: GlobalRole },
    ) {
        return this.leavesService.getCalendar(query, user);
    }

    // ==========================================================================
    // GET /leaves/balance/:userId — get leave balance
    // ==========================================================================

    @Get('balance/:userId')
    async getBalance(
        @Param('userId') userId: string,
        @Query('year') year?: string,
    ) {
        return this.leavesService.getBalance(
            userId,
            year ? parseInt(year, 10) : undefined,
        );
    }

    // ==========================================================================
    // GET /leaves/my-balance — get own leave balance
    // ==========================================================================

    @Get('my-balance')
    async getMyBalance(
        @CurrentUser('id') userId: string,
        @Query('year') year?: string,
    ) {
        return this.leavesService.getBalance(
            userId,
            year ? parseInt(year, 10) : undefined,
        );
    }

    // ==========================================================================
    // PATCH /leaves/balance/:userId/:year — adjust balance (admin-only)
    // ==========================================================================

    @Patch('balance/:userId/:year')
    @UseGuards(RolesGuard)
    @Roles(GlobalRole.ADMIN)
    async adjustBalance(
        @CurrentUser('id') adminId: string,
        @Param('userId') userId: string,
        @Param('year', ParseIntPipe) year: number,
        @Body() dto: AdjustBalanceDto,
    ) {
        return this.leavesService.adjustBalance(adminId, userId, year, dto);
    }

    // ==========================================================================
    // POST /leaves/bulk-review — bulk approve/refuse (admin-only)
    // ==========================================================================

    @Post('bulk-review')
    @UseGuards(RolesGuard)
    @Roles(GlobalRole.ADMIN)
    async bulkReview(
        @CurrentUser('id') adminId: string,
        @Body() body: { leaveRequestIds: string[]; status: LeaveStatus },
    ) {
        return this.leavesService.bulkReview(adminId, body.leaveRequestIds, body.status);
    }

    // ==========================================================================
    // GET /leaves/:id — get single leave request
    // ==========================================================================

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.leavesService.findOne(id);
    }

    // ==========================================================================
    // PATCH /leaves/:id/review — approve or refuse (DM or admin)
    // ==========================================================================

    @Patch(':id/review')
    async review(
        @CurrentUser() user: { id: string; globalRole: GlobalRole },
        @Param('id') id: string,
        @Body() dto: ReviewLeaveRequestDto,
    ) {
        return this.leavesService.review(user.id, user.globalRole, id, dto);
    }

    // ==========================================================================
    // DELETE /leaves/:id — cancel own pending request
    // ==========================================================================

    @Delete(':id')
    async cancel(
        @CurrentUser('id') userId: string,
        @Param('id') id: string,
    ) {
        return this.leavesService.cancel(userId, id);
    }

    // ==========================================================================
    // POST /leaves/:id/attachments — upload files to a leave request
    // ==========================================================================

    @Post(':id/attachments')
    @UseInterceptors(
        FilesInterceptor('files', 5, { storage: uploadStorage }),
    )
    async uploadAttachments(
        @CurrentUser('id') userId: string,
        @Param('id') leaveRequestId: string,
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        // Verify the request exists and belongs to the user
        const request = await this.prisma.leaveRequest.findUnique({
            where: { id: leaveRequestId },
        });

        if (!request) {
            throw new Error('Leave request not found');
        }

        if (request.userId !== userId) {
            throw new Error('You can only upload attachments to your own leave requests');
        }

        return await Promise.all(
            files.map((file) =>
                this.prisma.leaveAttachment.create({
                    data: {
                        leaveRequestId,
                        fileName: file.originalname,
                        filePath: file.path,
                        fileSize: file.size,
                        mimeType: file.mimetype,
                    },
                }),
            ),
        );
    }
}