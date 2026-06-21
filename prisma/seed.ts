import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail =
    process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword =
    process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'Admin123!';
  const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10);

  const plans = [
    {
      name: 'Free',
      slug: 'free',
      description: 'Get started with basic features',
      stripePriceId: null,
      priceCents: 0,
      currency: 'usd',
      interval: 'month',
      features: ['Up to 3 projects', 'Community support', '1 GB storage'],
      sortOrder: 0,
    },
    {
      name: 'Pro',
      slug: 'pro',
      description: 'For growing teams and businesses',
      stripePriceId: 'price_test_pro_monthly',
      priceCents: 2900,
      currency: 'usd',
      interval: 'month',
      features: [
        'Unlimited projects',
        'Priority support',
        '50 GB storage',
        'Advanced analytics',
      ],
      sortOrder: 1,
    },
    {
      name: 'Enterprise',
      slug: 'enterprise',
      description: 'For large organizations with custom needs',
      stripePriceId: 'price_test_enterprise_monthly',
      priceCents: 9900,
      currency: 'usd',
      interval: 'month',
      features: [
        'Everything in Pro',
        'Dedicated support',
        'Unlimited storage',
        'SSO & SAML',
        'Custom integrations',
      ],
      sortOrder: 2,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      create: plan,
      update: {
        name: plan.name,
        description: plan.description,
        stripePriceId: plan.stripePriceId,
        priceCents: plan.priceCents,
        features: plan.features,
        sortOrder: plan.sortOrder,
      },
    });
  }

  const hashedPassword = await bcrypt.hash(adminPassword, bcryptRounds);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    create: {
      email: adminEmail.toLowerCase(),
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: Role.SUPER_ADMIN,
      emailVerified: true,
    },
    update: {
      role: Role.SUPER_ADMIN,
      emailVerified: true,
    },
  });

  const freePlan = await prisma.plan.findUnique({ where: { slug: 'free' } });

  if (freePlan) {
    await prisma.subscription.upsert({
      where: { userId: admin.id },
      create: {
        userId: admin.id,
        planId: freePlan.id,
        status: 'ACTIVE',
      },
      update: {},
    });
  }

  console.log('Seed completed:');
  console.log(`  Admin: ${adminEmail} / ${adminPassword}`);
  console.log(`  Plans: free, pro, enterprise`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
