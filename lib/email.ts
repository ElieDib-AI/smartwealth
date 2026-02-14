import nodemailer from 'nodemailer'

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com'
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587')
const SMTP_USER = process.env.SMTP_USER || ''
const SMTP_PASS = process.env.SMTP_PASS || ''
const SMTP_FROM = process.env.SMTP_FROM || 'SmartWealth <noreply@fundamental.app>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
})

export async function sendVerificationEmail(email: string, token: string, name?: string) {
  const verificationUrl = `${APP_URL}/api/auth/verify?token=${token}`
  const displayName = name || email.split('@')[0]

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);">
                  <div style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #059669 0%, #22c55e 100%); border-radius: 12px; margin-bottom: 20px;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">SmartWealth</h1>
                  </div>
                  <h2 style="margin: 0; color: #111827; font-size: 28px; font-weight: bold;">Verify Your Email</h2>
                </td>
              </tr>
              
              <!-- Body -->
              <tr>
                <td style="padding: 40px; color: #6b7280; font-size: 16px; line-height: 1.6;">
                  <p style="margin: 0 0 20px; color: #111827; font-size: 18px;">Hey ${displayName}! 👋</p>
                  <p style="margin: 0 0 20px;">Welcome to <strong style="color: #059669;">SmartWealth</strong>! We're excited to have you join us.</p>
                  <p style="margin: 0 0 30px;">Click the button below to verify your email address and get started:</p>
                  
                  <!-- CTA Button -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${verificationUrl}" style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #059669 0%, #22c55e 100%); color: #ffffff; text-decoration: none; font-weight: bold; font-size: 18px; border-radius: 12px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);">
                          Verify Email Address
                        </a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 30px 0 20px; font-size: 14px; color: #9ca3af;">If the button doesn't work, copy and paste this link into your browser:</p>
                  <p style="margin: 0 0 30px; word-break: break-all; font-size: 14px; color: #059669;">
                    <a href="${verificationUrl}" style="color: #059669; text-decoration: none;">${verificationUrl}</a>
                  </p>
                  
                  <div style="margin: 30px 0 0; padding: 20px; background-color: #f3f4f6; border-radius: 8px; border-left: 4px solid #059669;">
                    <p style="margin: 0; font-size: 14px; color: #6b7280;">
                      ⏰ This verification link expires in <strong style="color: #111827;">24 hours</strong>. If you didn't create an account, you can safely ignore this email.
                    </p>
                  </div>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; background-color: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0 0 10px; font-size: 14px; color: #6b7280;">
                    <strong style="color: #059669;">SmartWealth</strong> - Your SaaS Template
                  </p>
                  <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                    Built with Next.js, React, and MongoDB
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  const textContent = `
Hey ${displayName}!

Welcome to SmartWealth! We're excited to have you join us.

Click the link below to verify your email address and get started:

${verificationUrl}

This verification link expires in 24 hours. If you didn't create an account, you can safely ignore this email.

---
SmartWealth - Your SaaS Template
Built with Next.js, React, and MongoDB
  `.trim()

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to: email,
      subject: 'Verify your SmartWealth account',
      text: textContent,
      html: htmlContent,
    })
    return { success: true }
  } catch (error) {
    console.error('Email send error:', error)
    return { success: false, error: 'Failed to send email' }
  }
}

export async function sendPasswordResetEmail(email: string, token: string, name?: string) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`
  const displayName = name || email.split('@')[0]

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden;">
              <tr>
                <td style="padding: 40px; text-align: center;">
                  <h1 style="color: #059669; font-size: 24px; margin-bottom: 20px;">SmartWealth</h1>
                  <h2 style="color: #111827; font-size: 28px; margin-bottom: 20px;">Reset Your Password</h2>
                  <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                    Hey ${displayName}, we received a request to reset your password. Click the button below to create a new password:
                  </p>
                  <a href="${resetUrl}" style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #059669 0%, #22c55e 100%); color: #ffffff; text-decoration: none; font-weight: bold; font-size: 18px; border-radius: 12px;">
                    Reset Password
                  </a>
                  <p style="color: #9ca3af; font-size: 14px; margin-top: 30px;">
                    Link expires in 1 hour. If you didn't request this, ignore this email.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `

  const textContent = `
Hey ${displayName},

We received a request to reset your password for SmartWealth.

Click the link below to create a new password:
${resetUrl}

This link expires in 1 hour. If you didn't request this, you can safely ignore this email.

---
SmartWealth - Your SaaS Template
  `.trim()

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to: email,
      subject: 'Reset your SmartWealth password',
      text: textContent,
      html: htmlContent,
    })
    return { success: true }
  } catch (error) {
    console.error('Email send error:', error)
    return { success: false, error: 'Failed to send email' }
  }
}
