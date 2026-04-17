require('dotenv').config();
const OpenAI = require('openai');

async function testOpenAI() {
    console.log('Testing OpenAI API...');
    console.log('Using API Key starting with:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.slice(0, 10) + '...' : 'UNDEFINED');

    const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        const completion = await client.chat.completions.create({
            model: "gpt-4o-mini", // Using mini just for a fast test
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

testOpenAI();
