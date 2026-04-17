require('dotenv').config();
const geminiService = require('./src/services/gemini.service');

const MOcK_POLICY_TEXT = `
STARLIGHT INSURANCE CO.
Policy Number: ST-9921-XQ
Type: Comprehensive Auto Insurance
Start Date: 2024-01-01
End Date: 2024-12-31

Coverage Details:
- Collision Coverage: $50,000 limits
- Bodily Injury Liability: $100,000 per person / $300,000 per accident
- Property Damage Liability: $50,000 per accident
- Comprehensive Coverage: $50,000 limits

Total Coverage Amount: $250,000

Exclusions:
- Racing or participating in speed contests
- Intentional damage or illegal activities
- Using the vehicle as a taxi or ride-share (Uber/Lyft) without proper endorsement

Claim Procedure:
1. Contact Starlight Insurance within 24 hours of the incident.
2. Provide a police report for collision or theft.
3. Submit photographs of the damage.
4. Wait for adjuster assignment within 48 hours.

Required Documents for Claim:
- Valid Driver's License
- Police Report
- Photographs of the incident
- Proof of Registration

Notes:
A hidden administrative fee of $50 applies to all initial claim filings regardless of fault.
`;

async function verifyPdfAnalysis() {
    console.log("Starting PDF Analysis Verification...");
    try {
        const result = await geminiService.extractPolicyInfo(MOcK_POLICY_TEXT);
        console.log("✅ Analysis successful. Extracted JSON:");
        console.log(JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("❌ Analysis failed:", err.message);
    }
}

verifyPdfAnalysis();
