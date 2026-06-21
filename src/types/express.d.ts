import { AuthenticatedUser } from './common/decorators/current-user.decorator';

declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}
  }
}

export {};
