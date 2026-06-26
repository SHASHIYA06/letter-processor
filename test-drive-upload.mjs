import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testUpload() {
  const configPath = path.join(__dirname, 'credentials', 'oauth-config.json');
  const tokenPath = path.join(__dirname, 'credentials', 'oauth-tokens.json');

  const { client_id, client_secret } = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));

  const oauth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3000/auth/google/callback');
  oauth2Client.setCredentials(tokens);

  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '1M3k66ROJSNVUe-TB5rcF4bJ0O6obBGRp';

  console.log('✅ Authenticated via OAuth2');

  // Check folder
  try {
    const folderCheck = await drive.files.get({ fileId: DRIVE_FOLDER_ID, fields: 'id, name', supportsAllDrives: true });
    console.log(`📁 Folder: "${folderCheck.data.name}"`);
  } catch (e) {
    console.log(`❌ Folder not found: ${e.message}`);
    return;
  }

  // Find or create NCR subfolder
  let folderId = DRIVE_FOLDER_ID;
  const query = `name='NCR' and mimeType='application/vnd.google-apps.folder' and '${DRIVE_FOLDER_ID}' in parents`;
  try {
    const existing = await drive.files.list({ q: query, fields: 'files(id)', supportsAllDrives: true, includeItemsFromAllDrives: true });
    if (existing.data.files.length > 0) {
      folderId = existing.data.files[0].id;
      console.log('📁 Found NCR folder');
    } else {
      const folder = await drive.files.create({
        requestBody: { name: 'NCR', mimeType: 'application/vnd.google-apps.folder', parents: [DRIVE_FOLDER_ID] },
        fields: 'id', supportsAllDrives: true
      });
      folderId = folder.data.id;
      console.log('📁 Created NCR folder');
    }
  } catch (e) {
    console.log(`⚠️ Folder error: ${e.message}`);
  }

  // Upload test file
  const testContent = 'NCR Test Upload - ' + new Date().toISOString();
  const testFile = path.join(__dirname, 'uploads', 'oauth_test.txt');
  fs.writeFileSync(testFile, testContent);

  try {
    const fileName = `BEML_${new Date().toISOString().split('T')[0]}_test_ncr.txt`;
    const file = await drive.files.create({
      resource: { name: fileName, parents: [folderId] },
      media: { mimeType: 'text/plain', body: fs.createReadStream(testFile) },
      fields: 'id, webViewLink',
      supportsAllDrives: true
    });

    await drive.permissions.create({
      fileId: file.data.id,
      requestBody: { type: 'anyone', role: 'reader' },
      supportsAllDrives: true
    });

    console.log(`✅ File uploaded: ${fileName}`);
    console.log(`🔗 Link: ${file.data.webViewLink}`);
  } catch (e) {
    console.log(`❌ Upload failed: ${e.message}`);
  }

  fs.unlinkSync(testFile);
  console.log('\n🎉 Test complete!');
}

testUpload().catch(console.error);
