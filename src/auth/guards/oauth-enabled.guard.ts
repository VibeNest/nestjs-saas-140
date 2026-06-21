import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleOAuthEnabledGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(): boolean {
    if (!this.configService.get<boolean>('googleOAuth.enabled')) {
      throw new ServiceUnavailableException('Google OAuth is not enabled');
    }
    return true;
  }
}

@Injectable()
export class GithubOAuthEnabledGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(): boolean {
    if (!this.configService.get<boolean>('githubOAuth.enabled')) {
      throw new ServiceUnavailableException('GitHub OAuth is not enabled');
    }
    return true;
  }
}
