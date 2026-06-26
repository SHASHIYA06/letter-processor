import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function setupSharedDrive() {
  const credentialsPath = path.join(__dirname, 'credentials', 'service-account.json');
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth });
  const OLD_FOLDER_ID = '1M3k66ROJSNVUe-TB5rcF4bJ0O6obBGRp';

  // Step 1: Create Shared Drive
  console.log('Creating Shared Drive "Letter Processor"...');
  let sharedDriveId;
  try {
    const res = await drive.drives.create({
      requestId: `shared-drive-${Date.now()}`,
      requestBody: {
        name: 'Letter Processor',
      },
    });
    sharedDriveId = res.data.id;
    console.log(`✅ Shared Drive created: ${sharedDriveId}`);
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log('Shared Drive already exists, listing drives...');
      const list = await drive.drives.list({ fields: 'drives(id, name)' });
      const existing = list.data.drives.find(d => d.name === 'Letter Processor');
      if (existing) {
        sharedDriveId = existing.id;
        console.log(`✅ Found existing Shared Drive: ${sharedDriveId}`);
      } else {
        console.log('❌ Could not find or create Shared Drive');
        return;
      }
    } else {
      console.log(`❌ Failed to create Shared Drive: ${e.message}`);
      return;
    }
  }

  // Step 2: Create folder in Shared Drive
  console.log('\nCreating "Letter Processor" folder in Shared Drive...');
  let newFolderId;
  try {
    const folderRes = await drive.files.create({
      resource: {
        name: 'Letter Processor',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [sharedDriveId],
      },
      fields: 'id',
      supportsAllDrives: true,
    });
    newFolderId = folderRes.data.id;
    console.log(`✅ Folder created: ${newFolderId}`);
  } catch (e) {
    console.log(`❌ Failed to create folder: ${e.message}`);
    return;
  }

  // Step 3: Try to move existing contents from old folder to new folder
  console.log('\nAttempting to copy files from old folder...');
  try {
    const files = await drive.files.list({
      q: `'${OLD_FOLDER_ID}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageSize: 100,
    });

    if (files.data.files.length === 0) {
      console.log('No files found in old folder (or no access).');
    } else {
      console.log(`Found ${files.data.files.length} items to copy.`);
      for (const file of files.data.files) {
        try {
          // Copy file to new location
          await drive.files.copy({
            fileId: file.id,
            resource: {
              name: file.name,
              parents: [newFolderId],
            },
            fields: 'id',
            supportsAllDrives: true,
          });
          console.log(`  ✅ Copied: ${file.name}`);
        } catch (e) {
          console.log(`  ⚠️ Could not copy ${file.name}: ${e.message}`);
        }
      }
    }
  } catch (e) {
    console.log(`⚠️ Could not list/copy files from old folder: ${e.message}`);
  }

  // Step 4: Update .env
  console.log('\nUpdating .env file...');
  const envPath = path.join(__dirname, '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');
  envContent = envContent.replace(
    /GOOGLE_DRIVE_FOLDER_ID=.*/,
    `GOOGLE_DRIVE_FOLDER_ID=${newFolderId}`
  );
  fs.writeFileSync(envPath, envContent);
  console.log(`✅ .env updated with new folder ID: ${newFolderId}`);

  console.log('\n🎉 Setup complete!');
  console.log(`   Shared Drive ID: ${sharedDriveId}`);
  console.log(`   New Folder ID: ${newFolderId}`);
  console.log('\n   Restart the server to use the new folder.');
}

setupSharedDrive().catch(console.error);
