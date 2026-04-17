require('dotenv').config();
const { init } = require('@heyputer/puter.js/src/init.cjs');

async function testPuter() {
    console.log('Testing Puter.js...');

    if (!process.env.PUTER_AUTH_TOKEN) {
        console.log('PUTER_AUTH_TOKEN is not defined in .env! Testing anonymously or failing if required.');
    }

    const puter = init(process.env.PUTER_AUTH_TOKEN || undefined);

    try {
        const response = await puter.ai.chat("What color was Napoleon's white horse?");

        console.log('\n✅ SUCCESS!');

        // Attempting to extract text generically
        let text = response;
        if (typeof response !== 'string') {
            text = response?.message?.content || response?.text || JSON.stringify(response);
        }

        console.log('Response:', text);
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
    }
}

testPuter();
