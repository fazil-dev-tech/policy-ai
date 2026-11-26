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

const sendOtpEmail = async (to, otp) => {
    const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: auto; background: #0f172a; color: #e2e8f0; border-radius: 16px; padding: 32px; border: 1px solid #334155;">
      <h1 style="margin: 0 0 8px; color: #f8fafc; text-align: center;">Policy<span style="color: #d946ef;">AI</span></h1>
      <p style="margin: 0 0 24px; color: #94a3b8; text-align: center; font-size: 13px;">Secure Authentication</p>
      <p style="margin: 0 0 16px;">Use the verification code below to continue:</p>
      <div style="background: #1e293b; border: 1px solid #d946ef; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
        <span style="font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #f472b6;">${otp}</span>
      </div>
      <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">This code expires in 10 minutes.</p>
    </div>`;

    const result = await sendEmail({
        to,
        subject: 'Your PolicyAI Login Code',
        html,
        text: `Your PolicyAI verification code is: ${otp}. It expires in 10 minutes.`,
    });

    if (!result.success) {
        throw new Error(result.error || 'Failed to send OTP email');
    }
    return true;
};

module.exports = {
    sendEmail,
    sendOtpEmail,
};
