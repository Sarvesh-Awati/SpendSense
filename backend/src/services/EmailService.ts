import nodemailer from 'nodemailer';
import env from '../config/env';
import { InternalServerError } from '../errors/AppError';

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    if (env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE ?? (env.SMTP_PORT === 465),
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
    }
  }

  /**
   * Returns whether the email provider is fully configured with credentials.
   */
  public isConfigured(): boolean {
    return !!(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS);
  }

  /**
   * Tests the connection to the configured SMTP server.
   */
  public async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('❌ SMTP Connection Verification Failed:', error);
      return false;
    }
  }

  /**
   * Sends a transactional password reset email to the target recipient.
   */
  public async sendPasswordResetEmail(toEmail: string, rawToken: string): Promise<void> {
    if (!this.isConfigured() || !this.transporter) {
      // The operator-facing detail goes to the logs, never to an API response.
      console.error(
        '[EmailService] Cannot send password reset email: SMTP is not configured. ' +
          'Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and EMAIL_FROM.'
      );
      throw new InternalServerError('Email delivery is unavailable');
    }

    const resetUrl = `${env.APP_URL}/reset-password?token=${rawToken}`;
    const fromAddress = env.EMAIL_FROM || '"SpendSense" <no-reply@spendsense.app>';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your SpendSense Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f8fafc; margin: 0; padding: 40px 20px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #161c2a; border: 1px solid #1e293b; border-radius: 20px; padding: 40px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);" cellspacing="0" cellpadding="0" border="0">
          <!-- Logo / Header -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background: linear-gradient(135deg, #10b981 0%, #6366f1 100%); border-radius: 12px; width: 44px; height: 44px; text-align: center; vertical-align: middle;">
                    <span style="font-size: 22px; font-weight: bold; color: #ffffff;">S</span>
                  </td>
                  <td style="padding-left: 12px; font-size: 22px; font-weight: bold; color: #ffffff; letter-spacing: -0.5px;">
                    SpendSense
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="font-size: 20px; font-weight: 700; color: #ffffff; padding-bottom: 12px; text-align: center;">
              Reset Your Password
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td style="font-size: 14px; line-height: 1.6; color: #94a3b8; padding-bottom: 28px; text-align: center;">
              We received a request to reset the password for your SpendSense account. Click the button below to set a new password.
            </td>
          </tr>

          <!-- Call to Action Button -->
          <tr>
            <td align="center" style="padding-bottom: 28px;">
              <a href="${resetUrl}" target="_blank" style="display: inline-block; background-color: #10b981; color: #0f172a; font-size: 14px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
                Reset Password
              </a>
            </td>
          </tr>

          <!-- Expiry Notice -->
          <tr>
            <td style="font-size: 12px; color: #64748b; line-height: 1.5; padding-bottom: 20px; text-align: center; border-top: 1px solid #1e293b; padding-top: 20px;">
              This password reset link will expire in <strong>1 hour</strong>.
            </td>
          </tr>

          <!-- Security Notice -->
          <tr>
            <td style="font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;">
              If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const textContent = `Reset your SpendSense password by visiting the following URL: ${resetUrl}\n\nThis link will expire in 1 hour. If you did not request a password reset, please ignore this email.`;

    await this.transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: 'Reset your SpendSense password',
      text: textContent,
      html: htmlContent,
    });
  }
}

export default new EmailService();
