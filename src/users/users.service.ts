import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  assertCanAssignRole,
  assertCanManageUser,
} from '../common/utils/role-hierarchy';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto, UpdateUserRoleDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private sanitizeUser(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: Role;
    emailVerified: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    password?: string | null;
  }) {
    const { password: _password, ...sanitized } = user;
    return sanitized;
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.sanitizeUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    });
    return this.sanitizeUser(user);
  }

  async findAll(pagination: PaginationDto) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    return {
      data: data.map((user) => this.sanitizeUser(user)),
      total,
      page,
      limit,
    };
  }

  async updateRole(
    targetUserId: string,
    dto: UpdateUserRoleDto,
    actorRole: Role,
    actorId: string,
  ) {
    if (targetUserId === actorId) {
      throw new ForbiddenException('You cannot change your own role');
    }

    assertCanAssignRole(actorRole, dto.role);

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    assertCanManageUser(actorRole, user.role, 'modify');

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: dto.role },
    });

    return this.sanitizeUser(updated);
  }

  async updateStatus(
    targetUserId: string,
    isActive: boolean,
    actorRole: Role,
    actorId: string,
  ) {
    if (targetUserId === actorId) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    assertCanManageUser(actorRole, user.role, 'deactivate');

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { isActive },
    });

    if (!isActive) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return this.sanitizeUser(updated);
  }
}
