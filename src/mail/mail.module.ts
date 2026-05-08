import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailResolver } from './mail.resolver';
import { JwtService } from '@nestjs/jwt';
import { join } from 'path';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('MAIL_HOST');
        const port = Number(configService.get<string>('MAIL_PORT') ?? 587);
        const user = configService.get<string>('MAIL_USER');

        return {
          transport: {
            host,
            port,
            secure: false,
            auth: {
              user,
              pass: configService.get<string>('MAIL_PASSWORD'),
            },
          },
          template: {
            dir: join(__dirname, '..', 'mail', 'templates'),
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
        };
      },
    }),
  ],
  providers: [MailService, JwtService, MailResolver],
  exports: [MailService],
})
export class MailModule {}
