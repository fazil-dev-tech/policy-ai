require('dotenv').config();
const OpenAI = require('openai');

async function testGrok() {
    console.log('Testing Grok API...');
    console.log('Using API Key ending in:', process.env.GROK_API_KEY ? process.env.GROK_API_KEY.slice(-4) : 'UNDEFINED');

    const client = new OpenAI({
        apiKey: process.env.GROK_API_KEY,
        baseURL: process.env.GROK_API_BASE_URL || 'https://api.x.ai/v1',
    });

    try {
        const completion = await client.chat.completions.create({
            model: "grok-4-latest",
            messages: [
                { role: "system", content: "You are a test assistant." },
                { role: "user", content: "Testing. Just say hi and hello world and nothing else." }
            ],
            stream: false,
            temperature: 0
        });

        console.log('\n✅ SUCCESS!');
        console.log('Response:', completion.choices[0].message.content);
    } catch (error) {
        console.error('\n❌ ERROR:');
        if (error.response) {
            console.error(error.response.status, error.response.data);
        } else {
            console.error(error.message);
        }
    }
}

testGrok();
