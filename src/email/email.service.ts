import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly templatesDir = path.join(__dirname, 'templates');

  constructor(private readonly configService: ConfigService) {}

  private get enabled(): boolean {
    return this.configService.get<boolean>('email.enabled') ?? true;
  }

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('email.host'),
        port: this.configService.get<number>('email.port'),
        secure: this.configService.get<boolean>('email.secure'),
        auth: this.configService.get<string>('email.user')
          ? {
              user: this.configService.get<string>('email.user'),
              pass: this.configService.get<string>('email.pass'),
            }
          : undefined,
      });
    }
    return this.transporter;
  }

  renderTemplate(templateName: string, context: Record<string, unknown>): string {
    const templatePath = path.join(this.templatesDir, `${templateName}.hbs`);
    const source = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(source);
    return template(context);
  }

  async sendMail(options: SendEmailOptions): Promise<void> {
    if (!this.enabled) {
      this.logger.debug(
        `Email disabled — skipped "${options.subject}" to ${options.to}`,
      );
      return;
    }

    const html = this.renderTemplate(options.template, options.context);

    await this.getTransporter().sendMail({
      from: this.configService.get<string>('email.from'),
      to: options.to,
      subject: options.subject,
      html,
    });

    this.logger.log(`Email sent: "${options.subject}" to ${options.to}`);
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const appUrl = this.configService.get<string>('app.appUrl');
    const apiPrefix = this.configService.get<string>('app.apiPrefix');
    const verifyUrl = `${appUrl}/${apiPrefix}/auth/verify-email?token=${token}`;

    await this.sendMail({
      to: email,
      subject: 'Verify your email address',
      template: 'verify-email',
      context: { verifyUrl, email },
    });
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('app.frontendUrl');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    await this.sendMail({
      to: email,
      subject: 'Reset your password',
      template: 'reset-password',
      context: { resetUrl, email },
    });
  }

  async sendWelcomeEmail(email: string, firstName?: string | null): Promise<void> {
    await this.sendMail({
      to: email,
      subject: 'Welcome!',
      template: 'welcome',
      context: { email, firstName: firstName ?? 'there' },
    });
  }
}
