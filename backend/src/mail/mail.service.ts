import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
    private transporter: nodemailer.Transporter | undefined;
    private readonly logger = new Logger(MailService.name);

    constructor(private configService: ConfigService) {
        const host = this.configService.get<string>('MAIL_HOST');
        const port = this.configService.get<number>('MAIL_PORT');
        const user = this.configService.get<string>('MAIL_USER');
        const pass = this.configService.get<string>('MAIL_PASS');

        // If mail config is not set, use a preview/dev mode
        if (!host || host === 'smtp.example.com') {
            this.logger.warn(
                'Mail is not configured. Emails will be logged to console instead of sent.',
            );
            this.transporter = undefined;
        } else {
            this.transporter = nodemailer.createTransport({
                host,
                port,
                secure: port === 465,
                auth: { user, pass },
            });
        }
    }

    private async send(to: string, subject: string, html: string) {
        const from = this.configService.get<string>('MAIL_USER') || 'noreply@hr-proo.com';

        if (!this.transporter) {
            // Dev mode: log email to console
            this.logger.log('========== EMAIL (dev mode) ==========');
            this.logger.log(`To: ${to}`);
            this.logger.log(`Subject: ${subject}`);
            this.logger.log(`Body: ${html}`);
            this.logger.log('=======================================');
            return;
        }

        try {
            await this.transporter.sendMail({ from, to, subject, html });
            this.logger.log(`Email sent to ${to}: ${subject}`);
        } catch (error) {
            this.logger.error(`Failed to send email to ${to}`, error);
            throw error;
        }
    }

    /**
     * Send an invitation email to a newly created user so they
     * can set up their password for the first time.
     */
    async sendInvitation(
        to: string,
        name: string,
        token: string,
        lang: 'EN' | 'FR' = 'FR',
    ) {
        const frontendUrl = this.configService.get<string>('FRONTEND_URL');
        const link = `${frontendUrl}/setup-password?token=${token}`;

        const subjects = {
            EN: 'Welcome to HR-Proo — Set up your account',
            FR: 'Bienvenue sur HR-Proo — Configurez votre compte',
        };

        const bodies = {
            EN: `
        <h2>Welcome to HR-Proo, ${name}!</h2>
        <p>Your account has been created. Please click the link below to set up your password:</p>
        <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#3B82F6;color:#fff;text-decoration:none;border-radius:6px;">Set up my password</a></p>
        <p>This link will expire in 48 hours.</p>
        <p>If you did not expect this email, please ignore it.</p>
      `,
            FR: `
        <h2>Bienvenue sur HR-Proo, ${name} !</h2>
        <p>Votre compte a été créé. Veuillez cliquer sur le lien ci-dessous pour configurer votre mot de passe :</p>
        <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#3B82F6;color:#fff;text-decoration:none;border-radius:6px;">Configurer mon mot de passe</a></p>
        <p>Ce lien expirera dans 48 heures.</p>
        <p>Si vous n'attendiez pas cet e-mail, veuillez l'ignorer.</p>
      `,
        };

        await this.send(to, subjects[lang], bodies[lang]);
    }

    /**
     * Send a password reset email.
     */
    async sendPasswordReset(
        to: string,
        name: string,
        token: string,
        lang: 'EN' | 'FR' = 'FR',
    ) {
        const frontendUrl = this.configService.get<string>('FRONTEND_URL');
        const link = `${frontendUrl}/reset-password?token=${token}`;

        const subjects = {
            EN: 'HR-Proo — Reset your password',
            FR: 'HR-Proo — Réinitialisez votre mot de passe',
        };

        const bodies = {
            EN: `
        <h2>Password Reset</h2>
        <p>Hi ${name}, you requested a password reset. Click the link below:</p>
        <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#3B82F6;color:#fff;text-decoration:none;border-radius:6px;">Reset my password</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
            FR: `
        <h2>Réinitialisation du mot de passe</h2>
        <p>Bonjour ${name}, vous avez demandé une réinitialisation de mot de passe. Cliquez sur le lien ci-dessous :</p>
        <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#3B82F6;color:#fff;text-decoration:none;border-radius:6px;">Réinitialiser mon mot de passe</a></p>
        <p>Ce lien expirera dans 1 heure.</p>
        <p>Si vous n'avez pas fait cette demande, veuillez ignorer cet e-mail.</p>
      `,
        };

        await this.send(to, subjects[lang], bodies[lang]);
    }
}