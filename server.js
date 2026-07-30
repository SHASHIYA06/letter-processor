import express from 'express';
import multer from 'multer';
import { google } from 'googleapis';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import 'dotenv/config';

// Conditionally load heavy dependencies (not needed for Vercel PDF generation)
let Tesseract, pdfParse, mammoth, execSync;
const isVercel = !!process.env.VERCEL;

if (!isVercel) {
  const tesseractModule = await import('tesseract.js');
  Tesseract = tesseractModule.default;
  const pdfParseModule = await import('pdf-parse');
  pdfParse = pdfParseModule.default;
  const mammothModule = await import('mammoth');
  mammoth = mammothModule.default;
  const childProcess = await import('child_process');
  execSync = childProcess.execSync;
} else {
  // Minimal implementations for Vercel
  Tesseract = { recognize: async () => ({ data: { text: '' } }) };
  pdfParse = async (buffer) => ({ text: '' });
  mammoth = { extractRawText: async () => ({ value: '' }) };
  execSync = () => { throw new Error('execSync not available on Vercel') };
}

// Import NCR parser
import { parseNCRContent } from './ncr-parser.js';
import { generateNCRPdf, generateLetterPdf, generateNCRDocx, generateLetterDocx } from './pdf-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    try {
      const org = (req.body.organization || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
      const date = new Date().toISOString().split('T')[0];
      const ext = path.extname(file.originalname).toLowerCase() || '.bin';
      const baseName = path.basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .substring(0, 80);
      cb(null, `${org}_${date}_${Date.now()}_${baseName}${ext}`);
    } catch (err) {
      cb(null, `${Date.now()}_upload${path.extname(file.originalname) || '.bin'}`);
    }
  }
});
const upload = multer({ 
  storage, 
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.tiff', '.tif', '.doc', '.docx', '.txt', '.bmp', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Allowed: ${allowedExts.join(', ')}`));
    }
  }
});

let auth, sheets, drive;
let oauth2Client;
let allDataCache = {};
const TOKEN_PATH = path.join(__dirname, 'credentials', 'oauth-tokens.json');

function columnToLetter(col) {
  let letter = '';
  while (col > 0) {
    const mod = (col - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

async function loadAllDataCache() {
  if (!sheets) return;
  try {
    const allData = {};
    for (const [key, sheetName] of Object.entries(SHEET_NAMES)) {
      try {
        const range = `${sheetName}!A1:Z`;
        const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
        allData[sheetName] = result.data.values || [];
      } catch { allData[sheetName] = []; }
    }
    allDataCache = allData;
    console.log('✅ Data cache refreshed');
  } catch (err) {
    console.log('⚠️  Cache refresh failed:', err.message);
  }
}

async function initGoogleAuth() {
  try {
    const oauthConfigPath = path.join(__dirname, 'credentials', 'oauth-config.json');
    const credentialsPath = path.join(__dirname, 'credentials', 'service-account.json');

    // Try OAuth2 first (local development)
    if (!process.env.VERCEL && fs.existsSync(oauthConfigPath)) {
      const { client_id, client_secret } = JSON.parse(fs.readFileSync(oauthConfigPath, 'utf8'));
      if (client_id && client_secret) {
        oauth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3000/auth/google/callback');
        if (fs.existsSync(TOKEN_PATH)) {
          const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
          oauth2Client.setCredentials(tokens);
          console.log('✅ OAuth2 tokens loaded');
        } else {
          console.log('⚠️  No OAuth2 tokens. Visit: http://localhost:3000/auth/google');
        }
        auth = oauth2Client;
        sheets = google.sheets({ version: 'v4', auth });
        drive = google.drive({ version: 'v3', auth });
        console.log('✅ Google API authenticated (OAuth2)');
        return;
      }
    }

    // Try service account from environment variable (Vercel)
    if (process.env.GOOGLE_SERVICE_ACCOUNT) {
      try {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
        auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
        });
        sheets = google.sheets({ version: 'v4', auth });
        drive = google.drive({ version: 'v3', auth });
        console.log('✅ Google API authenticated (Service Account from env)');
        return;
      } catch (e) {
        console.log('⚠️  Failed to parse GOOGLE_SERVICE_ACCOUNT:', e.message);
      }
    }

    // Fallback to service account file (local)
    if (!process.env.VERCEL && fs.existsSync(credentialsPath)) {
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
      });
      sheets = google.sheets({ version: 'v4', auth });
      drive = google.drive({ version: 'v3', auth });
      console.log('✅ Google API authenticated (Service Account)');
      return;
    }

    console.log('⚠️  No credentials found');
  } catch (err) {
    console.log('⚠️  Google auth failed:', err.message);
  }
}

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '1qx5FAkOE959ng8eOGb_NC_DuF381x-NYRwKED0hgRIk';
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '0AKn4jR1qLh4TUk9PVA';

// Sheet names for each organization
const SHEET_NAMES = {
  'BEML': 'BEML Letters',
  'KMRCL': 'KMRCL Letters',
  'Metro Rail': 'Metro Rail Letters',
  'NCR': 'NCR Records',
  'Joint Note': 'Joint Notes'
};

const LETTER_COLUMNS = [
  'S.No', 'Ref. Letter Number', 'All References', 'Date', 'From',
  'To (Addressee)', 'Kind Attention', 'Subject', 'Letter Type',
  'Letter Content', 'Enclosures', 'Remarks', 'Attachment Link', 'File Name', 'Status'
];

const NCR_COLUMNS = [
  'S.No', 'NCR Report No', 'Date of NCR', 'Date of Detection',
  'Item Description', 'NCR Description', 'Faulty Sl No', 'Healthy Sl No',
  'Qty', 'Sub-System', 'Train No', 'Car', 'Responsibility',
  'Status', 'Item Repaired', 'Item Replaced', 'Date of Repair',
  'Source', 'Investigation Report Date', 'Gate Pass No', 'Remarks',
  'Attachment Link', 'File Name',
  'Project', 'Line', 'OEM', 'Train Set', 'Coach No',
  'NCR Category', 'NCR Type', 'Severity', 'Priority', 'System',
  'Location', 'Vendor', 'Raised By', 'Assigned To',
  'Root Cause', 'Corrective Action', 'Preventive Action', 'Disposition',
  'Closure Date', 'Closure Authority'
];

