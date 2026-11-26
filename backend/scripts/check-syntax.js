const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full);
        } else if (full.endsWith('.js')) {
            execFileSync(process.execPath, ['--check', full], { stdio: 'inherit' });
        }
    }
}

walk(path.join(__dirname, '..', 'src'));
console.log('Syntax check passed for all files in backend/src');
