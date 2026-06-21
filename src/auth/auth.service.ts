import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { Response } from 'express';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuthTokensResponseDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { JwtPayload } from './strategies/jwt.strategy';

export interface OAuthProfile {
  provider: string;
  providerId: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

interface OAuthExchangePayload {
  sub: string;
  type: 'oauth_exchange';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  private parseExpiresIn(expiresIn: string): Date {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return new Date(Date.now() + value * multipliers[unit]);
  }

  private async createTokens(user: {
    id: string;
    email: string;
    role: Role;
  }): Promise<AuthTokensResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessExpiresIn =
      this.configService.get<string>('jwt.accessExpiresIn') ?? '15m';
    const refreshExpiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d';

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: accessExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: refreshExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        userId: user.id,
        expiresAt: this.parseExpiresIn(refreshExpiresIn),
      },
    });

    return { accessToken, refreshToken };
  }

  setRefreshTokenCookie(res: Response, refreshToken: string): void {
    const expiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d';
    const maxAge = this.parseExpiresIn(expiresIn).getTime() - Date.now();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: this.configService.get<string>('app.nodeEnv') === 'production',
      sameSite: 'lax',
      maxAge,
    });
  }

  attachTokens(
    res: Response | undefined,
    tokens: AuthTokensResponseDto,
  ): AuthTokensResponseDto {
    const delivery =
      this.configService.get<string>('jwt.refreshTokenDelivery') ?? 'body';

    if (delivery === 'cookie' && res) {
      this.setRefreshTokenCookie(res, tokens.refreshToken!);
      return { accessToken: tokens.accessToken };
    }

    return tokens;
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const bcryptRounds =
      this.configService.get<number>('auth.bcryptRounds') ?? 10;
    const hashedPassword = await bcrypt.hash(dto.password, bcryptRounds);
    const verificationToken = this.generateToken();

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: Role.USER,
        },
      });

      await tx.emailVerificationToken.create({
        data: {
          token: verificationToken,
          userId: created.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      return created;
    });

    let emailSent = true;
    try {
      await this.emailService.sendVerificationEmail(
        user.email,
        verificationToken,
      );
      await this.emailService.sendWelcomeEmail(user.email, user.firstName);
    } catch (error) {
      emailSent = false;
      this.logger.error(
        `Failed to send registration emails to ${user.email}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return {
      message: emailSent
        ? 'Registration successful. Please verify your email.'
        : 'Registration successful. Email delivery failed — use forgot-password or contact support.',
      emailSent,
    };
  }

  async login(dto: LoginDto, res?: Response) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.password || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (
      this.configService.get<boolean>('auth.requireEmailVerification') &&
      !user.emailVerified
    ) {
      throw new ForbiddenException(
        'Please verify your email before logging in',
      );
    }

    const tokens = await this.createTokens(user);
    return this.attachTokens(res, tokens);
  }

  async refresh(refreshToken: string, res?: Response) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Refresh token revoked or expired');
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const tokens = await this.createTokens(user);
    return this.attachTokens(res, tokens);
  }

  async logout(refreshToken: string, res?: Response) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    if (res) {
      res.clearCookie('refreshToken');
    }

    return { message: 'Logged out successfully' };
  }

  async verifyEmail(token: string) {
    const verificationToken =
      await this.prisma.emailVerificationToken.findUnique({
        where: { token },
        include: { user: true },
      });

    if (!verificationToken) {
      throw new BadRequestException('Invalid verification token');
    }

    if (verificationToken.expiresAt < new Date()) {
      throw new BadRequestException('Verification token expired');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerified: true },
      }),
      this.prisma.emailVerificationToken.delete({
        where: { id: verificationToken.id },
      }),
    ]);

    return { message: 'Email verified successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (user) {
      const token = this.generateToken();

      await this.prisma.$transaction([
        this.prisma.passwordResetToken.deleteMany({
          where: { userId: user.id, usedAt: null },
        }),
        this.prisma.passwordResetToken.create({
          data: {
            token,
            userId: user.id,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        }),
      ]);

      try {
        await this.emailService.sendPasswordResetEmail(user.email, token);
      } catch (error) {
        this.logger.error(
          `Failed to send password reset email to ${user.email}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return {
      message:
        'If an account with that email exists, a password reset link has been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: dto.token },
    });

    if (!resetToken || resetToken.usedAt) {
      throw new BadRequestException('Invalid reset token');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Reset token expired');
    }

    const bcryptRounds =
      this.configService.get<number>('auth.bcryptRounds') ?? 10;
    const hashedPassword = await bcrypt.hash(dto.password, bcryptRounds);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Password reset successfully' };
  }

  createOAuthExchangeCode(user: { id: string }): string {
    const payload: OAuthExchangePayload = {
      sub: user.id,
      type: 'oauth_exchange',
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.oauthExchangeSecret'),
      expiresIn: '60s',
    });
  }

  async exchangeOAuthCode(code: string, res?: Response) {
    let payload: OAuthExchangePayload;
    try {
      payload = this.jwtService.verify<OAuthExchangePayload>(code, {
        secret: this.configService.get<string>('jwt.oauthExchangeSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired OAuth code');
    }

    if (payload.type !== 'oauth_exchange') {
      throw new UnauthorizedException('Invalid OAuth code');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const tokens = await this.createTokens(user);
    return this.attachTokens(res, tokens);
  }

  async validateOAuthUser(profile: OAuthProfile) {
    if (!profile.email) {
      throw new BadRequestException('OAuth provider did not return an email');
    }

    const email = profile.email.toLowerCase();

    const existingOAuth = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerId: {
          provider: profile.provider,
          providerId: profile.providerId,
        },
      },
      include: { user: true },
    });

    if (existingOAuth) {
      if (!existingOAuth.user.isActive) {
        throw new ForbiddenException('Account is deactivated');
      }
      return existingOAuth.user;
    }

    let user = await this.prisma.user.findUnique({ where: { email } });

    if (user) {
      if (!user.isActive) {
        throw new ForbiddenException('Account is deactivated');
      }

      if (user.password && !user.emailVerified) {
        throw new ConflictException(
          'An account with this email exists. Please verify your email before linking OAuth.',
        );
      }
    } else {
      user = await this.prisma.user.create({
        data: {
          email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          emailVerified: true,
          role: Role.USER,
        },
      });
    }

    await this.prisma.oAuthAccount.create({
      data: {
        provider: profile.provider,
        providerId: profile.providerId,
        userId: user.id,
      },
    });

    return user;
  }

  async oauthLogin(
    user: { id: string; email: string; role: Role },
    res?: Response,
  ) {
    const tokens = await this.createTokens(user);
    return this.attachTokens(res, tokens);
  }
}
