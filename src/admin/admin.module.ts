import { Module } from '@nestjs/common';
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';
import { JwtService } from '@nestjs/jwt';
import { CloudinaryModule } from '../shared/cloudinary/cloudinary.module';
import { SetupModule } from '../setup/setup.module';
import { InvitationModule } from '../invitation/invitation.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [CloudinaryModule, SetupModule, InvitationModule, PaymentModule],
  providers: [AdminService, JwtService, AdminResolver],
  exports: [AdminService],
})
export class AdminModule {}
