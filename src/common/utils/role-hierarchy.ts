import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';

const ROLE_RANK: Record<Role, number> = {
  [Role.USER]: 0,
  [Role.ADMIN]: 1,
  [Role.SUPER_ADMIN]: 2,
};

export function assertCanManageUser(
  actorRole: Role,
  targetRole: Role,
  action: string,
): void {
  if (actorRole === Role.SUPER_ADMIN) {
    return;
  }

  if (targetRole === Role.SUPER_ADMIN || targetRole === Role.ADMIN) {
    throw new ForbiddenException(
      `You do not have permission to ${action} this user`,
    );
  }
}

export function assertCanAssignRole(actorRole: Role, newRole: Role): void {
  if (newRole === Role.SUPER_ADMIN && actorRole !== Role.SUPER_ADMIN) {
    throw new ForbiddenException(
      'Only SUPER_ADMIN can assign SUPER_ADMIN role',
    );
  }

  if (ROLE_RANK[newRole] > ROLE_RANK[actorRole]) {
    throw new ForbiddenException(
      'You cannot assign a role higher than your own',
    );
  }
}
