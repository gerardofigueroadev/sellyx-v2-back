import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private subscriptionsService: SubscriptionsService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByUsernameForLogin(loginDto.username, loginDto.orgCode);
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const isValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isValid) throw new UnauthorizedException('Credenciales inválidas');

    if (!user.isActive) throw new UnauthorizedException('Usuario inactivo');
    if (user.role?.name !== 'superadmin' && !user.organization) {
      throw new UnauthorizedException('Usuario sin organización asignada');
    }
    if (!user.role) throw new UnauthorizedException('Usuario sin rol asignado');

    const permissions = user.role.permissions?.map(p => p.name) ?? [];

    const payload = {
      sub: user.id,
      username: user.username,
      orgId: user.organization?.id ?? null,
      branchId: user.branch?.id ?? null,
      role: user.role.name,
      permissions,
    };

    // Include subscription info in the response (skip for superadmin)
    const subscription = user.organization
      ? await this.subscriptionsService.getMySubscription(user.organization.id)
      : null;

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role.name,
        permissions,
        organization: user.organization
          ? { id: user.organization.id, name: user.organization.name, code: (user.organization as any).code }
          : null,
        branch: user.branch ? { id: user.branch.id, name: user.branch.name } : null,
        subscription,
      },
    };
  }

  async getProfile(userId: number) {
    const user = await this.usersService.findOne(userId);
    const permissions = user.role?.permissions?.map(p => p.name) ?? [];
    const subscription = user.organization
      ? await this.subscriptionsService.getMySubscription(user.organization.id)
      : null;
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role?.name,
      permissions,
      organization: user.organization ? { id: user.organization.id, name: user.organization.name } : null,
      branch: user.branch ? { id: user.branch.id, name: user.branch.name } : null,
      subscription,
    };
  }
}
