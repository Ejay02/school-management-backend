import { Module } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { InvitationResolver } from './invitation.resolver';
import { MailModule } from 'src/mail/mail.module';
import { AuthModule } from 'src/shared/auth/auth.module';

@Module({
  imports: [MailModule, AuthModule],
  providers: [InvitationService, InvitationResolver],
  exports: [InvitationService],
})
export class InvitationModule {}
