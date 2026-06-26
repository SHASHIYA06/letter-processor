import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { exec } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'credentials', 'oauth-config.json');
const TOKEN_PATH = path.join(__dirname, 'credentials', 'oauth-tokens.json');
const REDIRECT_URI = 'http://localhost:3000/auth/google/callback';

async function setup() {
  console.log('=== GOOGLE DRIVE OAUTH2 SETUP ===\n');

  // Check if tokens already exist
  if (fs.existsSync(TOKEN_PATH)) {
    console.log('✅ Tokens already exist! Testing...');
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    
    const oauth2Client = new google.auth.OAuth2(
      config.client_id,
      config.client_secret,
      REDIRECT_URI
    );
    oauth2Client.setCredentials(tokens);
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    try {
      const res = await drive.about.get({ fields: 'user.displayName,user.emailAddress' });
      console.log(`✅ Authenticated as: ${res.data.user.displayName} (${res.data.user.emailAddress})`);
      console.log('\nRun: node server.js');
      return;
    } catch (e) {
      console.log('⚠️ Tokens expired, re-authenticating...');
      fs.unlinkSync(TOKEN_PATH);
    }
  }

  // Check if config exists
  if (!fs.existsSync(CONFIG_PATH)) {
    console.log('📋 SETUP INSTRUCTIONS:');
    console.log('─'.repeat(50));
    console.log('1. Go to: https://console.cloud.google.com/apis/credentials');
    console.log('2. Click "+ CREATE CREDENTIALS" → "OAuth client ID"');
    console.log('3. If prompted, configure OAuth consent screen first:');
    console.log('   - User type: External');
    console.log('   - App name: Letter Processor');
    console.log('   - Add your email as contact');
    console.log('   - Save through all steps');
    console.log('   - Add your email as test user');
    console.log('4. Create OAuth client ID:');
    console.log('   - Application type: Web application');
    console.log('   - Name: Letter Processor');
    console.log('   - Redirect URI: ' + REDIRECT_URI);
    console.log('5. Copy the Client ID and Client Secret\n');
    
    const client_id = await ask('Enter Client ID: ');
    const client_secret = await ask('Enter Client Secret: ');
    
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ client_id, client_secret }, null, 2));
    console.log('✅ Config saved\n');
  }

  // Start OAuth flow
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const oauth2Client = new google.auth.OAuth2(
    config.client_id,
    config.client_secret,
    REDIRECT_URI
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
    prompt: 'consent'
  });

  console.log('🔗 Opening browser for authorization...');
  console.log('   If browser doesn\'t open, visit:\n');
  console.log(authUrl + '\n');

  // Open browser
  const platform = process.platform;
  if (platform === 'darwin') exec(`open "${authUrl}"`);
  else if (platform === 'win32') exec(`start "${authUrl}"`);
  else exec(`xdg-open "${authUrl}"`);

  // Start local server to receive callback
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost:3000');
    if (url.pathname === '/auth/google/callback') {
      const code = url.searchParams.get('code');
      if (!code) {
        res.writeHead(400);
        res.end('No authorization code');
        return;
      }
      try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const about = await drive.about.get({ fields: 'user.displayName,user.emailAddress' });

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>✅ Google Drive Connected!</h1><p>You can close this tab.</p>');

        console.log(`✅ Authenticated as: ${about.data.user.displayName} (${about.data.user.emailAddress})`);
        console.log('✅ Tokens saved to credentials/oauth-tokens.json');
        console.log('\nRun: node server.js');

        server.close();
        process.exit(0);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h1>❌ Auth Failed</h1><p>' + err.message + '</p>');
        console.error('❌ Auth failed:', err.message);
      }
    }
  });

  server.listen(3000, () => {
    console.log('⏳ Waiting for authorization...');
  });
}

function ask(question) {
  return new Promise(resolve => {
    process.stdout.write(question);
    process.stdin.once('data', data => resolve(data.toString().trim()));
  });
}

setup().catch(console.error);
