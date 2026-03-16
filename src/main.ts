import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { RolesService } from './roles/roles.service';
import { UsersService } from './users/users.service';
import { SubscriptionsService } from './subscriptions/subscriptions.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
  });

  await seedDatabase(app);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application running on: http://localhost:${port}/api`);
}

async function seedDatabase(app: any) {
  const rolesService         = app.get(RolesService);
  const usersService         = app.get(UsersService);
  const subscriptionsService = app.get(SubscriptionsService);

  // 1. Permissions (idempotent)
  await rolesService.seedPermissions();

  // 2. Superadmin role (idempotent)
  await rolesService.seedSuperAdmin();

  // 3. Platform plans (idempotent)
  await subscriptionsService.seedPlans();

  // 4. Superadmin user (idempotent)
  if (!await usersService.findByUsername('superadmin')) {
    const superadminRole = await rolesService.findByName('superadmin');
    if (superadminRole) {
      // Create superadmin without orgId (pass null — superadmin has no org)
      const hashedPassword = await (await import('bcrypt')).hash('super123', 10);
      // We bypass the service to avoid the limit check (superadmin has no org/subscription)
      const usersRepo = usersService['usersRepository'];
      await usersRepo.save(usersRepo.create({
        username: 'superadmin',
        password: hashedPassword,
        name: 'Super Admin',
        organization: null,
        branch: null,
        role: superadminRole,
      }));
      console.log('✓ Superadmin creado: superadmin/super123');
    }
  }
}

bootstrap();
