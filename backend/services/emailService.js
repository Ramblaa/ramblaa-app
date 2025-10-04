import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

class EmailService {
  constructor() {
    // Create transporter based on environment
    if (process.env.NODE_ENV === 'production') {
      // Production: Use real SMTP service (Gmail, SendGrid, etc.)
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      // Development: Create test account with Ethereal Email
      this.setupTestAccount();
    }
  }

  async setupTestAccount() {
    try {
      // Generate test SMTP service account from ethereal.email
      const testAccount = await nodemailer.createTestAccount();
      
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      
      console.log('📧 Test email account created:');
      console.log('   User:', testAccount.user);
      console.log('   Pass:', testAccount.pass);
    } catch (error) {
      console.error('Failed to create test account:', error);
      // Fallback to a simple console log
      this.transporter = {
        sendMail: async (options) => {
          console.log('📧 Would send email:', {
            to: options.to,
            subject: options.subject,
            preview: `Email would be sent to ${options.to}`
          });
          return { messageId: 'test-message-id' };
        }
      };
    }
  }

  async sendVerificationEmail(email, firstName, verificationToken) {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5174'}/verify-email?token=${verificationToken}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verify Your Email - Ramble</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
          }
          .header { 
            background: linear-gradient(135deg, #8B5CF6, #1F2937); 
            color: white; 
            padding: 30px; 
            border-radius: 8px 8px 0 0; 
            text-align: center; 
          }
          .logo { 
            width: 60px; 
            height: 60px; 
            background: rgba(255, 255, 255, 0.2); 
            border-radius: 50%; 
            display: inline-flex; 
            align-items: center; 
            justify-content: center; 
            font-size: 24px; 
            font-weight: bold; 
            margin-bottom: 15px; 
          }
          .content { 
            background: #fff; 
            padding: 40px; 
            border: 1px solid #e5e7eb; 
            border-top: none; 
          }
          .button { 
            display: inline-block; 
            background: #8B5CF6; 
            color: white; 
            padding: 12px 30px; 
            text-decoration: none; 
            border-radius: 6px; 
            margin: 20px 0; 
            font-weight: 500; 
          }
          .footer { 
            background: #f9fafb; 
            padding: 20px; 
            border: 1px solid #e5e7eb; 
            border-top: none; 
            border-radius: 0 0 8px 8px; 
            font-size: 14px; 
            color: #6b7280; 
            text-align: center; 
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">R</div>
          <h1 style="margin: 0;">Welcome to Ramble!</h1>
        </div>
        
        <div class="content">
          <p>Hi ${firstName},</p>
          
          <p>Thanks for signing up for Ramble! To complete your account setup and start managing your property communications, please verify your email address.</p>
          
          <div style="text-align: center;">
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
          </div>
          
          <p>If the button above doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #8B5CF6;">${verificationUrl}</p>
          
          <p><strong>This verification link will expire in 24 hours.</strong></p>
          
          <p>If you didn't create an account with Ramble, you can safely ignore this email.</p>
          
          <p>Best regards,<br>The Ramble Team</p>
        </div>
        
        <div class="footer">
          <p>© 2025 Ramble. All rights reserved.</p>
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Hi ${firstName},

      Thanks for signing up for Ramble! To complete your account setup, please verify your email address.

      Click here to verify: ${verificationUrl}

      This verification link will expire in 24 hours.

      If you didn't create an account with Ramble, you can safely ignore this email.

      Best regards,
      The Ramble Team
    `;

    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@rambley.com',
      to: email,
      subject: 'Verify Your Email Address - Ramble',
      text: textContent,
      html: htmlContent,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 Verification email sent!');
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
      }
      
      return {
        success: true,
        messageId: info.messageId,
        previewUrl: process.env.NODE_ENV === 'development' ? nodemailer.getTestMessageUrl(info) : null
      };
    } catch (error) {
      console.error('💥 Failed to send verification email:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendWelcomeEmail(email, firstName) {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to Ramble!</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
          }
          .header { 
            background: linear-gradient(135deg, #8B5CF6, #1F2937); 
            color: white; 
            padding: 30px; 
            border-radius: 8px; 
            text-align: center; 
          }
          .logo { 
            width: 60px; 
            height: 60px; 
            background: rgba(255, 255, 255, 0.2); 
            border-radius: 50%; 
            display: inline-flex; 
            align-items: center; 
            justify-content: center; 
            font-size: 24px; 
            font-weight: bold; 
            margin-bottom: 15px; 
          }
          .content { 
            background: #fff; 
            padding: 40px; 
            border: 1px solid #e5e7eb; 
          }
          .footer { 
            background: #f9fafb; 
            padding: 20px; 
            border: 1px solid #e5e7eb; 
            border-top: none; 
            border-radius: 0 0 8px 8px; 
            font-size: 14px; 
            color: #6b7280; 
            text-align: center; 
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">R</div>
          <h1 style="margin: 0;">Welcome to Ramble!</h1>
        </div>
        
        <div class="content">
          <p>Hi ${firstName},</p>
          
          <p>🎉 Congratulations! Your email has been verified and your Ramble account is now active.</p>
          
          <p>You can now sign in and start managing your property communications with ease. Ramble helps you streamline guest interactions and automate responses to make hosting simpler.</p>
          
          <p>Ready to get started? <a href="${process.env.FRONTEND_URL || 'http://localhost:5174'}" style="color: #8B5CF6;">Sign in to your account</a></p>
          
          <p>If you have any questions, feel free to reach out to our support team.</p>
          
          <p>Best regards,<br>The Ramble Team</p>
        </div>
        
        <div class="footer">
          <p>© 2025 Ramble. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@rambley.com',
      to: email,
      subject: 'Welcome to Ramble - Account Verified!',
      html: htmlContent,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 Welcome email sent!');
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
      }
      
      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      console.error('💥 Failed to send welcome email:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new EmailService();