// ══════════════════════════════════════════════════════════════
//  MASTER DATA FOR NCR DROPDOWNS
// ══════════════════════════════════════════════════════════════
const NCR_MASTER_DATA = {
  oem: [
    'M/s Televic Rail N.V.', 'M/s KBI', 'M/s Alstom', 'M/s Siemens',
    'M/s BEML Limited', 'M/s Medha', 'M/s Triton', 'M/s Astra Microwave',
    'M/s Tech Mahindra', 'M/s Wipro', 'M/s HCL', 'M/s L&T',
    'M/s Samsung', 'M/s Bosch', 'M/s ABB', 'M/s Honeywell',
    'M/s Emerson', 'M/s Schneider Electric', 'M/s GE', 'M/s Rockwell'
  ],
  trainSets: [
    'TS#1', 'TS#2', 'TS#3', 'TS#4', 'TS#5', 'TS#6', 'TS#7', 'TS#8',
    'TS#9', 'TS#10', 'TS#11', 'TS#12', 'TS#13', 'TS#14', 'TS#15', 'TS#16',
    'TS#17', 'TS#18', 'TS#19', 'TS#20', 'TS#21', 'TS#22', 'TS#23', 'TS#24',
    'TS#25', 'TS#26'
  ],
  cars: [
    'DMC1', 'DMC2', 'DMC3', 'DMC4', 'TC1', 'TC2', 'TC3', 'TC4',
    'M1', 'M2', 'M3', 'M4', 'T1', 'T2', 'T3', 'T4',
    'RMC1', 'RMC2', 'RIC1', 'RIC2', 'DMC-R1', 'DMC-R2', 'TC-R1', 'TC-R2',
    'MC1', 'MC2', 'MC3', 'MC4', 'C1', 'C2', 'C3', 'C4'
  ],
  lines: [
    'Line 1 (North-South)', 'Line 2 (East-West)', 'Line 3 (East-West Corridor)',
    'Line 4 (Joka-Esplanade)', 'Line 5 (New Garia-Airport)',
    'KMRCL RS-3R Phase 1', 'KMRCL RS-3R Phase 2', 'KMRCL RS-3R Phase 3',
    'Kolkata Metro Line 1', 'Kolkata Metro Line 2'
  ],
  projects: [
    'KMRCL RS-3R Project', 'Kolkata Metro Phase 1', 'Kolkata Metro Phase 2',
    'Kolkata Metro Phase 3', 'BEML Rolling Stock', 'Metro Rail Extension',
    'Nagpur Metro', 'Pune Metro', 'Ahmedabad Metro', 'Bhopal Metro',
    'Kanpur Metro', 'Agra Metro', 'Delhi Metro Phase 4', 'Chennai Metro Phase 2',
    'Bangalore Metro Phase 2', 'Hyderabad Metro Phase 2'
  ],
  systems: [
    'Communication', 'Signalling', 'Telecom', 'Power Supply', 'Traction',
    'Rolling Stock', 'Track', 'Pway', 'E&M', 'Civil',
    'Automated Fare Collection', 'Passeral Information Display',
    'Public Address', 'CCTV', 'Fire Detection & Suppression',
    'HVAC', 'Lighting', 'Bridge Gate', 'Screen Door', 'Elevator',
    'Escalator', 'DG Set', 'Transformer', 'Switchgear', 'Cable'
  ],
  subsystems: [
    'FDI/TNI', 'TETRA Radio', 'Leaky Feeder', 'Antenna', 'Repeater',
    'Base Station', 'Dispatch Console', 'ODN', 'OTN', 'MPLS',
    'CCTV Camera', 'NVR', 'DVR', 'Monitor', 'UPS',
    'Battery', 'Rectifier', 'Inverter', 'ATS', 'Panel',
    'Speaker', 'Microphone', 'Amplifier', 'Mixer', 'Audio Processor',
    'Signal Lamp', 'Point Machine', 'Track Circuit', 'Axle Counter', 'Interlocking',
    'Pantograph', 'Traction Motor', 'Blower', 'Compressor', 'Brake System',
    'Door System', 'Window', 'Seat', 'Flooring', 'Ceiling Panel'
  ],
  locations: [
    'CPD Depot', 'Tapan Depot', 'Noapara Depot', 'Joka Depot',
    'Salt Lake Depot', 'New Garia Depot', 'Airport Depot',
    'North South Workshop', 'East West Workshop',
    'Main Workshop', 'Electrical Workshop', 'Mechanical Workshop',
    'Bogie Shop', 'Car Body Shop', 'Paint Shop', 'Final Assembly',
    'Testing Track', 'Commissioning Area', 'Storage Yard', 'Siding'
  ],
  ncrCategories: [
    'Material Non-Conformance', 'Process Non-Conformance',
    'Documentation Non-Conformance', 'Calibration Non-Conformance',
    'Environmental Non-Conformance', 'Safety Non-Conformance',
    'Quality System Non-Conformance', 'Supplier Non-Conformance',
    'Design Non-Conformance', 'Installation Non-Conformance'
  ],
  ncrTypes: [
    'Critical', 'Major', 'Minor', 'Observation',
    'Non-Conformity', 'Deficiency', 'Deviation', 'Non-Compliance'
  ],
  priorities: [
    'Critical', 'High', 'Medium', 'Low', 'Immediate', 'Urgent', 'Routine'
  ],
  dispositions: [
    'Use As Is', 'Rework', 'Repair', 'Scrap', 'Return to Supplier',
    'Reject', 'Waiver/Concession', 'Regrade', 'Salvage', 'Hold'
  ],
  rootCauses: [
    'Design Error', 'Manufacturing Defect', 'Material Defect',
    'Process Deviation', 'Inadequate Training', 'Equipment Failure',
    'Environmental Factors', 'Human Error', 'Supplier Issue',
    'Specification Gap', 'Communication Failure', 'Storage Issue',
    'Handling Damage', 'Calibration Drift', 'Wear and Tear'
  ],
  departments: [
    'Quality Assurance', 'Quality Control', 'Production', 'Engineering',
    'Design', 'Procurement', 'Stores', 'Maintenance', 'Safety',
    'Project Management', 'Commercial', 'Finance', 'HR',
    'IT', 'Logistics', 'Planning', 'R&D', 'S&M'
  ],
  severities: ['Critical', 'Major', 'Minor'],
  materialStatuses: ['Before Installation', 'Installed', 'In Transit', 'In Storage', 'Under Maintenance'],
  disassembledOptions: ['N/A', 'Disassembled', 'Before Receiving', 'During Installation', 'After Installation']
};

const JOINT_NOTE_COLUMNS = [
  'S.No', 'Joint Note No', 'Date', 'Parties',
  'Subject', 'Description', 'Items Discussed',
  'Decisions', 'Action Items', 'Attachments',
  'Attachment Link', 'File Name', 'Status'
];

async function ensureSheetExists(sheetName) {
  if (!sheets) return;
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const existingSheets = spreadsheet.data.sheets.map(s => s.properties.title);
    if (!existingSheets.includes(sheetName)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] }
      });
      console.log(`✅ Created sheet: ${sheetName}`);
    }
  } catch (err) {
    console.log(`⚠️  Sheet check failed: ${err.message}`);
  }
}

async function ensureHeaders(sheetName, columns) {
  if (!sheets) return;
  try {
    await ensureSheetExists(sheetName);
    const range = `${sheetName}!A1:${columnToLetter(columns.length)}1`;
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID, range,
        valueInputOption: 'RAW', requestBody: { values: [columns] }
      });
      console.log(`✅ Headers set for: ${sheetName}`);
    }
  } catch (err) {
    console.log(`⚠️  Headers failed for ${sheetName}: ${err.message}`);
  }
}

async function getNextSerialNumber(sheetName) {
  if (!sheets) return 1;
  try {
    const range = `${sheetName}!A:A`;
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
    const rows = res.data.values || [];
    if (rows.length <= 1) return 1;
    const lastVal = parseInt(rows[rows.length - 1][0]);
    return isNaN(lastVal) ? rows.length : lastVal + 1;
  } catch { return 1; }
}

function clean(s, maxLen = 500) {
  return (s || 'N/A').replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim().substring(0, maxLen);
}

