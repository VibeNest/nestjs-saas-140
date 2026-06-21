import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  assertCanAssignRole,
  assertCanManageUser,
} from './role-hierarchy';

describe('role-hierarchy', () => {
  describe('assertCanManageUser', () => {
    it('allows SUPER_ADMIN to manage anyone', () => {
      expect(() =>
        assertCanManageUser(Role.SUPER_ADMIN, Role.SUPER_ADMIN, 'modify'),
      ).not.toThrow();
    });

    it('blocks ADMIN from managing SUPER_ADMIN', () => {
      expect(() =>
        assertCanManageUser(Role.ADMIN, Role.SUPER_ADMIN, 'modify'),
      ).toThrow(ForbiddenException);
    });

    it('blocks ADMIN from managing other ADMIN', () => {
      expect(() =>
        assertCanManageUser(Role.ADMIN, Role.ADMIN, 'modify'),
      ).toThrow(ForbiddenException);
    });

    it('allows ADMIN to manage USER', () => {
      expect(() =>
        assertCanManageUser(Role.ADMIN, Role.USER, 'modify'),
      ).not.toThrow();
    });
  });

  describe('assertCanAssignRole', () => {
    it('blocks ADMIN from assigning SUPER_ADMIN', () => {
      expect(() =>
        assertCanAssignRole(Role.ADMIN, Role.SUPER_ADMIN),
      ).toThrow(ForbiddenException);
    });

    it('allows SUPER_ADMIN to assign ADMIN', () => {
      expect(() =>
        assertCanAssignRole(Role.SUPER_ADMIN, Role.ADMIN),
      ).not.toThrow();
    });
  });
});
