import {
  Injectable, CanActivate, ExecutionContext,
  HttpException, HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SubscriptionsService } from './subscriptions.service';
import { SKIP_SUBSCRIPTION } from './skip-subscription.decorator';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private subscriptionsService: SubscriptionsService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Respect @SkipSubscription() decorator
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_SUBSCRIPTION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest();

    // 2. Try to resolve orgId + role from already-populated req.user (route-level JwtAuthGuard),
    //    or decode the token manually so global ordering doesn't matter.
    let orgId: number | undefined = request.user?.orgId;
    let role: string | undefined   = request.user?.role;

    if (!orgId) {
      const authHeader: string | undefined = request.headers?.authorization;
      if (!authHeader?.startsWith('Bearer ')) return true; // no token → let JwtAuthGuard reject it

      try {
        const token  = authHeader.substring(7);
        const secret = this.configService.get<string>('JWT_SECRET', 'consuelito_secret_key_2024');
        const payload: any = this.jwtService.verify(token, { secret });
        orgId = payload.orgId;
        role  = payload.role;
      } catch {
        return true; // invalid/expired token → let JwtAuthGuard handle
      }
    }

    if (!orgId) return true;

    // 3. Superadmin bypasses subscription check
    if (role === 'superadmin') return true;

    // 4. Check subscription
    const active = await this.subscriptionsService.isActiveForOrg(orgId);
    if (!active) {
      throw new HttpException(
        { message: 'Tu suscripción ha expirado. Contacta a soporte para renovarla.', code: 'SUBSCRIPTION_EXPIRED' },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return true;
  }
}
