import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: jest.Mocked<PrismaService>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    password: 'hashed',
    firstName: 'Test',
    lastName: 'User',
    role: Role.USER,
    emailVerified: true,
    isActive: true,
    stripeCustomerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      refreshToken: {
        updateMany: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('returns user profile without password', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

    const result = await service.getProfile('user-1');

    expect(result.email).toBe('test@example.com');
    expect(result).not.toHaveProperty('password');
  });

  it('throws when user not found', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.getProfile('missing')).rejects.toThrow(NotFoundException);
  });

  it('updates profile', async () => {
    (prisma.user.update as jest.Mock).mockResolvedValue({
      ...mockUser,
      firstName: 'Updated',
    });

    const result = await service.updateProfile('user-1', { firstName: 'Updated' });
    expect(result.firstName).toBe('Updated');
  });

  it('prevents non-super-admin from assigning SUPER_ADMIN', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

    await expect(
      service.updateRole(
        'user-1',
        { role: Role.SUPER_ADMIN },
        Role.ADMIN,
        'admin-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('prevents admin from modifying super admin', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...mockUser,
      id: 'super-1',
      role: Role.SUPER_ADMIN,
    });

    await expect(
      service.updateStatus('super-1', false, Role.ADMIN, 'admin-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('prevents self role change', async () => {
    await expect(
      service.updateRole(
        'admin-1',
        { role: Role.USER },
        Role.ADMIN,
        'admin-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('deactivates user and revokes tokens', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.user.update as jest.Mock).mockResolvedValue({
      ...mockUser,
      isActive: false,
    });

    const result = await service.updateStatus(
      'user-1',
      false,
      Role.SUPER_ADMIN,
      'super-1',
    );

    expect(result.isActive).toBe(false);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
  });
});
