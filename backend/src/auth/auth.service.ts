import {
    Injectable,
    UnauthorizedException,
    BadRequestException,
    ConflictException,
    Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { JwtPayload } from './strategies/jwt.strategy';
import {
    LoginDto,
    SetupPasswordDto,
    ForgotPasswordDto,
    ResetPasswordDto,
} from './dto/auth.dto';
import { GlobalRole, Language } from '../generated/prisma/client';

// ============================================================================
// TYPES (exported so controller can reference them)
// ============================================================================

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

export interface AuthResponse {
    user: {
        id: string;
        email: string;
        name: string;
        surname: string;
        globalRole: GlobalRole;
        language: Language;
    };
    tokens: TokenPair;
}

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    private readonly SALT_ROUNDS = 12;

    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private configService: ConfigService,
        private mailService: MailService,
    ) {}

    // ==========================================================================
    // LOGIN
    // ==========================================================================

    async login(dto: LoginDto): Promise<AuthResponse> {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email.toLowerCase() },
        });

        if (!user || !user.passwordHash) {
            throw new UnauthorizedException('Invalid email or password');
        }

        if (!user.isActive || user.isDeleted) {
            throw new UnauthorizedException('Account is inactive or deleted');
        }

        const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!passwordValid) {
            throw new UnauthorizedException('Invalid email or password');
        }

        const tokens = await this.generateTokenPair(user.id, user.email, user.globalRole);

        this.logger.log(`User logged in: ${user.email}`);

        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                surname: user.surname,
                globalRole: user.globalRole,
                language: user.language,
            },
            tokens,
        };
    }

    // ==========================================================================
    // REGISTER USER (admin-only, sends invitation email)
    // ==========================================================================

    async registerUser(
        adminId: string,
        data: {
            email: string;
            name: string;
            surname: string;
            phone?: string;
            birthday?: Date;
            city?: string;
            address?: string;
            postalCode?: string;
            globalRole?: GlobalRole;
            language?: Language;
        },
    ): Promise<{ id: string; email: string }> {
        const email = data.email.toLowerCase();

        // Check for existing user (including soft-deleted)
        const existing = await this.prisma.user.findUnique({
            where: { email },
        });

        if (existing) {
            throw new ConflictException('A user with this email already exists');
        }

        // Create user without password
        const user = await this.prisma.user.create({
            data: {
                email,
                name: data.name,
                surname: data.surname,
                phone: data.phone || null,
                birthday: data.birthday || null,
                city: data.city || null,
                address: data.address || null,
                postalCode: data.postalCode || null,
                globalRole: data.globalRole || GlobalRole.USER,
                language: data.language || Language.FR,
                isActive: true,
                isDeleted: false,
            },
        });

        // Generate invitation token
        const token = await this.createPasswordToken(user.id, 48); // 48 hours

        // Send invitation email
        await this.mailService.sendInvitation(
            user.email,
            user.name,
            token,
            user.language,
        );

        // Log activity
        await this.prisma.activityLog.create({
            data: {
                actorId: adminId,
                action: 'user_created',
                targetType: 'user',
                targetId: user.id,
                metadata: { email: user.email, name: user.name, surname: user.surname },
            },
        });

        this.logger.log(`User created by admin ${adminId}: ${user.email}`);

        return { id: user.id, email: user.email };
    }

    // ==========================================================================
    // SETUP PASSWORD (from invitation link)
    // ==========================================================================

    async setupPassword(dto: SetupPasswordDto): Promise<AuthResponse> {
        const tokenRecord = await this.validatePasswordToken(dto.token);

        const user = await this.prisma.user.findUnique({
            where: { id: tokenRecord.userId },
        });

        if (!user) {
            throw new BadRequestException('User not found');
        }

        if (user.passwordHash) {
            throw new BadRequestException(
                'Password has already been set. Use the login or reset password flow instead.',
            );
        }

        // Hash and save password
        const passwordHash = await bcrypt.hash(dto.password, this.SALT_ROUNDS);

        await this.prisma.user.update({
            where: { id: user.id },
            data: { passwordHash },
        });

        // Mark token as used
        await this.prisma.passwordResetToken.update({
            where: { id: tokenRecord.id },
            data: { usedAt: new Date() },
        });

        // Generate tokens so user is logged in immediately
        const tokens = await this.generateTokenPair(user.id, user.email, user.globalRole);

        // Log activity
        await this.prisma.activityLog.create({
            data: {
                actorId: user.id,
                action: 'password_setup',
                targetType: 'user',
                targetId: user.id,
            },
        });

        this.logger.log(`Password set up for: ${user.email}`);

        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                surname: user.surname,
                globalRole: user.globalRole,
                language: user.language,
            },
            tokens,
        };
    }

    // ==========================================================================
    // FORGOT PASSWORD (sends reset email)
    // ==========================================================================

    async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
        const email = dto.email.toLowerCase();

        const user = await this.prisma.user.findUnique({
            where: { email },
        });

        // Always return success to prevent email enumeration
        if (!user || !user.isActive || user.isDeleted) {
            return { message: 'If an account exists with this email, a reset link has been sent.' };
        }

        const token = await this.createPasswordToken(user.id, 1); // 1 hour

        await this.mailService.sendPasswordReset(
            user.email,
            user.name,
            token,
            user.language,
        );

        this.logger.log(`Password reset requested for: ${user.email}`);

        return { message: 'If an account exists with this email, a reset link has been sent.' };
    }

    // ==========================================================================
    // RESET PASSWORD (from reset link)
    // ==========================================================================

    async resetPassword(dto: ResetPasswordDto): Promise<AuthResponse> {
        const tokenRecord = await this.validatePasswordToken(dto.token);

        const user = await this.prisma.user.findUnique({
            where: { id: tokenRecord.userId },
        });

        if (!user || !user.isActive || user.isDeleted) {
            throw new BadRequestException('Invalid or expired token');
        }

        // Hash and save new password
        const passwordHash = await bcrypt.hash(dto.password, this.SALT_ROUNDS);

        await this.prisma.user.update({
            where: { id: user.id },
            data: { passwordHash },
        });

        // Mark token as used
        await this.prisma.passwordResetToken.update({
            where: { id: tokenRecord.id },
            data: { usedAt: new Date() },
        });

        // Generate tokens so user is logged in immediately
        const tokens = await this.generateTokenPair(user.id, user.email, user.globalRole);

        // Log activity
        await this.prisma.activityLog.create({
            data: {
                actorId: user.id,
                action: 'password_reset',
                targetType: 'user',
                targetId: user.id,
            },
        });

        this.logger.log(`Password reset for: ${user.email}`);

        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                surname: user.surname,
                globalRole: user.globalRole,
                language: user.language,
            },
            tokens,
        };
    }

    // ==========================================================================
    // REFRESH TOKEN
    // ==========================================================================

    async refreshToken(refreshToken: string): Promise<TokenPair> {
        try {
            const payload = this.jwtService.verify(refreshToken, {
                secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
            });

            const user = await this.prisma.user.findUnique({
                where: { id: payload.sub },
                select: {
                    id: true,
                    email: true,
                    globalRole: true,
                    isActive: true,
                    isDeleted: true,
                },
            });

            if (!user || !user.isActive || user.isDeleted) {
                throw new UnauthorizedException('User account is inactive or deleted');
            }

            return this.generateTokenPair(user.id, user.email, user.globalRole);
        } catch {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }
    }

    // ==========================================================================
    // PRIVATE HELPERS
    // ==========================================================================

    private async generateTokenPair(
        userId: string,
        email: string,
        globalRole: GlobalRole,
    ): Promise<TokenPair> {
        const payload: JwtPayload = {
            sub: userId,
            email,
            globalRole,
        };

        const jwtSecret = this.configService.get<string>('JWT_SECRET')!;
        const jwtRefreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET')!;
        const jwtExpiry = this.configService.get<string>('JWT_EXPIRY') || '15m';
        const jwtRefreshExpiry = this.configService.get<string>('JWT_REFRESH_EXPIRY') || '7d';

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload as unknown as Record<string, unknown>, {
                secret: jwtSecret,
                expiresIn: jwtExpiry as any,
            }),
            this.jwtService.signAsync(payload as unknown as Record<string, unknown>, {
                secret: jwtRefreshSecret,
                expiresIn: jwtRefreshExpiry as any,
            }),
        ]);

        return { accessToken, refreshToken };
    }

    private async createPasswordToken(
        userId: string,
        expiresInHours: number,
    ): Promise<string> {
        const rawToken = crypto.randomBytes(32).toString('hex');

        const tokenHash = crypto
            .createHash('sha256')
            .update(rawToken)
            .digest('hex');

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + expiresInHours);

        // Invalidate any previous unused tokens for this user
        await this.prisma.passwordResetToken.updateMany({
            where: {
                userId,
                usedAt: null,
                expiresAt: { gt: new Date() },
            },
            data: { usedAt: new Date() },
        });

        await this.prisma.passwordResetToken.create({
            data: {
                userId,
                tokenHash,
                expiresAt,
            },
        });

        return rawToken;
    }

    private async validatePasswordToken(rawToken: string) {
        const tokenHash = crypto
            .createHash('sha256')
            .update(rawToken)
            .digest('hex');

        const tokenRecord = await this.prisma.passwordResetToken.findFirst({
            where: {
                tokenHash,
                usedAt: null,
                expiresAt: { gt: new Date() },
            },
        });

        if (!tokenRecord) {
            throw new BadRequestException('Invalid or expired token');
        }

        return tokenRecord;
    }
}