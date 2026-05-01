import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get<string>(
      'MAIL_FROM',
      'Fitness Platform <no-reply@fitness.local>',
    );

    this.transporter = createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendMail(to: string, subject: string, html: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      html,
    });
  }
}