async function appendToSheet(sheetName, data, columns) {
  if (!sheets) {
    console.log(`📝 [LOCAL] Would append to ${sheetName}:`, JSON.stringify(data, null, 2));
    return { success: true, local: true };
  }
  try {
    await ensureHeaders(sheetName, columns);
    const sno = await getNextSerialNumber(sheetName);
    const colCount = columns.length;
    const range = `${sheetName}!A:${columnToLetter(colCount)}`;

    console.log(`\n📝 appendToSheet: ${sheetName}`);
    console.log('   Columns:', columns.join(', '));
    console.log('   Data keys:', Object.keys(data).join(', '));

    // Build mapping: normalized column name -> data key
    const keyMap = {
      'sno': 'sno',
      'refletternumber': 'refLetterNumber',
      'allreferences': 'allReferences',
      'date': 'date',
      'from': 'from',
      'toaddressee': 'to',
      'kindattention': 'kindAttn',
      'subject': 'subject',
      'lettertype': 'letterType',
      'lettercontent': 'letterContent',
      'enclosures': 'enclosures',
      'remarks': 'remarks',
      'attachmentlink': 'attachmentLink',
      'filename': 'fileName',
      'status': 'status',
      'ncrreportno': 'ncrNo',
      'dateofncr': 'date',
      'dateofdetection': 'detectionDate',
      'itemdescription': 'itemDesc',
      'ncrdescription': 'ncrDesc',
      'faultyslno': 'faultySl',
      'healthyslno': 'healthySl',
      'qty': 'qty',
      'subsystem': 'subSystem',
      'trainno': 'trainNo',
      'car': 'car',
      'responsibility': 'responsibility',
      'itemrepaired': 'itemRepaired',
      'itemreplaced': 'itemReplaced',
      'dateofrepair': 'dateOfRepair',
      'source': 'source',
      'investigationreportdate': 'investigationDate',
      'gatepassno': 'gatePassNo',
      'jointnoteno': 'jointNoteNo',
      'parties': 'parties',
      'description': 'description',
      'itemsdiscussed': 'items',
      'decisions': 'decisions',
      'actionitems': 'actionItems',
      'attachments': 'attachments'
    };

    const row = columns.map((col, idx) => {
      if (idx === 0) return sno; // S.No
      const key = col.toLowerCase().replace(/[^a-z0-9]/g, '');
      const dataKey = keyMap[key] || key;
      
      // Try exact match first
      if (data[dataKey] !== undefined) return clean(String(data[dataKey]));
      // Try fuzzy match - normalized key comparison
      for (const [k, v] of Object.entries(data)) {
        if (k.toLowerCase().replace(/[^a-z0-9]/g, '') === key) return clean(String(v));
      }
      // Try alternative common field names
      const altKeys = {
        'toaddressee': ['to', 'addressee', 'recipient'],
        'kindattention': ['kindAttn', 'attention', 'kindattn'],
        'lettercontent': ['letterContent', 'content', 'body', 'letterBody'],
        'attachmentlink': ['attachmentLink', 'driveLink', 'link'],
        'filename': ['fileName', 'file', 'originalName'],
        'ncrreportno': ['ncrNo', 'ncrNumber', 'reportNo'],
        'dateofncr': ['date', 'ncrDate', 'reportDate'],
        'itemdescription': ['itemDesc', 'itemDescription', 'product', 'productName'],
        'ncrdescription': ['ncrDesc', 'ncrDescription', 'description'],
        'healthyslno': ['healthySl', 'healthySlNo', 'healthySerial'],
        'faultyslno': ['faultySl', 'faultySlNo', 'faultySerial'],
        'dateofrepair': ['dateOfRepair', 'repairDate'],
        'investigationreportdate': ['investigationDate', 'investigationReportDate'],
        'jointnoteno': ['jointNoteNo', 'noteNo', 'jnNo'],
        'itemsdiscussed': ['items', 'itemsDiscussed'],
        'actionitems': ['actionItems', 'action'],
      };
      if (altKeys[key]) {
        for (const ak of altKeys[key]) {
          if (data[ak] !== undefined) return clean(String(data[ak]));
        }
      }
      return 'N/A';
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range,
      valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: [row] }
    });
    console.log(`✅ Row ${sno} appended to ${sheetName}`);
    return { success: true, sno };
  } catch (err) {
    console.log(`❌ Sheet append failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function refreshOAuthToken() {
  if (!oauth2Client || !oauth2Client.credentials || !oauth2Client.credentials.refresh_token) return false;
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(credentials, null, 2));
    console.log('✅ OAuth token refreshed');
    return true;
  } catch (err) {
    console.log('⚠️  Token refresh failed:', err.message);
    return false;
  }
}

async function uploadFileToDrive(filePath, originalName, org, subfolder = '', _retryCount = 0) {
  if (!drive) {
    console.log(`📁 [LOCAL] Would upload: ${originalName}`);
    return { success: true, local: true };
  }
  try {
    // Check if token needs refresh
    if (oauth2Client && oauth2Client.credentials && oauth2Client.credentials.expiry_date) {
      const now = Date.now();
      const expiry = oauth2Client.credentials.expiry_date;
      if (now >= expiry - 60000) { // Refresh 1 minute before expiry
        await refreshOAuthToken();
      }
    }

    // Find or create subfolder in Shared Drive
    let folderId = DRIVE_FOLDER_ID;
    if (!folderId) {
      console.log('⚠️  No Drive folder ID configured');
      return { success: false, error: 'No Drive folder ID configured' };
    }

    if (subfolder) {
      const subfolderName = subfolder;
      // Search for existing subfolder
      const query = `name='${subfolderName}' and mimeType='application/vnd.google-apps.folder' and '${folderId}' in parents and trashed=false`;
      try {
        const existing = await drive.files.list({ 
          q: query, 
          fields: 'files(id)', 
          supportsAllDrives: true, 
          includeItemsFromAllDrives: true 
        });
        if (existing.data.files.length > 0) {
          folderId = existing.data.files[0].id;
        } else {
          const folder = await drive.files.create({
            requestBody: { 
              name: subfolderName, 
              mimeType: 'application/vnd.google-apps.folder', 
              parents: [folderId] 
            },
            fields: 'id',
            supportsAllDrives: true
          });
          folderId = folder.data.id;
          console.log(`📁 Created folder: ${subfolderName}`);
        }
      } catch (folderErr) {
        console.log(`⚠️  Folder search/create failed, using parent: ${folderErr.message}`);
        folderId = DRIVE_FOLDER_ID;
      }
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `${org}_${dateStr}_${originalName}`;
    const media = { mimeType: getMimeType(originalName), body: fs.createReadStream(filePath) };
    
    const file = await drive.files.create({
      resource: { name: fileName, parents: [folderId] },
      media, 
      fields: 'id, webViewLink',
      supportsAllDrives: true
    });

    // Make file viewable by anyone with the link
    await drive.permissions.create({
      fileId: file.data.id,
      requestBody: { type: 'anyone', role: 'reader' },
      supportsAllDrives: true
    });

    const link = file.data.webViewLink || `https://drive.google.com/file/d/${file.data.id}/view`;
    console.log(`✅ File uploaded to Drive: ${fileName}`);
    return { success: true, fileId: file.data.id, link };
  } catch (err) {
    console.log(`❌ Drive upload failed: ${err.message}`);
    // Try to refresh token on auth errors (max 1 retry)
    if (_retryCount < 1 && (err.message.includes('invalid_grant') || err.message.includes('Token has been expired') || err.code === 401)) {
      const refreshed = await refreshOAuthToken();
      if (refreshed) {
        console.log('🔄 Retrying Drive upload after token refresh...');
        return uploadFileToDrive(filePath, originalName, org, subfolder, _retryCount + 1);
      }
    }
    return { success: false, error: err.message };
  }
}

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const types = {
    '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.gif': 'image/gif', '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain', '.tiff': 'image/tiff', '.tif': 'image/tiff',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel'
  };
  return types[ext] || 'application/octet-stream';
}

// ══════════════════════════════════════════════════════════════
//  TEXT EXTRACTION
// ══════════════════════════════════════════════════════════════
async function extractTextFromPDF(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  if (data.text && data.text.trim().length > 50) return data.text;
  console.log('🖼️  Scanned PDF, running OCR...');
  return await extractTextFromScannedPDF(filePath);
}

