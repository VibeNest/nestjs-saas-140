import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { Public } from '../common/decorators/auth.decorators';
import { AuthService } from './auth.service';
import {
  AuthTokensResponseDto,
  ForgotPasswordDto,
  LoginDto,
  MessageResponseDto,
  OAuthExchangeDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailQueryDto,
} from './dto/auth.dto';
import {
  GithubOAuthEnabledGuard,
  GoogleOAuthEnabledGuard,
} from './guards/oauth-enabled.guard';

@ApiTags('auth')
@Controller('auth')
@Throttle({ default: { limit: 20, ttl: 60000 } })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private apiPath(path: string): string {
    const prefix = this.configService.get<string>('app.apiPrefix') ?? 'api/v1';
    return `/${prefix}${path}`;
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, type: MessageResponseDto })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, type: AuthTokensResponseDto })
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.login(dto, res);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, type: AuthTokensResponseDto })
  refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      dto.refreshToken ?? (req.cookies?.refreshToken as string);
    return this.authService.refresh(refreshToken, res);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  logout(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      dto.refreshToken ?? (req.cookies?.refreshToken as string);
    return this.authService.logout(refreshToken, res);
  }

  @Public()
  @Get('verify-email')
  @SkipThrottle()
  @ApiOperation({ summary: 'Verify email address' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  verifyEmail(@Query() query: VerifyEmailQueryDto) {
    return this.authService.verifyEmail(query.token);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Post('oauth/exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange OAuth one-time code for tokens',
    description:
      'After OAuth redirect, exchange the short-lived code from the callback URL for JWT tokens.',
  })
  @ApiResponse({ status: 200, type: AuthTokensResponseDto })
  exchangeOAuthCode(
    @Body() dto: OAuthExchangeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.exchangeOAuthCode(dto.code, res);
  }

  @Public()
  @Get('google')
  @UseGuards(GoogleOAuthEnabledGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  googleAuth(@Res() res: Response) {
    return res.redirect(this.apiPath('/auth/google/start'));
  }

  @Public()
  @Get('google/start')
  @UseGuards(GoogleOAuthEnabledGuard, AuthGuard('google'))
  googleAuthStart() {
    // Passport redirects to Google
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleOAuthEnabledGuard, AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  googleCallback(
    @Req() req: Request & { user: { id: string; email: string; role: Role } },
    @Res() res: Response,
  ) {
    const code = this.authService.createOAuthExchangeCode(req.user);
    const frontendUrl = this.configService.get<string>('app.frontendUrl');
    return res.redirect(`${frontendUrl}/auth/callback?code=${code}`);
  }

  @Public()
  @Get('github')
  @UseGuards(GithubOAuthEnabledGuard)
  @ApiOperation({ summary: 'Initiate GitHub OAuth login' })
  githubAuth(@Res() res: Response) {
    return res.redirect(this.apiPath('/auth/github/start'));
  }

  @Public()
  @Get('github/start')
  @UseGuards(GithubOAuthEnabledGuard, AuthGuard('github'))
  githubAuthStart() {
    // Passport redirects to GitHub
  }

  @Public()
  @Get('github/callback')
  @UseGuards(GithubOAuthEnabledGuard, AuthGuard('github'))
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  githubCallback(
    @Req() req: Request & { user: { id: string; email: string; role: Role } },
    @Res() res: Response,
  ) {
    const code = this.authService.createOAuthExchangeCode(req.user);
    const frontendUrl = this.configService.get<string>('app.frontendUrl');
    return res.redirect(`${frontendUrl}/auth/callback?code=${code}`);
  }
}
