const fs = require('fs');
try {
    const file = 'src/pages/AnalyzerPage.jsx';
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/\\`/g, '`').replace(/\\\$/g, '$');
    fs.writeFileSync(file, content);
    console.log('Successfully fixed AnalyzerPage.jsx');
} catch (err) {
    console.error('Failed:', err);
}
