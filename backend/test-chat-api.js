async function testChatApi() {
    try {
        console.log('1. Registering test user...');
        const uniqueEmail = `test${Date.now()}@example.com`;

        let res = await fetch('http://localhost:5000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test User',
                email: uniqueEmail,
                role: 'user',
                password: 'Password123!',
                passwordConfirm: 'Password123!'
            })
        });

        // Might already exist or fail, ignoring error for now if it's just dup email
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

        console.log('3. Sending chat message...');
        res = await fetch('http://localhost:5000/api/chat/message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                message: 'Hello, what can you do?',
                aiModel: 'puter'
            })
        });

        if (!res.ok) throw new Error(`Chat API failed: ${await res.text()}`);
        const chatData = await res.json();

        console.log('✅ Chat API response:', chatData.aiResponse);

    } catch (error) {
        console.error('❌ Error during chat API test:', error.message);
    }
}

testChatApi();
