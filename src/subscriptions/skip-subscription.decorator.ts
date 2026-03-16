import { SetMetadata } from '@nestjs/common';

export const SKIP_SUBSCRIPTION = 'skipSubscription';
export const SkipSubscription = () => SetMetadata(SKIP_SUBSCRIPTION, true);
