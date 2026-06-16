import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentResolver } from './payment.resolver';

@Module({
  imports: [],
  controllers: [PaymentController],
  providers: [PaymentService, JwtService, PaymentResolver],
  exports: [PaymentService],
})
export class PaymentModule {}
