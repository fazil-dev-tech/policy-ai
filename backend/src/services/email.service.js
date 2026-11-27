const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('../utils/logger');

let transporter = null;

const getTransporter = () => {
    if (transporter) return transporter;

    if (!env.SMTP_USER || !env.SMTP_PASS) {
        throw new Error('SMTP credentials (SMTP_USER / SMTP_PASS) are not configured.');
    }

    const port = parseInt(env.SMTP_PORT, 10) || 587;
    transporter = nodemailer.createTransport({
        host: env.SMTP_HOST || 'smtp.gmail.com',
        port,
        secure: port === 465,
        connectionTimeout: 6000,
        greetingTimeout: 6000,
        socketTimeout: 8000,
        auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
        },
    });

    return transporter;
};

const sendEmail = async ({ to, subject, html, text }) => {
    try {
        const mailer = getTransporter();
        const fromEmail = env.SMTP_FROM || env.SMTP_USER;
        const senderName = env.SMTP_SENDER_NAME || 'Team_WIE_Quantum_Coders';

        const info = await mailer.sendMail({
            from: `"${senderName}" <${fromEmail}>`,
            to,
            subject,
            html,
            text,
        });

        logger.info(`Email sent: ${info.messageId} to ${to}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        transporter = null;
        logger.error('Email send failed:', error.message);
        return { success: false, error: error.message };
    }
};

const escapeHtml = (str = '') =>
    String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const buildOtpEmailPayload = (otp, { mode = 'signup', userName = '' } = {}) => {
    const cleanOtp = String(otp || '').trim();
    const isSignup = mode === 'signup';
    const firstName = String(userName || '').trim().split(/\s+/)[0];
    const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hello,';
    const title = isSignup ? 'Verify your email code' : 'Your sign-in verification code';
    const subtitle = isSignup
        ? 'Enter this 6-digit verification code in PolicyGuard AI to finish creating your account:'
        : 'Enter this 6-digit verification code in PolicyGuard AI to sign in securely:';

    const html = `
    <div style="background:#f8fafc;padding:28px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
      <div style="max-width:460px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.06);">
        <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 65%,#0369a1 100%);padding:20px 24px;text-align:center;">
          <div style="display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(56,189,248,0.16);border:1px solid rgba(56,189,248,0.35);color:#7dd3fc;font-size:11px;font-weight:700;letter-spacing:0.6px;margin-bottom:8px;">
            POLICYGUARD AI · SECURE VERIFICATION
          </div>
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">${title}</h1>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 10px;font-size:14px;color:#334155;">${greeting}</p>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#475569;">${subtitle}</p>
          <div style="background:#f1f5f9;border:1.5px solid #0ea5e9;border-radius:12px;padding:18px 14px;text-align:center;margin:0 0 18px;">
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:34px;font-weight:800;letter-spacing:10px;color:#0f172a;">${escapeHtml(cleanOtp)}</span>
          </div>
          <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;text-align:center;">
            This code expires in <strong>10 minutes</strong>.<br/>
            If you did not request this, you can safely ignore this email. Never share this code with anyone.
          </p>
        </div>
      </div>
    </div>`;

    const subject = isSignup
        ? `PolicyGuard AI — Verification Code (${cleanOtp})`
        : `PolicyGuard AI — Sign-In Code (${cleanOtp})`;
    const text = `${firstName ? `Hi ${firstName},\n\n` : ''}Your PolicyGuard AI verification code is: ${cleanOtp}\n\nEnter this code in PolicyGuard AI (expires in 10 minutes). Never share this code with anyone.`;

    return { subject, html, text };
};

const sendOtpEmail = async (to, otp, options = {}) => {
    const { subject, html, text } = buildOtpEmailPayload(otp, options);
    const result = await sendEmail({
        to,
        subject,
        html,
        text,
    });

    if (!result.success) {
        throw new Error(result.error || 'Failed to send OTP email');
    }
    return true;
};

module.exports = {
    sendEmail,
    sendOtpEmail,
    buildOtpEmailPayload,
};
