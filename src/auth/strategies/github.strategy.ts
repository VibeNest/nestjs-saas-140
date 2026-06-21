import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { AuthService } from '../auth.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('githubOAuth.clientId') ?? 'disabled',
      clientSecret:
        configService.get<string>('githubOAuth.clientSecret') ?? 'disabled',
      callbackURL:
        configService.get<string>('githubOAuth.callbackUrl') ??
        'http://localhost:3000/api/v1/auth/github/callback',
      scope: ['user:email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: {
      id: string;
      username?: string;
      displayName?: string;
      emails?: Array<{ value: string }>;
    },
  ) {
    const email =
      profile.emails?.[0]?.value?.toLowerCase() ??
      `github+${profile.id}@oauth.local`;

    return this.authService.validateOAuthUser({
      provider: 'github',
      providerId: profile.id,
      email,
      firstName: profile.displayName ?? profile.username,
      lastName: undefined,
    });
  }
}
