import type { Env } from "../index.js";

interface SendEmailParams {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
}

/**
 * Send transactional email via MailChannels from Cloudflare Workers.
 * MailChannels is free for Cloudflare Workers with a special header.
 *
 * @see https://blog.cloudflare.com/sending-email-from-workers-with-mailchannels/
 */
export async function sendEmail(
  env: Env,
  params: SendEmailParams,
): Promise<boolean> {
  try {
    const response = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": env.MAILCHANNELS_API_KEY,
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: params.to, name: params.to.split("@")[0] }],
            dkim_domain: "ironlox.com",
            dkim_selector: "mailchannels",
            dkim_private_key: env.MAILCHANNELS_API_KEY,
          },
        ],
        from: {
          email: "noreply@ironlox.com",
          name: "Ironlox",
        },
        subject: params.subject,
        content: [
          { type: "text/plain", value: params.textBody },
          { type: "text/html", value: params.htmlBody },
        ],
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

export function getVerificationEmail(
  _to: string,
  code: string,
): { subject: string; htmlBody: string; textBody: string } {
  return {
    subject: "Verify your Ironlox email",
    textBody: `Welcome to Ironlox! Your verification code is: ${code}`,
    htmlBody: `
      <html>
        <body style="font-family: Inter, sans-serif; background: #111; color: #eee; padding: 20px;">
          <h1 style="color: #fff;">Welcome to Ironlox</h1>
          <p>Your verification code is:</p>
          <p style="font-size: 24px; font-family: JetBrains Mono, monospace; letter-spacing: 4px; color: #fff;">${code}</p>
          <p style="color: #888; font-size: 12px;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
        </body>
      </html>`,
  };
}

export function getLoginAlertEmail(
  _to: string,
  info: { ipCountry: string; userAgent: string; timestamp: string },
): { subject: string; htmlBody: string; textBody: string } {
  return {
    subject: "New login to your Ironlox account",
    textBody: `A new login was detected on your Ironlox account.\n\nLocation: ${info.ipCountry}\nDevice: ${info.userAgent}\nTime: ${info.timestamp}\n\nIf this wasn't you, change your master password immediately.`,
    htmlBody: `
      <html>
        <body style="font-family: Inter, sans-serif; background: #111; color: #eee; padding: 20px;">
          <h1 style="color: #fff;">New Login Detected</h1>
          <p style="color: #ff6b6b; font-weight: bold;">A new device logged into your Ironlox account.</p>
          <table style="color: #ccc;">
            <tr><td style="padding: 4px 8px;">Location:</td><td style="color: #fff;">${info.ipCountry}</td></tr>
            <tr><td style="padding: 4px 8px;">Device:</td><td style="color: #fff;">${info.userAgent}</td></tr>
            <tr><td style="padding: 4px 8px;">Time:</td><td style="color: #fff;">${info.timestamp}</td></tr>
          </table>
          <p style="color: #ff6b6b;">If this wasn't you, change your master password immediately.</p>
        </body>
      </html>`,
  };
}

export function getDeletionEmail(
  _to: string,
  daysRemaining: number,
): { subject: string; htmlBody: string; textBody: string } {
  return {
    subject: "Your Ironlox account will be deleted",
    textBody: `Your Ironlox account deletion has been initiated. Your data will be permanently deleted in ${daysRemaining} days. Log in to cancel the deletion.`,
    htmlBody: `
      <html>
        <body style="font-family: Inter, sans-serif; background: #111; color: #eee; padding: 20px;">
          <h1 style="color: #ff6b6b;">Account Deletion Initiated</h1>
          <p>Your Ironlox account will be permanently deleted in <strong>${daysRemaining} days</strong>.</p>
          <p>To cancel the deletion, log into your account before the grace period expires.</p>
        </body>
      </html>`,
  };
}
