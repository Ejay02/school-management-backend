import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../shared/auth/auth.module';
import { ChatResolver } from './chat.resolver';
import { ChatService } from './chat.service';
import { ChatGateway } from './gateway/chat.gateway';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
      }),
    }),
  ],
  providers: [ChatResolver, ChatService, ChatGateway],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
