require('dotenv').config();
const geminiService = require('./src/services/gemini.service');

const MOCK_GENERIC_TEXT = `
Q3 ENGINEERING REPORT
Author: ACME Corp
Date: 2024-10-15
Project ID: PRJ-993-ENG

Overview:
This quarter focused on migrating the monolithic backend architecture into microservices. We successfully deployed 4 new services (Auth, Users, Billing, Data) to the staging environment. 

Action Items:
1. Conduct load testing on the new Billing service.
2. Schedule a security audit for the Auth service by Nov 1.
3. Migrate production databases over the weekend of Nov 15.

Risks & Limitations:
- The logging infrastructure is currently dropping ~2% of logs under heavy load.
- We have not yet secured compliance sign-off for EU user data migration.
- Budget constraints mean we cannot hire the additional dev-ops engineer requested.

Required References:
- Architecture Design Doc (v2.1)
- Security Compliance Checklist (ISO 27001)

Total Project Budget Used: 150,000
`;

async function verifyGenericPdf() {
    console.log("Starting Generic PDF Analysis Verification...");
    try {
        const result = await geminiService.extractPolicyInfo(MOCK_GENERIC_TEXT);
        console.log("✅ Analysis successful. Extracted JSON:");
        console.log(JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("❌ Analysis failed:", err.message);
    }
}

verifyGenericPdf();
