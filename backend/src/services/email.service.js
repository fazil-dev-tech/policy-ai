const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// SMTP configuration based on provided environment/credentials
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for 587
    auth: {
        user: 'mohamedfazilpasha156@gmail.com', // As provided by user
        pass: 'thfpkptsisxrlabk', // As provided by user (New App Password without spaces)
    },
});

/**
 * Send an OTP email to the user.
 * @param {string} to - The recipient's email address
 * @param {string} otp - The 6-digit OTP code to send
 */
const sendOtpEmail = async (to, otp) => {
    try {
        const mailOptions = {
            from: '"PolicyAI Security" <noreply@policyai.com>',
            to,
            subject: 'Your PolicyAI Login Code',
            html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
                    
                    /* Simulated 3D Core Breathing Effect for Email Clients */
                    @keyframes pulseGlow {
                        0% { box-shadow: 0 0 10px rgba(217, 70, 239, 0.2); border-color: #fbcfe8; }
                        50% { box-shadow: 0 0 25px rgba(217, 70, 239, 0.6); border-color: #d946ef; }
                        100% { box-shadow: 0 0 10px rgba(217, 70, 239, 0.2); border-color: #fbcfe8; }
                    }
                    
                    /* Entrance Animation */
                    @keyframes floatUp {
                        from { transform: translateY(20px); opacity: 0; }
                        to { transform: translateY(0); opacity: 1; }
                    }
                    
                    .otp-box {
                        background: linear-gradient(145deg, #ffffff, #fdf2f8);
                        border-radius: 12px; 
                        padding: 30px 24px; 
                        text-align: center; 
                        margin: 30px 0; 
                        border: 2px solid #fbcfe8;
                        animation: pulseGlow 3s infinite ease-in-out, floatUp 0.8s ease-out forwards;
                    }
                    
                    .brand-title {
                        margin: 0; color: #1e293b; font-size: 36px; font-weight: 800; letter-spacing: -1px;
                        animation: floatUp 0.5s ease-out forwards;
                    }
                </style>
            </head>
            <body style="margin: 0; padding: 0; background-color: #0f172a;"> <!-- Deep space dark mode background -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f172a; padding: 60px 20px;">
                    <tr>
                        <td align="center">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #1e293b; border-radius: 20px; overflow: hidden; border: 1px solid #334155; box-shadow: 0 20px 40px rgba(0,0,0,0.4);">
                                
                                <!-- Header -->
                                <tr>
                                    <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 2px solid #334155; position: relative;">
                                        <!-- Simulated 3D lighting gradient -->
                                        <div style="position: absolute; top: -50px; left: 50%; transform: translateX(-50%); width: 200px; height: 100px; background: radial-gradient(circle, rgba(217,70,239,0.3) 0%, rgba(30,41,59,0) 70%); border-radius: 50%;"></div>
                                        
                                        <h1 class="brand-title" style="color: #f8fafc; position: relative; z-index: 1;">Policy<span style="color: #d946ef;">AI</span></h1>
                                        <p style="color: #94a3b8; font-size: 14px; margin-top: 8px; font-weight: 500; letter-spacing: 2px; text-transform: uppercase;">Secure Terminal</p>
                                    </td>
                                </tr>
                                
                                <!-- Body Content -->
                                <tr>
                                    <td style="padding: 40px;">
                                        <h2 style="margin: 0 0 16px 0; color: #f1f5f9; font-size: 20px; font-weight: 600;">Identity Payload Ready</h2>
                                        <p style="margin: 0 0 10px 0; color: #cbd5e1; font-size: 15px; line-height: 1.6;">
                                            We received a request to access your intelligence dashboard.
                                        </p>
                                        <p style="margin: 0 0 24px 0; color: #94a3b8; font-size: 14px; line-height: 1.6;">
                                            Copy the secure orbital access key below to proceed.
                                        </p>
                                        
                                        <!-- Animated OTP Box -->
                                        <div class="otp-box">
                                            <span style="font-family: 'Courier New', Courier, monospace; font-size: 48px; font-weight: 900; color: #ec4899; letter-spacing: 16px; text-shadow: 0 0 15px rgba(236,72,153,0.4); margin-left: 16px;">${otp}</span>
                                        </div>
                                        
                                        <!-- Warning Footer -->
                                        <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6; text-align: center; background: rgba(15, 23, 42, 0.5); padding: 16px; border-radius: 8px; border: 1px solid #334155;">
                                            Decryption key expires in <strong>10 minutes</strong>.<br>
                                            If this was an unauthorized ping, ignore this protocol.
                                        </p>
                                    </td>
                                </tr>
                                
                                <!-- True Footer -->
                                <tr>
                                    <td style="background-color: #0f172a; padding: 20px 40px; text-align: center; border-top: 1px solid #334155;">
                                        <p style="margin: 0; color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
                                            SECURE SERVER • POLICYAI • END-TO-END ENCRYPTED
                                        </p>
                                    </td>
                                </tr>
                                
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        logger.info(`OTP email sent to ${to}: ${info.messageId}`);
        return true;
    } catch (error) {
        logger.error('Error sending OTP email:', error);
        throw error;
    }
};

module.exports = {
    sendOtpEmail,
};
