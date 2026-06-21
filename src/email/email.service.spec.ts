import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service';

jest.mock('nodemailer');
jest.mock('fs');

describe('EmailService', () => {
  let service: EmailService;
  const sendMailMock = jest.fn().mockResolvedValue({});

  beforeEach(async () => {
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: sendMailMock,
    });

    (fs.readFileSync as jest.Mock).mockReturnValue(
      '<p>Hello {{email}}, verify: {{verifyUrl}}</p>',
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, unknown> = {
                'email.enabled': true,
                'email.host': 'localhost',
                'email.port': 1025,
                'email.secure': false,
                'email.user': '',
                'email.from': 'noreply@example.com',
                'app.appUrl': 'http://localhost:3000',
                'app.apiPrefix': 'api/v1',
                'app.frontendUrl': 'http://localhost:5173',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders templates with context', () => {
    const html = service.renderTemplate('verify-email', {
      email: 'test@example.com',
      verifyUrl: 'http://localhost/verify',
    });

    expect(html).toContain('test@example.com');
    expect(html).toContain('http://localhost/verify');
  });

  it('sends email when enabled', async () => {
    await service.sendVerificationEmail('test@example.com', 'token123');

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: 'Verify your email address',
      }),
    );
  });

  it('skips sending when disabled', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'email.enabled') return false;
              return 'value';
            }),
          },
        },
      ],
    }).compile();

    const disabledService = module.get<EmailService>(EmailService);
    await disabledService.sendVerificationEmail('test@example.com', 'token');

    expect(sendMailMock).not.toHaveBeenCalled();
  });
});
