import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function diagnoseDrive() {
  const credentialsPath = path.join(__dirname, 'credentials', 'service-account.json');
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth });
  const OLD_FOLDER_ID = '1M3k66ROJSNVUe-TB5rcF4bJ0O6obBGRp';

  console.log('=== DIAGNOSING GOOGLE DRIVE ACCESS ===\n');

  // 1. Check what's in the shared folder
  console.log('1. Checking current folder contents...');
  try {
    const files = await drive.files.list({
      q: `'${OLD_FOLDER_ID}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    console.log(`   Found ${files.data.files.length} items:`);
    files.data.files.forEach(f => console.log(`   - ${f.name} (${f.mimeType})`));
  } catch (e) {
    console.log(`   ❌ Cannot list folder: ${e.message}`);
  }

  // 2. Check folder details
  console.log('\n2. Checking folder details...');
  try {
    const folder = await drive.files.get({
      fileId: OLD_FOLDER_ID,
      fields: 'id, name, mimeType, owners, capabilities, shared, sharingUser',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    console.log(`   Name: ${folder.data.name}`);
    console.log(`   Shared: ${folder.data.shared}`);
    console.log(`   Capabilities:`, JSON.stringify(folder.data.capabilities, null, 2));
  } catch (e) {
    console.log(`   ❌ Cannot get folder details: ${e.message}`);
  }

  // 3. List all Shared Drives accessible to service account
  console.log('\n3. Listing accessible Shared Drives...');
  try {
    const drives = await drive.drives.list({
      fields: 'drives(id, name, createdTime)',
    });
    if (drives.data.drives.length === 0) {
      console.log('   No Shared Drives accessible.');
    } else {
      drives.data.drives.forEach(d => console.log(`   - ${d.name} (${d.id})`));
    }
  } catch (e) {
    console.log(`   ❌ Cannot list Shared Drives: ${e.message}`);
  }

  // 4. Try to create a test file in the folder (simple text)
  console.log('\n4. Testing file upload to folder...');
  try {
    const testContent = 'Test file from service account';
    const testFile = path.join(__dirname, 'uploads', 'drive_test.txt');
    fs.writeFileSync(testFile, testContent);
    
    const result = await drive.files.create({
      resource: {
        name: 'drive_test.txt',
        parents: [OLD_FOLDER_ID],
      },
      media: {
        mimeType: 'text/plain',
        body: fs.createReadStream(testFile),
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });
    console.log(`   ✅ SUCCESS! File uploaded: ${result.data.id}`);
    console.log(`   Link: ${result.data.webViewLink}`);
    
    // Cleanup
    await drive.files.delete({ fileId: result.data.id, supportsAllDrives: true });
    console.log('   Cleaned up test file.');
  } catch (e) {
    console.log(`   ❌ Upload FAILED: ${e.message}`);
  }

  // 5. Try to find ANY folder the service account can write to
  console.log('\n5. Testing upload to root of Shared Drive...');
  try {
    const drives = await drive.drives.list({ fields: 'drives(id, name)' });
    if (drives.data.drives.length > 0) {
      const sharedDrive = drives.data.drives[0];
      console.log(`   Trying Shared Drive: ${sharedDrive.name} (${sharedDrive.id})`);
      
      const testFile = path.join(__dirname, 'uploads', 'drive_test2.txt');
      fs.writeFileSync(testFile, 'Test file to Shared Drive root');
      
      const result = await drive.files.create({
        resource: {
          name: 'drive_test2.txt',
          parents: [sharedDrive.id],
        },
        media: {
          mimeType: 'text/plain',
          body: fs.createReadStream(testFile),
        },
        fields: 'id, webViewLink',
        supportsAllDrives: true,
      });
      console.log(`   ✅ SUCCESS! File uploaded to Shared Drive: ${result.data.id}`);
      console.log(`   Link: ${result.data.webViewLink}`);
      
      await drive.files.delete({ fileId: result.data.id, supportsAllDrives: true });
      console.log('   Cleaned up test file.');
    } else {
      console.log('   No Shared Drives available to test.');
    }
  } catch (e) {
    console.log(`   ❌ Upload to Shared Drive FAILED: ${e.message}`);
  }
}

diagnoseDrive().catch(console.error);