async function extractTextFromScannedPDF(filePath) {
  const tmpDir = path.join(__dirname, 'uploads', 'ocr_tmp_' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    execSync(`pdftoppm -png -r 300 "${filePath}" "${path.join(tmpDir, 'page')}"`, { timeout: 60000, stdio: 'pipe' });
    const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.png')).sort();
    let fullText = '';
    for (let i = 0; i < files.length; i++) {
      console.log(`🔍 OCR page ${i + 1}/${files.length}...`);
      const result = await Tesseract.recognize(path.join(tmpDir, files[i]), 'eng');
      fullText += result.data.text + '\n\n';
    }
    return fullText;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

async function extractTextFromDOCX(filePath) {
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractTextFromImage(filePath) {
  const result = await Tesseract.recognize(filePath, 'eng');
  return result.data.text;
}

async function extractText(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.pdf') return await extractTextFromPDF(filePath);
    if (ext === '.docx') return await extractTextFromDOCX(filePath);
    if (ext === '.doc') {
      // For .doc files, try to read as text (basic support)
      try {
        return fs.readFileSync(filePath, 'utf8');
      } catch {
        throw new Error('Cannot read .doc file. Please convert to .docx first.');
      }
    }
    if (['.jpg', '.jpeg', '.png', '.gif', '.tiff', '.tif', '.bmp'].includes(ext)) {
      return await extractTextFromImage(filePath);
    }
    if (ext === '.txt') return fs.readFileSync(filePath, 'utf8');
    if (ext === '.xlsx' || ext === '.xls') {
      // Excel files - extract text from cells
      try {
        const xlsxModule = await import('xlsx');
        const XLSX = xlsxModule.default || xlsxModule;
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        return data.map(row => row.filter(c => c !== null && c !== undefined).join(' ')).join('\n');
      } catch (xlsxErr) {
        throw new Error(`Failed to read Excel file: ${xlsxErr.message}`);
      }
    }
    throw new Error(`Unsupported file type: ${ext}`);
  } catch (err) {
    console.error(`❌ Text extraction failed for ${filePath}:`, err.message);
    throw err;
  }
}

// ══════════════════════════════════════════════════════════════
//  CONTENT PARSER
// ══════════════════════════════════════════════════════════════
function parseLetterContent(text, org) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/\t/g, ' ').replace(/ {2,}/g, ' ');
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);
  const fullText = lines.join('\n');

  const extracted = { refNumber: '', allReferences: [], date: '', subject: '', from: '', to: '', kindAttn: '', enclosures: '', letterContent: '', remarks: '' };

  // REF
  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    const line = lines[i]; let m;
    m = line.match(/Our\s+No\.?\s*[:\.]?\s*(.+)/i);
    if (m && m[1]) { let ref = m[1].trim().split(/\s{3,}/)[0].replace(/^[:\s]+/, '').trim(); if (ref.length >= 3 && !ref.match(/^date\s*:/i)) { extracted.refNumber = ref; break; } const sr = line.match(/([A-Z]{2,10}\s*\/\s*[A-Z0-9\/\-]+)/); if (sr && sr[1] && sr[1].includes('/')) { extracted.refNumber = sr[1].trim(); break; } }
    m = line.match(/^([A-Z]{2,10}\/[A-Z0-9\/\-\(\)]+(?:\s+[A-Z][A-Za-z\/\-]+)*(?:\s*\/\s*\d{2,4})?(?:\s*\/\s*\d{2,5})?)\s/);
    if (m && m[1] && m[1].includes('/')) { extracted.refNumber = m[1].trim(); break; }
    if (!extracted.refNumber) { const ir = line.match(/([A-Z]{2,10}\s*\/\s*[A-Z0-9\/\-]+(?:\s*\/\s*[A-Z0-9]+)*(?:\s*\/\s*\d{2,4})?(?:\s*\/\s*\d{2,5})?)/); if (ir && ir[1] && (ir[1].match(/\//g) || []).length >= 2) { extracted.refNumber = ir[1].replace(/\s+/g, ' ').trim(); break; } }
    if (i < 15) { m = line.match(/(?:^Ref|reference)\s*[:\.]?\s*(?:\(I\)\s*)?(.+)/i); if (m && m[1]) { let ref = m[1].trim().split(/\s{3,}/)[0].replace(/^[:\s]+/, '').trim(); if (ref.length >= 3) { extracted.refNumber = ref; break; } } }
    m = line.match(/PDN\s+ref\.?\s*[:\.]?\s*(.+)/i); if (m && m[1]) { extracted.refNumber = m[1].trim().split(/\s{3,}/)[0].trim(); break; }
    m = line.match(/Your\s+Ref\s*(?:No\.?)?\s*[:\.]?\s*(.+)/i); if (m && m[1]) { let ref = m[1].trim().split(/\s{3,}/)[0].replace(/^[:\s]+/, '').trim(); if (ref.length >= 3 && !ref.match(/^date\s*:/i)) { extracted.refNumber = ref; break; } }
  }
  if (!extracted.refNumber) { const ms = fullText.match(/([A-Z]{2,15}\s*\/\s*\d{2,4}[\-\/]\d{2,4}\s*\/\s*[A-Z]{2,15}\s*\/\s*\d{2,5})/); if (ms) extracted.refNumber = ms[1].replace(/\s+/g, ' ').trim(); else { const all = fullText.match(/([A-Z]{2,15}\s*\/\s*[A-Z0-9\/\-]+(?:\s*\/\s*[A-Z0-9]+)*(?:\s*\/\s*\d{2,4})?(?:\s*\/\s*\d{2,5})?)/g); if (all) { const v = all.filter(r => (r.match(/\//g) || []).length >= 2); if (v.length) extracted.refNumber = v.sort((a, b) => b.length - a.length)[0].replace(/\s+/g, ' ').trim(); } } }
  if (!extracted.refNumber) { for (const l of lines.slice(0, 20)) { const m = l.match(/Project\s+Ref\.?\s*[:\.]?\s*(.+)/i); if (m && m[1]) { extracted.refNumber = m[1].trim().split(/\s{3,}/)[0]; break; } } }

  // DATE
  for (let i = 0; i < Math.min(lines.length, 25); i++) { const line = lines[i]; let m; m = line.match(/(?:Date|Dated?)\s*[:\.]?\s*(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})/i); if (m && m[1]) { extracted.date = m[1].trim(); break; } m = line.match(/(?:Date|Dated?)\s*[:\.]?\s*(\d{1,2})\s*[\.\/\-]\s*(\d{1,2})\s*[\.\/\-]\s*(\d{2,4})/i); if (m) { extracted.date = `${m[1]}.${m[2]}.${m[3]}`; break; } m = line.match(/(?:Date|Dated?)\s*[:\.]?\s*(\d{1,2})(?:st|nd|rd|th)?/i); if (m && m[1]) { for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) { const my = lines[j].match(/((?:of\s+)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*,?\s*\d{2,4})/i); if (my) { extracted.date = `${m[1]} ${my[1].replace(/^of\s+/i, '')}`; break; } } if (extracted.date) break; } }
  if (!extracted.date) { for (const l of lines.slice(0, 10)) { const m = l.match(/(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})/); if (m) { extracted.date = m[1]; break; } } }

  // SUBJECT
  for (let i = 0; i < lines.length; i++) { const line = lines[i]; let m = line.match(/Subject\s*[:\.—–\-]\s*(.+)/i); if (m && m[1]) { let s = m[1].trim(); for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) { const n = lines[j]; if (n.match(/^(dear|hello|with|the |our |we |thank|please|refer|enclos|attach|kind attn)/i) || n.length === 0) break; s += ' ' + n.trim(); } extracted.subject = s.replace(/\s+/g, ' ').substring(0, 500); break; } m = line.match(/Sub\.?\s*[:\.—–\-]\s*(.+)/i); if (m && m[1]) { extracted.subject = m[1].trim().substring(0, 500); break; } }

  // FROM
  for (let i = 0; i < Math.min(lines.length, 15); i++) { const m = lines[i].match(/^From\s*[:\.]\s*(.+)/i); if (m && m[1] && m[1].trim().length > 2) { extracted.from = m[1].trim().replace(/\s+/g, ' ').substring(0, 150); break; } }
  if (!extracted.from) { let toIdx = lines.findIndex(l => /^To\s*[:,]?\s*$/.test(l) || /^The\s+(?:Manager|Director|Project\s+Manager)/i.test(l)); if (toIdx === -1) toIdx = 20; const ht = lines.slice(0, Math.min(toIdx, 15)).join(' '); for (const c of [/\b(FORTUNA\s+IMPEX)\b/i, /\b(BEML\s+Limited)\b/i, /\b(Televic\s+Rail\s*N\.?V\.?)\b/i, /\b(KMRCL)\b/i]) { const m = ht.match(c); if (m) { extracted.from = m[1]; break; } } }

  // TO
  for (let i = 0; i < Math.min(lines.length, 25); i++) { if (/^To\s*[:,]?\s*$/.test(lines[i])) { const a = []; for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) { if (lines[j].match(/^(kind\s+attn|dear|subject|sub\b|ref\b|date\b|our\s|your\s|reg\b)/i) || lines[j].length === 0) break; a.push(lines[j]); } if (a.length) extracted.to = a.join(', ').replace(/\s+/g, ' ').substring(0, 300); break; } if (/^The\s+(?:Manager|Director|Project\s+Manager)/i.test(lines[i])) { const a = [lines[i]]; for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) { if (lines[j].match(/^(kind\s+attn|dear|subject|sub\b|ref\b|date\b)/i) || lines[j].length === 0) break; a.push(lines[j]); } if (a.length) extracted.to = a.join(', ').replace(/\s+/g, ' ').substring(0, 300); break; } }

  // KIND ATTENTION
  for (const l of lines) { let m = l.match(/Kind\s+Attn\s*[:\.]?\s*(.+)/i); if (m && m[1]) { extracted.kindAttn = m[1].trim().replace(/\s+/g, ' ').substring(0, 200); break; } m = l.match(/Attn\s*[:\.]?\s*(.+)/i); if (m && m[1] && m[1].trim().length > 2) { extracted.kindAttn = m[1].trim().substring(0, 200); break; } }

  // ENCLOSURES
  const ann = fullText.match(/Annexure[\s\-]*(?:I{1,3}|IV|V|VI{0,3})\b/gi);
  if (ann) extracted.enclosures = [...new Set(ann.map(a => a.replace(/\s+/g, '-')))].join(', ');
  if (!extracted.enclosures) { for (const l of lines) { const m = l.match(/(?:Enclosures?|Encl\.?)\s*[:\.]?\s*(.+)/i); if (m && m[1] && m[1].trim().length > 2) { extracted.enclosures = m[1].trim().substring(0, 300); break; } } }

  // ALL REFERENCES
  const allRefs = [];
  if (extracted.refNumber && extracted.refNumber !== 'N/A') allRefs.push(extracted.refNumber);
  const refPatterns = [/Ref(?:erence)?\s*[:\.]?\s*(?:\(I\)\s*)?([A-Z][A-Z0-9\/\-\(\)\s]{5,})/gi, /Your\s+Ref\s*[:\.]?\s*([A-Z][A-Z0-9\/\-\(\)\s]{5,})/gi, /Letter\s+No\.?\s*[:\.]?\s*([A-Z][A-Z0-9\/\-\(\)\s]{5,})/gi, /GC\/KMRCL\s+Letter\s+No\.?\s*[:\.]?\s*([0-9\-]+)/gi];
  for (const p of refPatterns) { let m; while ((m = p.exec(fullText)) !== null) { const r = m[1].trim().split(/\s{3,}/)[0].trim(); if (r.length >= 5 && r.length <= 80 && !allRefs.some(x => x.includes(r) || r.includes(x))) allRefs.push(r); } }

  // LETTER CONTENT
  let ci = -1;
  for (let i = 0; i < lines.length; i++) { if (lines[i].match(/Dear\s+(?:Sir|Madam|Mr|Ms|Dr|valued)/i)) { ci = i; break; } }
  if (ci > -1) extracted.letterContent = lines.slice(ci).join('\n');
  else { for (let i = 0; i < lines.length; i++) { if (lines[i].match(/Subject\s*[:\.]/i)) { ci = i + 1; while (ci < lines.length && lines[ci].length === 0) ci++; if (ci < lines.length) extracted.letterContent = lines.slice(ci).join('\n'); break; } } }
  if (!extracted.letterContent) extracted.letterContent = fullText;
  extracted.letterContent = extracted.letterContent.replace(/\f/g, ' ').replace(/Page\s+\d+\s+of\s+\d+/gi, '').replace(/\n{3,}/g, '\n\n').trim().substring(0, 3000);

  // LETTER TYPE
  const lt = text.toLowerCase();
  const typeMap = [
    { p: ['product discontinuation', 'obsolescence', 'last time buy', 'end of life', 'pdn ref'], t: 'PDN/Obsolescence' },
    { p: ['purchase order'], t: 'Purchase Order' }, { p: ['work order'], t: 'Work Order' },
    { p: ['quotation'], t: 'Quotation' }, { p: ['tender', 'nib'], t: 'Tender/NIT' },
    { p: ['invoice'], t: 'Invoice' }, { p: ['compliance'], t: 'Compliance' },
    { p: ['record note', 'record of discussion'], t: 'Record Note' },
    { p: ['meeting', 'minutes of meeting', 'mom'], t: 'Meeting Minutes' },
    { p: ['waiver', 'waived'], t: 'Waiver Request' },
    { p: ['inspection'], t: 'Inspection' },
    { p: ['request for approval', 'kindly approve'], t: 'Approval Request' },
    { p: ['technical'], t: 'Technical' }, { p: ['commercial'], t: 'Commercial' },
    { p: ['correspondence'], t: 'Correspondence' }
  ];
  let letterType = 'General';
  for (const t of typeMap) { if (t.p.some(p => lt.includes(p))) { letterType = t.t; break; } }

  // REMARKS
  let remarks = '';
  const rm = fullText.match(/(?:CC:|Copy to)[:\.]?\s*(.+?)(?:\n\n|Annexure|$)/is);
  if (rm) remarks = rm[1].trim().replace(/\n/g, ' ').substring(0, 300);

  return {
    organization: org, letterType, refLetterNumber: extracted.refNumber || 'N/A',
    allReferences: allRefs.length > 0 ? allRefs.join(' | ') : extracted.refNumber || 'N/A',
    date: extracted.date || new Date().toLocaleDateString('en-IN'),
    from: extracted.from || 'N/A', to: extracted.to || 'N/A',
    kindAttn: extracted.kindAttn || 'N/A', subject: extracted.subject || 'N/A',
    letterContent: extracted.letterContent, enclosures: extracted.enclosures || 'N/A',
    remarks: remarks || 'N/A', fileName: '', 
    uploadDate: new Date().toISOString().split('T')[0],
    status: 'Open'
  };
}

// parseNCRContent is imported from ncr-parser.js

function parseJointNoteContent(text) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\t/g, ' ').replace(/ {2,}/g, ' ');
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);
  const fullText = lines.join('\n');

  const extracted = {
    jointNoteNo: '', date: '', parties: '', subject: '', description: '',
    items: '', decisions: '', actionItems: '', attachments: '', status: ''
  };

  let m;

  // Joint Note Number
  m = fullText.match(/Joint\s*Note\s*(?:No|Number)\.?\s*[:\.]?\s*(.+?)(?:\n|$)/i);
  if (m) extracted.jointNoteNo = m[1].trim();
  if (!extracted.jointNoteNo) {
    m = fullText.match(/JN[\-\/]?\s*(\d[\w\-\/]+)/i);
    if (m) extracted.jointNoteNo = m[1].trim();
  }

  // Date
  m = fullText.match(/(?:Date|Dated?)\s*[:\.]?\s*(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})/i);
  if (m) extracted.date = m[1].trim();
  if (!extracted.date) {
    m = fullText.match(/(?:Date|Dated?)\s*[:\.]?\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{2,4})/i);
    if (m) extracted.date = m[1].trim();
  }

  // Parties
  m = fullText.match(/(?:Parties|Between|Participants)\s*[:\.]?\s*(.+?)(?:\n\n|Subject|$)/is);
  if (m) extracted.parties = m[1].trim().replace(/\n/g, ', ').substring(0, 300);

  // Subject
  m = fullText.match(/Subject\s*[:\.—–\-]\s*(.+)/i);
  if (m) extracted.subject = m[1].trim().substring(0, 500);
  if (!extracted.subject) {
    m = fullText.match(/Sub\.?\s*[:\.—–\-]\s*(.+)/i);
    if (m) extracted.subject = m[1].trim().substring(0, 500);
  }

  // Description
  m = fullText.match(/(?:Description|Details|Summary)\s*[:\.]?\s*\n(.+?)(?:\nItems|\nDecisions|\nAction|$)/is);
  if (m) extracted.description = m[1].trim().replace(/\n/g, ' ').substring(0, 1000);
  if (!extracted.description) {
    m = fullText.match(/(?:Description|Details)\s*[:\.]?\s*(.+?)(?:\n\n|$)/is);
    if (m) extracted.description = m[1].trim().replace(/\n/g, ' ').substring(0, 1000);
  }

  // Items Discussed
  m = fullText.match(/(?:Items?\s+Discussed|Discussion\s+Points?)\s*[:\.]?\s*\n(.+?)(?:\nDecisions|\nAction|$)/is);
  if (m) extracted.items = m[1].trim().replace(/\n/g, ' ').substring(0, 1000);

  // Decisions
  m = fullText.match(/(?:Decisions?|Resolution|Agreed)\s*[:\.]?\s*\n(.+?)(?:\nAction|\nNext|$)/is);
  if (m) extracted.decisions = m[1].trim().replace(/\n/g, ' ').substring(0, 1000);

  // Action Items
  m = fullText.match(/(?:Action\s+Items?|Next\s+Steps?|Follow[\s\-]?up)\s*[:\.]?\s*\n(.+?)(?:\n\n|$)/is);
  if (m) extracted.actionItems = m[1].trim().replace(/\n/g, ' ').substring(0, 1000);

  // Status
  m = fullText.match(/Status\s*[:\.]?\s*(OPEN|CLOSED|PENDING|RESOLVED|COMPLETED)/i);
  if (m) extracted.status = m[1].toUpperCase();

  // If no subject found, try to get first meaningful line as subject
  if (!extracted.subject && lines.length > 0) {
    for (const line of lines.slice(0, 10)) {
      if (line.length > 10 && !line.match(/^(joint|date|between|participant|subject)/i)) {
        extracted.subject = line.substring(0, 200);
        break;
      }
    }
  }

  return extracted;
}

