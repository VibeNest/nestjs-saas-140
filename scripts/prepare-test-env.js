const fs = require('fs');
const path = require('path');

const envTestPath = path.join(__dirname, '..', '.env.test');
const envTestExamplePath = path.join(__dirname, '..', '.env.test.example');

if (!fs.existsSync(envTestPath)) {
  fs.copyFileSync(envTestExamplePath, envTestPath);
  console.log('Created .env.test from .env.test.example');
}
