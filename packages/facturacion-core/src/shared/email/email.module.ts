import { Module, Global } from '@nestjs/common';
import { EmailService } from './email.service';
import { MailjetProvider } from './providers/mailjet.provider';

@Global()
@Module({
  providers: [EmailService, MailjetProvider],
  exports: [EmailService],
})
export class EmailModule {}