// ══════════════════════════════════════════════════════════════
//  NCR / LETTER CREATION ROUTES
// ══════════════════════════════════════════════════════════════

app.get('/api/ncr/next-number', async (req, res) => {
  try {
    const year = new Date().getFullYear();
    let rows = allDataCache['NCR Records'];
    if (!rows && sheets) {
      try {
        const range = 'NCR Records!A1:B';
        const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
        rows = result.data.values || [];
      } catch { rows = []; }
    }
    rows = rows || [];
    let maxNum = 0;
    const prefix = `NCR-${year}-`;
    for (let i = 1; i < rows.length; i++) {
      const ncrNo = rows[i][1] || '';
      if (ncrNo.startsWith(prefix)) {
        const num = parseInt(ncrNo.replace(prefix, ''), 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const nextNum = String(maxNum + 1).padStart(3, '0');
    res.json({ success: true, number: `${prefix}${nextNum}` });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/ncr/create', async (req, res) => {
  try {
    const data = req.body;
    const result = await appendToSheet('NCR Records', data, NCR_COLUMNS);
    res.json({ success: true, sheet: result });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/ncr/update', async (req, res) => {
  try {
    const { rowIndex, data } = req.body;
    // Build row data based on NCR_COLUMNS (43 columns)
    const ncrRow = [
      '', // S.No (auto-generated)
      data.ncrNo || '', data.date || '', data.detectionDate || '', data.itemDesc || '',
      data.ncrDesc || '', data.faultySl || '', data.healthySl || '', data.qty || '',
      data.subSystem || '', data.trainNo || '', data.car || '', data.responsibility || '',
      data.status || 'Open', data.itemRepaired || '', data.itemReplaced || '',
      data.dateOfRepair || '', data.source || '', data.investigationReportDate || '',
      data.gatePassNo || '', data.remarks || '', data.attachmentLink || '', data.fileName || '',
      data.project || '', data.line || '', data.oem || '', data.trainSet || '', data.coachNo || '',
      data.ncrCategory || '', data.ncrType || '', data.severity || '', data.priority || '', data.system || '',
      data.location || '', data.vendor || '', data.raisedBy || data.issuedBy || '', data.assignedTo || '',
      data.rootCause || '', data.correctiveAction || data.correction || '', data.preventiveAction || '',
      data.disposition || '', data.closureDate || '', data.closureAuthority || ''
    ];
    if (sheets) {
      const updates = [];
      NCR_COLUMNS.forEach((col, i) => {
        if (i > 0) updates.push({ range: `NCR Records!${columnToLetter(i+1)}${rowIndex+1}`, values: [[ncrRow[i]]] });
      });
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: { valueInputOption: 'USER_ENTERED', data: updates }
      });
    }
    await loadAllDataCache();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/ncr/clone/:idx', async (req, res) => {
  try {
    const rows = allDataCache['NCR Records'] || [];
    const idx = parseInt(req.params.idx);
    if (!rows[idx]) return res.status(404).json({ success: false, error: 'NCR not found' });
    const original = rows[idx];
    const year = new Date().getFullYear();
    const prefix = `NCR-${year}-`;
    let maxNum = 0;
    for (let i = 1; i < rows.length; i++) {
      const n = rows[i][1] || '';
      if (n.startsWith(prefix)) { const num = parseInt(n.replace(prefix, ''), 10); if (num > maxNum) maxNum = num; }
    }
    // Map row indices to field names based on NCR_COLUMNS
    const fieldMap = {
      1: 'ncrNo', 2: 'date', 3: 'detectionDate', 4: 'itemDesc',
      5: 'ncrDesc', 6: 'faultySl', 7: 'healthySl', 8: 'qty',
      9: 'subSystem', 10: 'trainNo', 11: 'car', 12: 'responsibility',
      13: 'status', 14: 'itemRepaired', 15: 'itemReplaced', 16: 'dateOfRepair',
      17: 'source', 18: 'investigationReportDate', 19: 'gatePassNo', 20: 'remarks',
      21: 'attachmentLink', 22: 'fileName',
      23: 'project', 24: 'line', 25: 'oem', 26: 'trainSet', 27: 'coachNo',
      28: 'ncrCategory', 29: 'ncrType', 30: 'severity', 31: 'priority', 32: 'system',
      33: 'location', 34: 'vendor', 35: 'raisedBy', 36: 'assignedTo',
      37: 'rootCause', 38: 'correctiveAction', 39: 'preventiveAction', 40: 'disposition',
      41: 'closureDate', 42: 'closureAuthority'
    };
    const clonedData = { ncrNo: `${prefix}${String(maxNum + 1).padStart(3, '0')}` };
    for (const [idx, field] of Object.entries(fieldMap)) {
      clonedData[field] = original[parseInt(idx)] || '';
    }
    clonedData.status = 'Open';
    clonedData.date = new Date().toISOString().split('T')[0];
    res.json({ success: true, data: clonedData });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/ncr/generate-pdf', async (req, res) => {
  try {
    const data = req.body;
    const fileName = `NCR_${(data.ncrNo || 'draft').replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
    const outputPath = path.join(__dirname, 'uploads', fileName);
    await generateNCRPdf(data, outputPath);
    res.json({ success: true, filePath: `/uploads/${fileName}`, fileName });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/ncr/generate-docx', async (req, res) => {
  try {
    const data = req.body;
    const fileName = `NCR_${(data.ncrNo || 'draft').replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.docx`;
    const outputPath = path.join(__dirname, 'uploads', fileName);
    await generateNCRDocx(data, outputPath);
    res.json({ success: true, filePath: `/uploads/${fileName}`, fileName });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/letter/next-number/:org', async (req, res) => {
  try {
    const org = req.params.org || 'BEML';
    const year = new Date().getFullYear();
    const sheetName = SHEET_NAMES[org] || `${org} Letters`;
    let rows = allDataCache[sheetName];
    if (!rows && sheets) {
      try {
        const range = `${sheetName}!A1:B`;
        const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
        rows = result.data.values || [];
      } catch { rows = []; }
    }
    rows = rows || [];
    let maxNum = 0;
    const prefix = `${org}/LTR/${year}/`;
    for (let i = 1; i < rows.length; i++) {
      const ref = rows[i][1] || '';
      if (ref.startsWith(prefix)) {
        const num = parseInt(ref.replace(prefix, ''), 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const nextNum = String(maxNum + 1).padStart(3, '0');
    res.json({ success: true, number: `${prefix}${nextNum}` });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/letter/create', async (req, res) => {
  try {
    const { organization, ...data } = req.body;
    const org = organization || 'BEML';
    const sheetName = SHEET_NAMES[org] || `${org} Letters`;
    const result = await appendToSheet(sheetName, data, LETTER_COLUMNS);
    res.json({ success: true, sheet: result });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/letter/generate-pdf', async (req, res) => {
  try {
    const data = req.body;
    const fileName = `Letter_${(data.refNumber || 'draft').replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
    const outputPath = path.join(__dirname, 'uploads', fileName);
    await generateLetterPdf(data, outputPath);
    res.json({ success: true, filePath: `/uploads/${fileName}`, fileName });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/letter/generate-docx', async (req, res) => {
  try {
    const data = req.body;
    const fileName = `Letter_${(data.refNumber || 'draft').replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.docx`;
    const outputPath = path.join(__dirname, 'uploads', fileName);
    await generateLetterDocx(data, outputPath);
    res.json({ success: true, filePath: `/uploads/${fileName}`, fileName });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/auto-save', async (req, res) => {
  try {
    const { docType, data, rowIndex, organization } = req.body;
    let sheetName;
    if (docType === 'ncr') {
      sheetName = 'NCR Records';
      if (rowIndex) {
        if (sheets) {
          const updates = [];
          NCR_COLUMNS.forEach((col, i) => {
            if (i > 0) {
              const key = col.toLowerCase().replace(/[^a-z0-9]/g, '');
              const val = data[key] || data[NCR_COLUMNS[i]] || '';
              updates.push({ range: `NCR Records!${columnToLetter(i+1)}${rowIndex}`, values: [[val]] });
            }
          });
          await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: { valueInputOption: 'USER_ENTERED', data: updates }
          });
        }
      } else {
        await appendToSheet(sheetName, data, NCR_COLUMNS);
      }
    } else {
      const org = organization || 'BEML';
      sheetName = SHEET_NAMES[org] || `${org} Letters`;
      if (rowIndex) {
        if (sheets) {
          const updates = [];
          LETTER_COLUMNS.forEach((col, i) => {
            if (i > 0) {
              const key = col.toLowerCase().replace(/[^a-z0-9]/g, '');
              const val = data[key] || data[LETTER_COLUMNS[i]] || '';
              updates.push({ range: `${sheetName}!${columnToLetter(i+1)}${rowIndex}`, values: [[val]] });
            }
          });
          await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: { valueInputOption: 'USER_ENTERED', data: updates }
          });
        }
      } else {
        await appendToSheet(sheetName, data, LETTER_COLUMNS);
      }
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  OAUTH2 ROUTES
// ══════════════════════════════════════════════════════════════
app.get('/auth/google', (req, res) => {
  if (!oauth2Client) return res.status(500).send('OAuth2 not configured. Add client_id and client_secret to credentials/service-account.json');
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
    prompt: 'consent'
  });
  res.redirect(authUrl);
});

app.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('No authorization code');
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    drive = google.drive({ version: 'v3', auth: oauth2Client });
    res.send('<h1>✅ Google Drive Connected!</h1><p>You can close this tab and return to the app.</p>');
    console.log('✅ OAuth2 tokens saved');
  } catch (err) {
    res.status(500).send('Auth failed: ' + err.message);
  }
});

app.get('/api/auth/status', (req, res) => {
  const hasTokens = fs.existsSync(TOKEN_PATH);
  res.json({ configured: !!oauth2Client, authenticated: hasTokens });
});

// ══════════════════════════════════════════════════════════════
//  API ROUTES
// ══════════════════════════════════════════════════════════════
app.post('/api/extract', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    
    console.log(`\n📄 Extract: ${req.file.originalname} -> ${req.file.filename}`);
    console.log(`   Path: ${req.file.path}`);
    console.log(`   Size: ${req.file.size} bytes`);
    
    // Verify file exists
    if (!fs.existsSync(req.file.path)) {
      console.log('❌ File not found after upload:', req.file.path);
      return res.status(400).json({ success: false, error: 'File not found after upload' });
    }

    let org = req.body.organization || 'Unknown';
    const docType = req.body.type || 'letter'; // letter, ncr, joint_note
    console.log(`\n📄 Processing: ${req.file.originalname} for ${org} (${docType})`);
    
    let text;
    try {
      text = await extractText(req.file.path);
      console.log(`📝 Extracted ${text.length} characters`);
    } catch (extractErr) {
      console.log('⚠️  Text extraction failed:', extractErr.message);
      // Return a partial result with filename
      return res.json({ 
        success: true, 
        data: {
          organization: org,
          fileName: req.file.filename,
          uploadDate: new Date().toISOString().split('T')[0],
          letterType: 'General',
          status: 'Open',
          error: 'Text extraction failed: ' + extractErr.message
        }, 
        rawText: '' 
      });
    }

    if (org === 'Unknown' || !org) { 
      const det = detectOrganization(text); 
      if (det) { org = det; console.log(`🔍 Auto-detected: ${org}`); } 
    }

    let parsed;
    try {
      if (docType === 'ncr') {
        parsed = parseNCRContent(text);
        parsed.organization = org;
        parsed.fileName = req.file.filename;
        parsed.uploadDate = new Date().toISOString().split('T')[0];
      } else if (docType === 'joint_note') {
        parsed = parseJointNoteContent(text);
        parsed.organization = org;
        parsed.fileName = req.file.filename;
        parsed.uploadDate = new Date().toISOString().split('T')[0];
      } else {
        parsed = parseLetterContent(text, org);
        parsed.fileName = req.file.filename;
        parsed.detectedOrg = org;
      }
    } catch (parseErr) {
      console.log('⚠️  Content parsing failed:', parseErr.message);
      parsed = {
        organization: org,
        fileName: req.file.filename,
        uploadDate: new Date().toISOString().split('T')[0],
        letterType: 'General',
        status: 'Open',
        error: 'Parsing failed: ' + parseErr.message
      };
    }

    res.json({ success: true, data: parsed, rawText: text.substring(0, 5000) });
  } catch (err) {
    console.error('❌ Extraction error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/save', upload.single('file'), async (req, res) => {
  try {
    let data;
    try {
      data = JSON.parse(req.body.data);
    } catch (parseErr) {
      return res.status(400).json({ success: false, error: 'Invalid data format: ' + parseErr.message });
    }
    
    const org = data.organization || 'Unknown';
    const docType = data.docType || 'letter';
    let driveResult = { success: false };

    if (req.file) {
      console.log(`\n📄 Saving: ${req.file.originalname}`);
      
      // Verify file exists before processing
      if (!fs.existsSync(req.file.path)) {
        console.log('⚠️  Uploaded file not found, skipping OCR');
      } else {
        try {
          const text = await extractText(req.file.path);
          let parsed;
          if (docType === 'ncr') parsed = parseNCRContent(text);
          else if (docType === 'joint_note') parsed = parseJointNoteContent(text);
          else parsed = parseLetterContent(text, org);
          Object.assign(data, parsed);
        } catch (e) { 
          console.log('⚠️  OCR failed:', e.message); 
        }
      }

      // Upload to Drive with subfolder
      let subfolder = 'Letters';
      if (docType === 'ncr') subfolder = 'NCR';
      else if (docType === 'joint_note') subfolder = 'Joint Notes';
      
      try {
        driveResult = await uploadFileToDrive(req.file.path, req.file.originalname, org, subfolder);
        data.fileName = req.file.filename;
        if (driveResult.link) data.attachmentLink = driveResult.link;
      } catch (driveErr) {
        console.log('⚠️  Drive upload failed:', driveErr.message);
        driveResult = { success: false, error: driveErr.message };
        // Still save to sheet even if Drive fails
        data.fileName = req.file.filename;
      }
    }

    // Determine sheet name
    let sheetName = SHEET_NAMES[org] || `${org} Letters`;
    if (docType === 'ncr') sheetName = 'NCR Records';
    else if (docType === 'joint_note') sheetName = 'Joint Notes';

    const columns = docType === 'ncr' ? NCR_COLUMNS : docType === 'joint_note' ? JOINT_NOTE_COLUMNS : LETTER_COLUMNS;
    const sheetResult = await appendToSheet(sheetName, data, columns);

    res.json({ success: true, sheet: sheetResult, drive: driveResult, message: 'Saved successfully' });
  } catch (err) {
    console.error('❌ Save error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/bulk-upload', (req, res) => {
  upload.array('files', 50)(req, res, async (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    try {
      const org = req.body.organization || 'Unknown';
      const docType = req.body.type || 'letter';
      const files = req.files || [];
      if (!files.length) return res.status(400).json({ success: false, error: 'No files' });

      console.log(`\n📦 Bulk: ${files.length} files for ${org}`);
      const results = []; let ok = 0, fail = 0;

      for (const file of files) {
        try {
          const text = await extractText(file.path);
          let parsed;
          if (docType === 'ncr') parsed = parseNCRContent(text);
          else if (docType === 'joint_note') parsed = parseJointNoteContent(text);
          else parsed = parseLetterContent(text, org);
          parsed.fileName = file.filename;

          let subfolder = 'Letters';
          if (docType === 'ncr') subfolder = 'NCR';
          else if (docType === 'joint_note') subfolder = 'Joint Notes';
          const driveRes = await uploadFileToDrive(file.path, file.originalname, org, subfolder);
          if (driveRes.link) parsed.attachmentLink = driveRes.link;

          let sheetName = SHEET_NAMES[org] || `${org} Letters`;
          if (docType === 'ncr') sheetName = 'NCR Records';
          else if (docType === 'joint_note') sheetName = 'Joint Notes';
          const columns = docType === 'ncr' ? NCR_COLUMNS : docType === 'joint_note' ? JOINT_NOTE_COLUMNS : LETTER_COLUMNS;
          const sheetRes = await appendToSheet(sheetName, parsed, columns);

          results.push({ fileName: file.originalname, success: true, data: parsed, sheet: sheetRes, drive: driveRes });
          ok++;
        } catch (e) { results.push({ fileName: file.originalname, success: false, error: e.message }); fail++; }
      }
      res.json({ success: true, totalFiles: files.length, successCount: ok, failCount: fail, results });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
  });
});

app.get('/api/records', async (req, res) => {
  if (!sheets) return res.json({ success: true, data: {} });
  try {
    const allData = {};
    for (const [key, sheetName] of Object.entries(SHEET_NAMES)) {
      try {
        const range = `${sheetName}!A1:Z`;
        const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
        allData[sheetName] = result.data.values || [];
      } catch { allData[sheetName] = []; }
    }
    allDataCache = allData;
    res.json({ success: true, data: allData });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/records/:sheetName', async (req, res) => {
  if (!sheets) return res.json({ success: true, data: [] });
  try {
    const sheetName = decodeURIComponent(req.params.sheetName);
    const range = `${sheetName}!A1:Z`;
    const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
    res.json({ success: true, data: result.data.values || [] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/search', async (req, res) => {
  if (!sheets) return res.json({ success: true, data: [] });
  try {
    const q = (req.query.q || '').toLowerCase();
    const org = req.query.org || '';
    const allResults = [];

    for (const [key, sheetName] of Object.entries(SHEET_NAMES)) {
      if (org && key !== org && !sheetName.toLowerCase().includes(org.toLowerCase())) continue;
      try {
        const range = `${sheetName}!A1:Z`;
        const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
        const rows = result.data.values || [];
        if (rows.length > 1) {
          const header = rows[0];
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (q && !row.some(cell => (cell || '').toLowerCase().includes(q))) continue;
            allResults.push({ sheet: sheetName, row, index: i });
          }
        }
      } catch {}
    }
    res.json({ success: true, data: allResults, total: allResults.length });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/export/csv', async (req, res) => {
  try {
    if (!sheets) return res.status(503).json({ error: 'Google Sheets not connected. Visit /auth/google to authenticate.' });
    const sheetName = req.query.sheet || 'BEML Letters';
    const range = `${sheetName}!A1:Z`;
    const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
    const rows = result.data.values || [];
    if (!rows.length) return res.status(404).json({ error: 'No data' });
    const csv = rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${sheetName.replace(/\s/g, '_')}.csv`);
    res.send(csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/export/json', async (req, res) => {
  try {
    if (!sheets) return res.status(503).json({ error: 'Google Sheets not connected. Visit /auth/google to authenticate.' });
    const sheetName = req.query.sheet || 'BEML Letters';
    const range = `${sheetName}!A1:Z`;
    const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
    const rows = result.data.values || [];
    if (!rows.length) return res.status(404).json({ error: 'No data' });
    const header = rows[0];
    const data = rows.slice(1).map(r => { const o = {}; header.forEach((h, i) => o[h] = r[i] || ''); return o; });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/import/json', express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const records = req.body.records || req.body;
    const sheetName = req.body.sheetName || 'BEML Letters';
    if (!Array.isArray(records)) return res.status(400).json({ error: 'Invalid format' });
    
    let columns;
    if (sheetName.includes('NCR')) columns = NCR_COLUMNS;
    else if (sheetName.includes('Joint')) columns = JOINT_NOTE_COLUMNS;
    else columns = LETTER_COLUMNS;
    
    let count = 0;
    for (const r of records) { try { await appendToSheet(sheetName, r, columns); count++; } catch {} }
    res.json({ success: true, imported: count, total: records.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Excel Import Route
app.post('/api/import/excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const sheetName = req.body.sheetName || 'BEML Letters';
    const ext = path.extname(req.file.originalname).toLowerCase();
    
    if (ext !== '.xlsx' && ext !== '.xls') {
      return res.status(400).json({ success: false, error: 'Only Excel files (.xlsx, .xls) are supported' });
    }

    // Dynamic import of xlsx
    const xlsxModule = await import('xlsx');
    const XLSX = xlsxModule.default || xlsxModule;
    const workbook = XLSX.readFile(req.file.path);
    const sheetName0 = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName0];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length < 2) {
      return res.status(400).json({ success: false, error: 'Excel file is empty or has no data rows' });
    }

    const headers = jsonData[0];
    const dataRows = jsonData.slice(1);
    
    // Determine column set based on sheet name
    let columns;
    if (sheetName.includes('NCR')) columns = NCR_COLUMNS;
    else if (sheetName.includes('Joint')) columns = JOINT_NOTE_COLUMNS;
    else columns = LETTER_COLUMNS;

    console.log(`📊 Importing ${dataRows.length} rows from Excel to ${sheetName}`);
    console.log(`   Excel headers: ${headers.join(', ')}`);
    console.log(`   Target columns: ${columns.join(', ')}`);

    let count = 0;
    let errors = [];
    
    for (let i = 0; i < dataRows.length; i++) {
      try {
        const row = dataRows[i];
        const record = {};
        
        // Map Excel headers to record fields
        headers.forEach((header, idx) => {
          if (header && row[idx] !== undefined) {
            const cleanHeader = header.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
            // Find matching column in target schema
            for (const col of columns) {
              const cleanCol = col.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (cleanHeader === cleanCol || cleanHeader.includes(cleanCol) || cleanCol.includes(cleanHeader)) {
                record[col] = row[idx] !== null ? String(row[idx]) : '';
                break;
              }
            }
            // Also try direct key mapping
            const keyMap = {
              'refno': 'Ref. Letter Number', 'refnumber': 'Ref. Letter Number',
              'date': 'Date', 'from': 'From', 'to': 'To (Addressee)',
              'subject': 'Subject', 'status': 'Status', 'remarks': 'Remarks',
              'ncrno': 'NCR Report No', 'ncrnumber': 'NCR Report No',
              'ncrdate': 'Date of NCR', 'detectiondate': 'Date of Detection',
              'itemdescription': 'Item Description', 'ncrdescription': 'NCR Description',
              'trainno': 'Train No', 'car': 'Car', 'subsystem': 'Sub-System',
              'qty': 'Qty', 'responsibility': 'Responsibility',
              'faultyslno': 'Faulty Sl No', 'healthyslno': 'Healthy Sl No',
              'jointnoteno': 'Joint Note No', 'parties': 'Parties',
              'decisions': 'Decisions', 'actionitems': 'Action Items',
            };
            if (keyMap[cleanHeader] && !record[keyMap[cleanHeader]]) {
              record[keyMap[cleanHeader]] = row[idx] !== null ? String(row[idx]) : '';
            }
          }
        });

        // Add S.No if not present
        if (!record['S.No']) record['S.No'] = String(count + 1);

        await appendToSheet(sheetName, record, columns);
        count++;
      } catch (rowErr) {
        errors.push(`Row ${i + 2}: ${rowErr.message}`);
      }
    }

    // Cleanup uploaded file
    try { fs.unlinkSync(req.file.path); } catch {}

    res.json({ 
      success: true, 
      imported: count, 
      total: dataRows.length, 
      errors: errors.length > 0 ? errors.slice(0, 10) : [],
      sheetName 
    });
  } catch (err) {
    console.error('❌ Excel import error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update record status or fields
app.put('/api/update', express.json(), async (req, res) => {
  if (!sheets) return res.json({ success: true, local: true });
  try {
    const { sheetName, rowIndex, field, value } = req.body;
    if (!sheetName || rowIndex === undefined || !field) {
      return res.status(400).json({ success: false, error: 'Missing parameters' });
    }

    // Get headers to find column index
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:Z1`
    });
    const headers = headerRes.data.values ? headerRes.data.values[0] : [];
    const colIndex = headers.indexOf(field);

    if (colIndex === -1) {
      return res.status(400).json({ success: false, error: `Field '${field}' not found` });
    }

    const colLetter = String.fromCharCode(65 + colIndex);
    const range = `${sheetName}!${colLetter}${rowIndex + 1}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: 'RAW',
      requestBody: { values: [[value]] }
    });

    console.log(`✅ Updated ${sheetName} row ${rowIndex + 1}, ${field} = ${value}`);
    res.json({ success: true });
  } catch (err) {
    console.log('❌ Update failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Clear old broken data from a sheet (keep headers, remove all data rows)
app.delete('/api/clear/:sheetName', async (req, res) => {
  if (!sheets) return res.json({ success: true, local: true });
  try {
    const sheetName = decodeURIComponent(req.params.sheetName);
    // Get all data
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:Z`
    });
    const rows = result.data.values || [];
    if (rows.length <= 1) {
      return res.json({ success: true, message: 'Sheet already empty' });
    }
    // Clear all rows except header
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2:Z`
    });
    console.log(`🗑️ Cleared ${rows.length - 1} rows from ${sheetName}`);
    res.json({ success: true, cleared: rows.length - 1 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'running', googleConnected: !!sheets, timestamp: new Date().toISOString() });
});

// ══════════════════════════════════════════════════════════════
//  MASTER DATA API
// ══════════════════════════════════════════════════════════════
app.get('/api/master-data', (req, res) => {
  res.json({ success: true, data: NCR_MASTER_DATA });
});

app.get('/api/master-data/:category', (req, res) => {
  const category = req.params.category;
  if (NCR_MASTER_DATA[category]) {
    res.json({ success: true, data: NCR_MASTER_DATA[category] });
  } else {
    res.status(404).json({ success: false, error: `Category '${category}' not found` });
  }
});

// Add custom master data item
app.post('/api/master-data/:category', express.json(), async (req, res) => {
  try {
    const category = req.params.category;
    const { value } = req.body;
    if (!value) return res.status(400).json({ success: false, error: 'Value is required' });
    
    if (!NCR_MASTER_DATA[category]) {
      NCR_MASTER_DATA[category] = [];
    }
    if (!NCR_MASTER_DATA[category].includes(value)) {
      NCR_MASTER_DATA[category].push(value);
      NCR_MASTER_DATA[category].sort();
    }
    res.json({ success: true, data: NCR_MASTER_DATA[category] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Global error:', err.message);
  
  // Handle multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: 'File too large. Maximum size is 100MB.' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ success: false, error: 'Unexpected file field.' });
  }
  if (err.message && err.message.includes('Unsupported file type')) {
    return res.status(400).json({ success: false, error: err.message });
  }
  
  // Handle other errors
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

function detectOrganization(text) {
  const l = text.toLowerCase();
  if (l.includes('kmrcl') || l.includes('kolkata metro')) return 'KMRCL';
  if (l.includes('metro rail') || l.includes('metro railway')) return 'Metro Rail';
  if (l.includes('beml') || l.includes('bharat earth')) return 'BEML';
  return null;
}

const PORT = process.env.PORT || 3000;

// Initialize Google Auth and start server
async function startServer() {
  await initGoogleAuth();
  
  // Ensure all sheets exist and have headers (only when running locally)
  if (sheets && !process.env.VERCEL) {
    for (const [key, name] of Object.entries(SHEET_NAMES)) {
      await ensureSheetExists(name);
      const columns = key === 'NCR' ? NCR_COLUMNS : key === 'Joint Note' ? JOINT_NOTE_COLUMNS : LETTER_COLUMNS;
      await ensureHeaders(name, columns);
      console.log(`✅ Sheet ready: ${name} (${columns.length} columns)`);
    }
  }
  
  // Only listen for connections when running locally (not on Vercel)
  if (!process.env.VERCEL) {
    app.listen(PORT, () => {
      console.log(`\n🚀 Letter Processor v4.0 running at http://localhost:${PORT}`);
      console.log(`📊 Google Sheets: ${sheets ? 'Connected' : 'Not configured'}`);
      console.log(`📁 Google Drive: ${drive ? 'Connected' : 'Not configured'}`);
      console.log(`\n📋 Sheets: ${Object.values(SHEET_NAMES).join(', ')}\n`);
    });
  }
}

startServer().catch(console.error);

// Export for Vercel serverless functions
export default app;
