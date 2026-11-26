const { sendEmail } = require('./email.service');
const logger = require('../utils/logger');

const sendClaimStatusEmail = async (userEmail, userName, claimData) => {
    const statusColors = {
        pending: '#f59e0b',
        under_review: '#3b82f6',
        approved: '#10b981',
        rejected: '#ef4444',
        settled: '#8b5cf6',
    };

    const html = `
    <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: auto; background: #1a1a2e; color: #e0e0e0; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 30px; text-align: center;">
        <h1 style="margin: 0; color: #fff; font-size: 24px;">PolicyAI</h1>
        <p style="margin: 5px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">Claim Status Update</p>
      </div>
      <div style="padding: 30px;">
        <p>Hello <strong>${userName}</strong>,</p>
        <p>Your claim status has been updated:</p>
        <div style="background: #16213e; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p><strong>Policy:</strong> ${claimData.policyNumber}</p>
          <p><strong>Claim Amount:</strong> ₹${claimData.claimAmount?.toLocaleString()}</p>
          <p><strong>Status:</strong> <span style="color: ${statusColors[claimData.claimStatus] || '#fff'}; font-weight: bold; text-transform: uppercase;">${claimData.claimStatus?.replace('_', ' ')}</span></p>
        </div>
        <p style="color: #888; font-size: 12px;">This is an automated notification from PolicyAI. Do not reply to this email.</p>
      </div>
    </div>`;

    return sendEmail({
        to: userEmail,
        subject: `Claim Status Update - ${claimData.claimStatus?.replace('_', ' ').toUpperCase()}`,
        html,
        text: `Hello ${userName}, your claim for policy ${claimData.policyNumber} has been updated to: ${claimData.claimStatus}. Amount: ₹${claimData.claimAmount}`,
    });
};

const sendSMS = async (phoneNumber, message) => {
    try {
        logger.info(`SMS stub to ${phoneNumber}: ${message}`);
        return { success: true, message: 'SMS sent (stub)' };
    } catch (error) {
        logger.error('SMS send failed:', error.message);
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendEmail,
    sendClaimStatusEmail,
    sendSMS,
};
