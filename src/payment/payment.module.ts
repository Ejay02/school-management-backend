import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PaymentService } from './payment.service';
import { PaymentResolver } from './payment.resolver';

@Module({
  imports: [],
  providers: [PaymentService, JwtService, PaymentResolver],
  exports: [PaymentService],
})
export class PaymentModule {}
