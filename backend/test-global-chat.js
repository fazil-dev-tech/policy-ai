// testGlobalChatApi using fetch

async function testGlobalChatApi() {
    try {
        console.log('1. Registering test user...');
        const uniqueEmail = `globaltest${Date.now()}@example.com`;

        // We'll use fetch as we did before since axios isn't installed
        let res = await fetch('http://localhost:5000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Global Test User',
                email: uniqueEmail,
                role: 'user',
                password: 'Password123!',
                passwordConfirm: 'Password123!'
            })
        });

        console.log('2. Logging in...');
        res = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: uniqueEmail,
                password: 'Password123!'
            })
        });

        if (!res.ok) throw new Error(`Login failed: ${await res.text()}`);
        const loginData = await res.json();
        const token = loginData.accessToken;

        console.log('3. Sending GLOBAL chat message (No Policy ID)...');
        res = await fetch('http://localhost:5000/api/chat/message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                message: 'What is the capital of France? Answer in one word.',
                aiModel: 'puter'
                // Intentionally omitting policyId
            })
        });

        if (!res.ok) throw new Error(`Chat API failed: ${await res.text()}`);
        const chatData = await res.json();

        console.log('✅ Global Chat API response:', chatData.aiResponse);

    } catch (error) {
        console.error('❌ Error during global chat test:', error.message);
    }
}

testGlobalChatApi();
