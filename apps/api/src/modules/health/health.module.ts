import { Module } from '@nestjs/common';
import { HealthLivenessController } from './liveness.controller';
import { HealthReadinessController } from './readiness.controller';

@Module({
  controllers: [HealthLivenessController, HealthReadinessController],
})
export class HealthModule {}
