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
import { generateNCRPdf, generateLetterPdf, generateNCRDocx, generateLetterDocx, generateJointNotePdf, generateJointNoteDocx } from './pdf-generator.js';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'beml-docvault-secret-key-2024';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '9799494321';

const isVercelStorage = !!process.env.VERCEL;

function generateFilename(file) {
  const ext = path.extname(file.originalname).toLowerCase() || '.bin';
  const baseName = path.basename(file.originalname, ext)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 80);
  return `${Date.now()}_${baseName}${ext}`;
}

const storage = isVercelStorage ? multer.memoryStorage() : multer.diskStorage({
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

    // On Vercel: try OAuth tokens from environment variables
    if (process.env.VERCEL && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_ACCESS_TOKEN) {
      try {
        oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
        );
        oauth2Client.setCredentials({
          access_token: process.env.GOOGLE_ACCESS_TOKEN,
          refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
          token_type: 'Bearer'
        });
        auth = oauth2Client;
        sheets = google.sheets({ version: 'v4', auth });
        drive = google.drive({ version: 'v3', auth });
        console.log('✅ Google API authenticated (OAuth2 from env vars)');
        return;
      } catch (e) {
        console.log('⚠️  OAuth2 from env failed:', e.message);
      }
    }

    // Try OAuth2 from file (local development)
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
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '1M3k66ROJSNVUe-TB5rcF4bJ0O6obBGRp';

const DEPOTS = ['KMRCL', 'BMRCL', 'DMCRL', 'MMRCL', 'CMRCL'];

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
  'Letter Content', 'Enclosures', 'Remarks', 'Attachment Link', 'File Name', 'Status',
  'Signatory', 'Designation', 'Project', 'Cc'
];

const NCR_COLUMNS = [
  'S.No', 'NCR Report No', 'Date of NCR', 'Date of Detection',
  'Item Description', 'NCR Description', 'Part Number', 'Modified/Unmodified FMI',
  'Failure After FMI', 'Faulty Sl No', 'Healthy Sl No', 'Issued By',
  'Qty', 'Sub-System', 'Train No', 'Car', 'Responsibility',
  'Status', 'Item Repaired', 'Item Replaced', 'Date of Repair',
  'Source', 'Investigation Report Date', 'NCR Closed By Doc', 'Gate Pass No',
  'Remarks', 'IR Printed',
  'Attachment Link', 'File Name',
  'Project', 'Line', 'OEM', 'Train Set', 'Coach No',
  'NCR Category', 'NCR Type', 'Severity', 'Priority', 'System',
  'Location', 'Vendor', 'Raised By', 'Assigned To',
  'Root Cause', 'Corrective Action', 'Preventive Action', 'Disposition',
  'Closure Date', 'Closure Authority', 'Distribution', 'Assy Dwg No',
  'Rev', 'Assy Serial No', 'Part Serial No', 'Place', 'B/L No',
  'Stored At', 'Invoice No', 'Material Status', 'Disassembled',
  'Approval Scope', 'Repair Procedure'
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
  return (s || '').replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim().substring(0, maxLen);
}

// Direct mapping: data key -> column name in sheet
const LETTER_KEY_TO_COL = {
  refNumber: 'Ref. Letter Number', refLetterNumber: 'Ref. Letter Number',
  allReferences: 'All References', date: 'Date',
  from: 'From', to: 'To (Addressee)', kindAttn: 'Kind Attention', subject: 'Subject',
  letterType: 'Letter Type', letterContent: 'Letter Content', enclosures: 'Enclosures',
  remarks: 'Remarks', attachmentLink: 'Attachment Link', fileName: 'File Name', status: 'Status',
  signatory: 'Signatory', designation: 'Designation', project: 'Project', cc: 'Cc',
  uploadDate: 'Upload Date', detectedOrg: 'Detected Org'
};

const NCR_KEY_TO_COL = {
  ncrNo: 'NCR Report No', date: 'Date of NCR', detectionDate: 'Date of Detection',
  itemDesc: 'Item Description', ncrDesc: 'NCR Description', partNo: 'Part Number',
  modifiedFMI: 'Modified/Unmodified FMI', failureAfterFMI: 'Failure After FMI',
  faultySl: 'Faulty Sl No', healthySl: 'Healthy Sl No', issuedBy: 'Issued By',
  qty: 'Qty', subSystem: 'Sub-System', trainNo: 'Train No', car: 'Car',
  responsibility: 'Responsibility', status: 'Status', itemRepaired: 'Item Repaired',
  itemReplaced: 'Item Replaced', dateOfRepair: 'Date of Repair', source: 'Source',
  investigationDate: 'Investigation Report Date', ncrClosedByDoc: 'NCR Closed By Doc',
  gatePassNo: 'Gate Pass No', irPrinted: 'IR Printed', attachmentLink: 'Attachment Link',
  fileName: 'File Name', project: 'Project', line: 'Line', oem: 'OEM',
  trainSet: 'Train Set', coachNo: 'Coach No', ncrCategory: 'NCR Category',
  ncrType: 'NCR Type', severity: 'Severity', priority: 'Priority', system: 'System',
  location: 'Location', vendor: 'Vendor', raisedBy: 'Raised By', assignedTo: 'Assigned To',
  rootCause: 'Root Cause', correctiveAction: 'Corrective Action',
  preventiveAction: 'Preventive Action', disposition: 'Disposition',
  closureDate: 'Closure Date', closureAuthority: 'Closure Authority',
  // Legacy aliases from form
  vehicleNo: 'Train No', product: 'Item Description', partNumber: 'Part Number',
  supplier: 'Vendor', correction: 'Corrective Action', cause: 'Root Cause',
  issuedBy: 'Issued By'
};

const JN_KEY_TO_COL = {
  jointNoteNo: 'Joint Note No', date: 'Date', parties: 'Parties',
  description: 'Description', items: 'Items Discussed', decisions: 'Decisions',
  actionItems: 'Action Items', attachments: 'Attachments', remarks: 'Remarks'
};

function buildRow(data, columns, keyToCol) {
  return columns.map((col, idx) => {
    if (idx === 0) return ''; // S.No auto-filled
    // Find ALL data keys that map to this column, try each
    for (const [key, colName] of Object.entries(keyToCol)) {
      if (colName === col && data[key] !== undefined && data[key] !== '') {
        return clean(String(data[key]));
      }
    }
    return '';
  });
}

async function appendToSheet(sheetName, data, columns) {
  if (!sheets) {
    console.log(`📝 [LOCAL] Would append to ${sheetName}:`, JSON.stringify(data, null, 2));
    return { success: true, local: true };
  }
  try {
    await ensureHeaders(sheetName, columns);
    const sno = await getNextSerialNumber(sheetName);

    let keyToCol;
    if (sheetName.includes('NCR')) keyToCol = NCR_KEY_TO_COL;
    else if (sheetName.includes('Joint')) keyToCol = JN_KEY_TO_COL;
    else keyToCol = LETTER_KEY_TO_COL;

    const row = buildRow(data, columns, keyToCol);
    row[0] = String(sno); // S.No

    console.log(`\n📝 appendToSheet: ${sheetName} (row ${sno})`);
    const filled = columns.filter((c, i) => row[i] && row[i] !== '').length;
    console.log(`   ${filled}/${columns.length} fields filled`);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A:${columnToLetter(columns.length)}`,
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
    // Only write to file locally (Vercel has no persistent filesystem)
    if (!process.env.VERCEL) {
      try { fs.writeFileSync(TOKEN_PATH, JSON.stringify(credentials, null, 2)); } catch {}
    }
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
      // .doc is binary format — try mammoth first, then antiword, then warn
      try {
        const buffer = fs.readFileSync(filePath);
        const result = await mammoth.extractRawText({ buffer });
        if (result.value && result.value.trim().length > 10) return result.value;
      } catch {}
      try {
        return execSync(`antiword "${filePath}" 2>/dev/null || cat "${filePath}"`, { encoding: 'utf8', timeout: 30000 });
      } catch {}
      throw new Error('Cannot extract text from .doc file. Please convert to .docx first.');
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
    organization: org, letterType, refLetterNumber: extracted.refNumber || '',
    allReferences: allRefs.length > 0 ? allRefs.join(' | ') : '',
    date: extracted.date || '', from: extracted.from || '', to: extracted.to || '',
    kindAttn: extracted.kindAttn || '', subject: extracted.subject || '',
    letterContent: extracted.letterContent || '', enclosures: extracted.enclosures || '',
    remarks: remarks || '', fileName: '',
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

app.get('/api/ncr/next-number', authenticateToken, async (req, res) => {
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

app.post('/api/ncr/create', authenticateToken, async (req, res) => {
  try {
    const data = req.body;
    const result = await appendToSheet('NCR Records', data, NCR_COLUMNS);
    res.json({ success: true, sheet: result });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/ncr/update', authenticateToken, async (req, res) => {
  try {
    const { rowIndex, data } = req.body;
    // Build row data based on NCR_COLUMNS
    const ncrRow = [
      rowIndex, // S.No (keep original)
      data.ncrNo || '', data.date || '', data.detectionDate || '', data.itemDesc || data.product || '',
      data.ncrDesc || '', data.partNo || data.partNumber || '', data.modifiedFMI || '', data.failureAfterFMI || '',
      data.faultySl || '', data.healthySl || '', data.issuedBy || '', data.qty || '',
      data.subSystem || '', data.trainNo || data.vehicleNo || '', data.car || '', data.responsibility || '',
      data.status || 'Open', data.itemRepaired || '', data.itemReplaced || '',
      data.dateOfRepair || '', data.source || '', data.investigationDate || data.investigationReportDate || '',
      data.ncrClosedByDoc || '', data.gatePassNo || '', data.remarks || '', data.irPrinted || '',
      data.attachmentLink || '', data.fileName || '',
      data.project || '', data.line || '', data.oem || '', data.trainSet || '', data.coachNo || '',
      data.ncrCategory || '', data.ncrType || '', data.severity || '', data.priority || '', data.system || '',
      data.location || '', data.vendor || data.supplier || '', data.raisedBy || data.issuedBy || '', data.assignedTo || '',
      data.rootCause || data.cause || '', data.correctiveAction || data.correction || '', data.preventiveAction || '',
      data.disposition || '', data.closureDate || '', data.closureAuthority || '',
      data.distribution || '', data.assyDwgNo || '', data.rev || '',
      data.assySerialNo || '', data.partSerialNo || '', data.place || '',
      data.blNo || '', data.storedAt || '', data.invoiceNo || '',
      data.materialStatus || '', data.disassembled || '',
      data.approvalScope || '', data.repairProcedure || ''
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

app.get('/api/ncr/clone/:idx', authenticateToken, async (req, res) => {
  try {
    const rows = allDataCache['NCR Records'] || [];
    const idx = parseInt(req.params.idx, 10);
    if (isNaN(idx) || !rows[idx]) return res.status(404).json({ success: false, error: 'NCR not found' });
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
      5: 'ncrDesc', 6: 'partNo', 7: 'modifiedFMI', 8: 'failureAfterFMI',
      9: 'faultySl', 10: 'healthySl', 11: 'issuedBy', 12: 'qty',
      13: 'subSystem', 14: 'trainNo', 15: 'car', 16: 'responsibility',
      17: 'status', 18: 'itemRepaired', 19: 'itemReplaced', 20: 'dateOfRepair',
      21: 'source', 22: 'investigationReportDate', 23: 'ncrClosedByDoc', 24: 'gatePassNo',
      25: 'remarks', 26: 'irPrinted',
      27: 'attachmentLink', 28: 'fileName',
      29: 'project', 30: 'line', 31: 'oem', 32: 'trainSet', 33: 'coachNo',
      34: 'ncrCategory', 35: 'ncrType', 36: 'severity', 37: 'priority', 38: 'system',
      39: 'location', 40: 'vendor', 41: 'raisedBy', 42: 'assignedTo',
      43: 'rootCause', 44: 'correctiveAction', 45: 'preventiveAction', 46: 'disposition',
      47: 'closureDate', 48: 'closureAuthority'
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

app.post('/api/ncr/generate-pdf', authenticateToken, async (req, res) => {
  try {
    const data = req.body;
    const fileName = `NCR_${(data.ncrNo || 'draft').replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
    const tmpDir = isVercelStorage ? '/tmp' : path.join(__dirname, 'uploads');
    const outputPath = path.join(tmpDir, fileName);
    await generateNCRPdf(data, outputPath);
    const fileBuffer = fs.readFileSync(outputPath);
    const base64 = fileBuffer.toString('base64');
    if (!isVercelStorage) { try { fs.unlinkSync(outputPath); } catch {} }
    res.json({ success: true, pdfData: base64, fileName });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/ncr/generate-docx', authenticateToken, async (req, res) => {
  try {
    const data = req.body;
    const fileName = `NCR_${(data.ncrNo || 'draft').replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.docx`;
    const tmpDir = isVercelStorage ? '/tmp' : path.join(__dirname, 'uploads');
    const outputPath = path.join(tmpDir, fileName);
    await generateNCRDocx(data, outputPath);
    const fileBuffer = fs.readFileSync(outputPath);
    const base64 = fileBuffer.toString('base64');
    if (!isVercelStorage) { try { fs.unlinkSync(outputPath); } catch {} }
    res.json({ success: true, docxData: base64, fileName });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/letter/next-number/:org', authenticateToken, async (req, res) => {
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

app.post('/api/letter/create', authenticateToken, async (req, res) => {
  try {
    const { organization, ...data } = req.body;
    const org = organization || 'BEML';
    const sheetName = SHEET_NAMES[org] || `${org} Letters`;
    const result = await appendToSheet(sheetName, data, LETTER_COLUMNS);
    res.json({ success: true, sheet: result });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/letter/generate-pdf', authenticateToken, async (req, res) => {
  try {
    const data = req.body;
    const fileName = `Letter_${(data.refNumber || 'draft').replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
    const tmpDir = isVercelStorage ? '/tmp' : path.join(__dirname, 'uploads');
    const outputPath = path.join(tmpDir, fileName);
    await generateLetterPdf(data, outputPath);
    const fileBuffer = fs.readFileSync(outputPath);
    const base64 = fileBuffer.toString('base64');
    if (!isVercelStorage) { try { fs.unlinkSync(outputPath); } catch {} }
    res.json({ success: true, pdfData: base64, fileName });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/letter/generate-docx', authenticateToken, async (req, res) => {
  try {
    const data = req.body;
    const fileName = `Letter_${(data.refNumber || 'draft').replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.docx`;
    const tmpDir = isVercelStorage ? '/tmp' : path.join(__dirname, 'uploads');
    const outputPath = path.join(tmpDir, fileName);
    await generateLetterDocx(data, outputPath);
    const fileBuffer = fs.readFileSync(outputPath);
    const base64 = fileBuffer.toString('base64');
    if (!isVercelStorage) { try { fs.unlinkSync(outputPath); } catch {} }
    res.json({ success: true, docxData: base64, fileName });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/auto-save', authenticateToken, async (req, res) => {
  try {
    const { docType, data, rowIndex, organization } = req.body;
    
    // Skip auto-save if data is empty/meaningless
    if (docType === 'ncr' && (!data.ncrNo || data.ncrNo.trim() === '')) {
      return res.json({ success: true, skipped: true });
    }
    if (docType === 'letter' && (!data.refNumber || data.refNumber.trim() === '')) {
      return res.json({ success: true, skipped: true });
    }
    if (docType === 'joint_note' && (!data.jointNoteNo || data.jointNoteNo.trim() === '')) {
      return res.json({ success: true, skipped: true });
    }
    
    let sheetName;
    if (docType === 'ncr') {
      sheetName = 'NCR Records';
      if (rowIndex) {
        if (sheets) {
          const updates = [];
          NCR_COLUMNS.forEach((col, i) => {
            if (i > 0) {
              let val = '';
              for (const [key, colName] of Object.entries(NCR_KEY_TO_COL)) {
                if (colName === col && data[key] !== undefined && data[key] !== '') {
                  val = clean(String(data[key]));
                  break;
                }
              }
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
              let val = '';
              for (const [key, colName] of Object.entries(LETTER_KEY_TO_COL)) {
                if (colName === col && data[key] !== undefined && data[key] !== '') {
                  val = clean(String(data[key]));
                  break;
                }
              }
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
//  JOINT NOTE CRUD
// ══════════════════════════════════════════════════════════════

app.get('/api/joint-note/next-number', authenticateToken, async (req, res) => {
  try {
    if (!sheets) return res.json({ success: true, number: `JN-${new Date().getFullYear()}-001` });
    const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Joint Notes!A:A' });
    const count = (result.data.values?.length || 1);
    const year = new Date().getFullYear();
    res.json({ success: true, number: `JN-${year}-${String(count).padStart(3, '0')}` });
  } catch (e) { res.json({ success: true, number: `JN-${new Date().getFullYear()}-001` }); }
});

app.post('/api/joint-note/create', authenticateToken, async (req, res) => {
  try {
    const data = req.body;
    const row = [
      '', // S.No (auto)
      data.jointNoteNo || '',
      data.date || '',
      data.parties || '',
      data.subject || '',
      data.description || '',
      data.itemsDiscussed || '',
      data.decisions || '',
      data.actionItems || '',
      '', // Attachments
      '', // Attachment Link
      '', // File Name
      data.status || 'Open'
    ];
    if (sheets) {
      const result = await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID, range: 'Joint Notes', valueInputOption: 'RAW',
        requestBody: { values: [row] }
      });
      const sno = result.data.updates?.updatedRange?.match(/(\d+)$/)?.[1] || '';
      res.json({ success: true, sheet: { sno: parseInt(sno) - 1 } });
    } else {
      res.json({ success: false, error: 'Sheets not connected' });
    }
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/joint-note/generate-pdf', authenticateToken, async (req, res) => {
  try {
    const data = req.body;
    const fileName = `JointNote_${(data.jointNoteNo || 'draft').replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
    const tmpDir = isVercelStorage ? '/tmp' : path.join(__dirname, 'uploads');
    const outputPath = path.join(tmpDir, fileName);
    await generateJointNotePdf(data, outputPath);
    const fileBuffer = fs.readFileSync(outputPath);
    const pdfBase64 = fileBuffer.toString('base64');
    if (!isVercelStorage) { try { fs.unlinkSync(outputPath); } catch {} }
    res.json({ success: true, pdfData: pdfBase64, fileName });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/joint-note/generate-docx', authenticateToken, async (req, res) => {
  try {
    const data = req.body;
    const fileName = `JointNote_${(data.jointNoteNo || 'draft').replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.docx`;
    const tmpDir = isVercelStorage ? '/tmp' : path.join(__dirname, 'uploads');
    const outputPath = path.join(tmpDir, fileName);
    await generateJointNoteDocx(data, outputPath);
    const fileBuffer = fs.readFileSync(outputPath);
    const docxBase64 = fileBuffer.toString('base64');
    if (!isVercelStorage) { try { fs.unlinkSync(outputPath); } catch {} }
    res.json({ success: true, docxData: docxBase64, fileName });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════
function detectOrganization(text) {
  const l = text.toLowerCase();
  if (l.includes('kmrcl') || l.includes('kolkata metro')) return 'KMRCL';
  if (l.includes('metro rail') || l.includes('metro railway')) return 'Metro Rail';
  if (l.includes('beml') || l.includes('bharat earth')) return 'BEML';
  return null;
}

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
    
    if (process.env.VERCEL) {
      // On Vercel: show tokens for env var setup
      res.send(`
        <h1>✅ Authentication Successful!</h1>
        <p>Copy these values to your Vercel Environment Variables:</p>
        <pre style="background:#f5f5f5;padding:15px;border-radius:8px;overflow-x:auto;font-size:12px">
GOOGLE_CLIENT_ID=${oauth2Client._clientId || 'your_client_id'}
GOOGLE_CLIENT_SECRET=${oauth2Client._clientSecret || 'your_client_secret'}
GOOGLE_ACCESS_TOKEN=${tokens.access_token}
GOOGLE_REFRESH_TOKEN=${tokens.refresh_token || 'N/A (run auth again with prompt=consent)'}
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
        </pre>
        <p>After setting these in Vercel, redeploy your project.</p>
        <p><strong>Important:</strong> The refresh_token is only available on first authorization. If missing, revoke access at <a href="https://myaccount.google.com/permissions">Google Account Permissions</a> and re-authorize.</p>
      `);
    } else {
      // Local: save to file
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      res.send('<h1>✅ Google Drive Connected!</h1><p>You can close this tab and return to the app.</p>');
    }
    
    sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    drive = google.drive({ version: 'v3', auth: oauth2Client });
    console.log('✅ OAuth2 tokens saved');
  } catch (err) {
    res.status(500).send('Auth failed: ' + err.message);
  }
});

app.get('/api/auth/status', (req, res) => {
  const hasTokens = process.env.VERCEL 
    ? !!(process.env.GOOGLE_ACCESS_TOKEN && process.env.GOOGLE_REFRESH_TOKEN)
    : fs.existsSync(TOKEN_PATH);
  res.json({ configured: !!oauth2Client || !!(process.env.GOOGLE_CLIENT_ID), authenticated: hasTokens, isVercel: !!process.env.VERCEL });
});

// ══════════════════════════════════════════════════════════════
//  LOGIN AUTHENTICATION
// ══════════════════════════════════════════════════════════════

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password required' });
  }
  
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign(
      { username: ADMIN_USERNAME, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log(`✅ Admin login successful: ${username}`);
    res.json({ success: true, token, username: ADMIN_USERNAME, depots: DEPOTS });
  } else {
    console.log(`❌ Failed login attempt: ${username}`);
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

// Verify token endpoint
app.get('/api/auth/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.json({ valid: false });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, username: decoded.username });
  } catch (err) {
    res.json({ valid: false });
  }
});

// Logout endpoint (client-side token removal, but we can log it)
app.post('/api/logout', (req, res) => {
  console.log('ℹ️  User logged out');
  res.json({ success: true });
});

// Auth middleware for protected routes
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

// ══════════════════════════════════════════════════════════════
//  API ROUTES (Protected)
// ══════════════════════════════════════════════════════════════

function getFilePath(req) {
  if (req.file.path) return req.file.path;
  if (!req.file.filename) req.file.filename = generateFilename(req.file);
  const tmpDir = isVercelStorage ? '/tmp' : path.join(__dirname, 'uploads');
  if (!isVercelStorage && !fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, req.file.filename);
  fs.writeFileSync(tmpPath, req.file.buffer);
  return tmpPath;
}

app.post('/api/extract', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    
    const filePath = getFilePath(req);
    console.log(`\n📄 Extract: ${req.file.originalname} -> ${req.file.filename}`);
    console.log(`   Path: ${filePath}`);
    console.log(`   Size: ${req.file.size} bytes`);
    
    // Verify file exists
    if (!fs.existsSync(filePath)) {
      console.log('❌ File not found after upload:', filePath);
      return res.status(400).json({ success: false, error: 'File not found after upload' });
    }

    let org = req.body.organization || 'Unknown';
    const docType = req.body.type || 'letter'; // letter, ncr, joint_note
    console.log(`\n📄 Processing: ${req.file.originalname} for ${org} (${docType})`);
    
    let text;
    try {
      text = await extractText(filePath);
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

app.post('/api/save', authenticateToken, upload.single('file'), async (req, res) => {
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
      const filePath = getFilePath(req);
      
      // Verify file exists before processing
      if (!fs.existsSync(filePath)) {
        console.log('⚠️  Uploaded file not found, skipping OCR');
      } else {
        try {
          const text = await extractText(filePath);
          let parsed;
          if (docType === 'ncr') parsed = parseNCRContent(text);
          else if (docType === 'joint_note') parsed = parseJointNoteContent(text);
          else parsed = parseLetterContent(text, org);
          for (const [k, v] of Object.entries(parsed)) {
            if (v && !data[k]) data[k] = v;
          }
        } catch (e) { 
          console.log('⚠️  OCR failed:', e.message); 
        }
      }

      // Upload to Drive with subfolder
      let subfolder = 'Letters';
      if (docType === 'ncr') subfolder = 'NCR';
      else if (docType === 'joint_note') subfolder = 'Joint Notes';
      
      try {
        driveResult = await uploadFileToDrive(filePath, req.file.originalname, org, subfolder);
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

app.post('/api/bulk-upload', authenticateToken, (req, res) => {
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
          if (!file.filename) file.filename = generateFilename(file);
          const filePath = file.path || (() => {
            const tmpDir = isVercelStorage ? '/tmp' : path.join(__dirname, 'uploads');
            if (!isVercelStorage && !fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
            const tmpPath = path.join(tmpDir, file.filename);
            fs.writeFileSync(tmpPath, file.buffer);
            return tmpPath;
          })();
          const text = await extractText(filePath);
          let parsed;
          if (docType === 'ncr') parsed = parseNCRContent(text);
          else if (docType === 'joint_note') parsed = parseJointNoteContent(text);
          else parsed = parseLetterContent(text, org);
          parsed.fileName = file.filename;

          let subfolder = 'Letters';
          if (docType === 'ncr') subfolder = 'NCR';
          else if (docType === 'joint_note') subfolder = 'Joint Notes';
          const driveRes = await uploadFileToDrive(filePath, file.originalname, org, subfolder);
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

app.get('/api/records', authenticateToken, async (req, res) => {
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

app.get('/api/records/:sheetName', authenticateToken, async (req, res) => {
  if (!sheets) return res.json({ success: true, data: [] });
  try {
    const sheetName = decodeURIComponent(req.params.sheetName);
    const range = `${sheetName}!A1:Z`;
    const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
    res.json({ success: true, data: result.data.values || [] });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/api/search', authenticateToken, async (req, res) => {
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

app.get('/api/export/csv', authenticateToken, async (req, res) => {
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

app.get('/api/export/json', authenticateToken, async (req, res) => {
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

app.post('/api/import/json', authenticateToken, async (req, res) => {
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
app.post('/api/import/excel', authenticateToken, upload.single('file'), async (req, res) => {
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
    const filePath = getFilePath(req);
    const workbook = XLSX.readFile(filePath);
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
    try { fs.unlinkSync(filePath); } catch {}

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

// CSV Import Route for NCR Master List
app.post('/api/import/csv', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const sheetName = req.body.sheetName || 'NCR Records';
    const ext = path.extname(req.file.originalname).toLowerCase();
    
    if (ext !== '.csv') {
      return res.status(400).json({ success: false, error: 'Only CSV files are supported' });
    }

    const filePath = getFilePath(req);
    const csvContent = fs.readFileSync(filePath, 'utf8');
    
    // Parse CSV (handle quoted fields with commas and newlines)
    function parseCSV(text) {
      const rows = [];
      let currentRow = [];
      let currentField = '';
      let inQuotes = false;
      
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        
        if (inQuotes) {
          if (char === '"' && nextChar === '"') {
            currentField += '"';
            i++;
          } else if (char === '"') {
            inQuotes = false;
          } else {
            currentField += char;
          }
        } else {
          if (char === '"') {
            inQuotes = true;
          } else if (char === ',') {
            currentRow.push(currentField.trim());
            currentField = '';
          } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
            currentRow.push(currentField.trim());
            if (currentRow.some(f => f !== '')) rows.push(currentRow);
            currentRow = [];
            currentField = '';
            if (char === '\r') i++;
          } else {
            currentField += char;
          }
        }
      }
      currentRow.push(currentField.trim());
      if (currentRow.some(f => f !== '')) rows.push(currentRow);
      return rows;
    }
    
    const allRows = parseCSV(csvContent);
    if (allRows.length < 2) {
      return res.status(400).json({ success: false, error: 'CSV file is empty or has no data rows' });
    }

    const headers = allRows[0];
    const dataRows = allRows.slice(1);
    
    console.log(`📊 Importing ${dataRows.length} rows from CSV to ${sheetName}`);
    console.log(`   CSV headers: ${headers.join(', ')}`);
    console.log(`   Target columns: ${NCR_COLUMNS.join(', ')}`);

    // Map CSV headers to NCR_COLUMNS
    const headerMap = {};
    headers.forEach((h, i) => {
      const clean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      // Map CSV headers to our column names
      const csvToNCR = {
        'sl': 'S.No', 'ncrreportno': 'NCR Report No', 'ncrnumber': 'NCR Report No',
        'dateofncr': 'Date of NCR', 'dateofdetection': 'Date of Detection',
        'itemdescription': 'Item Description', 'ncrdescription': 'NCR Description',
        'partnumber': 'Part Number', 'modifiedunmodifiedfmi': 'Modified/Unmodified FMI',
        'failureafterfmi': 'Failure After FMI', 'faultyslno': 'Faulty Sl No',
        'healthyslno': 'Healthy Sl No', 'issuedby': 'Issued By',
        'qty': 'Qty', 'subsystem': 'Sub-System', 'trainno': 'Train No',
        'car': 'Car', 'responsibility': 'Responsibility',
        'status': 'Status', 'itemrepaired': 'Item Repaired',
        'itemreplaced': 'Item Replaced', 'dateofrepair': 'Date of Repair',
        'source': 'Source', 'investigationreportdate': 'Investigation Report Date',
        'ncrclosedbydoc': 'NCR Closed By Doc', 'gatepassno': 'Gate Pass No',
        'remarks': 'Remarks', 'irprinted': 'IR Printed',
        'project': 'Project', 'line': 'Line', 'oem': 'OEM',
        'trainset': 'Train Set', 'coachno': 'Coach No',
        'ncrcategory': 'NCR Category', 'ncrtype': 'NCR Type',
        'severity': 'Severity', 'priority': 'Priority', 'system': 'System',
        'location': 'Location', 'vendor': 'Vendor', 'raisedby': 'Raised By',
        'assignedto': 'Assigned To', 'rootcause': 'Root Cause',
        'correctiveaction': 'Corrective Action', 'preventiveaction': 'Preventive Action',
        'disposition': 'Disposition', 'closuredate': 'Closure Date',
        'closureauthority': 'Closure Authority'
      };
      if (csvToNCR[clean]) headerMap[i] = csvToNCR[clean];
    });

    let count = 0;
    let errors = [];
    
    for (let i = 0; i < dataRows.length; i++) {
      try {
        const row = dataRows[i];
        const record = {};
        
        // Map CSV data to record using headerMap
        for (const [csvIdx, ncrCol] of Object.entries(headerMap)) {
          const csvIndex = parseInt(csvIdx);
          if (row[csvIndex] !== undefined && row[csvIndex] !== '') {
            record[ncrCol] = String(row[csvIndex]);
          }
        }

        // Add S.No if not present
        if (!record['S.No']) record['S.No'] = String(count + 1);

        await appendToSheet(sheetName, record, NCR_COLUMNS);
        count++;
      } catch (rowErr) {
        errors.push(`Row ${i + 2}: ${rowErr.message}`);
      }
    }

    // Cleanup uploaded file
    try { fs.unlinkSync(filePath); } catch {}

    res.json({ 
      success: true, 
      imported: count, 
      total: dataRows.length, 
      errors: errors.length > 0 ? errors.slice(0, 10) : [],
      sheetName 
    });
  } catch (err) {
    console.error('❌ CSV import error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update record status or fields
app.put('/api/update', authenticateToken, async (req, res) => {
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

    const colLetter = columnToLetter(colIndex + 1);
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

// Delete a single record by shifting rows up
app.delete('/api/delete', authenticateToken, async (req, res) => {
  if (!sheets) return res.json({ success: true, local: true });
  try {
    const { sheetName, rowIndex } = req.body;
    if (!sheetName || rowIndex === undefined) return res.status(400).json({ success: false, error: 'Missing parameters' });
    const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A1:ZZ` });
    const rows = result.data.values || [];
    if (rowIndex >= rows.length) return res.status(400).json({ success: false, error: 'Row index out of range' });
    rows.splice(rowIndex, 1);
    await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A1:ZZ` });
    if (rows.length > 0) {
      await sheets.spreadsheets.values.update({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A1`, valueInputOption: 'RAW', requestBody: { values: rows } });
    }
    console.log(`🗑️ Deleted row ${rowIndex} from ${sheetName}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Clear old broken data from a sheet (keep headers, remove all data rows)
app.delete('/api/clear/:sheetName', authenticateToken, async (req, res) => {
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
app.post('/api/master-data/:category', authenticateToken, async (req, res) => {
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

// ══════════════════════════════════════════════════════════════
//  DEPOTS & VENDOR LIST
// ══════════════════════════════════════════════════════════════
app.get('/api/depots', (req, res) => {
  res.json({ success: true, depots: DEPOTS });
});

app.get('/api/vendor-list', authenticateToken, async (req, res) => {
  try {
    if (!sheets) return res.json({ success: true, vendors: [] });
    const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'NCR Records!Q:Q' });
    const vendors = [...new Set((result.data.values || []).slice(1).map(r => r[0]).filter(Boolean))].sort();
    res.json({ success: true, vendors });
  } catch (e) { res.json({ success: true, vendors: [] }); }
});

// ══════════════════════════════════════════════════════════════
//  TEMPLATE-BASED GENERATION (Fallback when AI unavailable)
// ══════════════════════════════════════════════════════════════

function generateLetterTemplate({ org, subject, recipient, context, letterType }) {
  const orgFull = org === 'KMRCL' ? 'Kolkata Metro Rail Corporation Limited' : org === 'Metro Rail' ? 'Metro Rail Corporation' : 'BEML Limited';
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `Ref: ${org}/${letterType || 'General'}/${new Date().getFullYear()}/___

Date: ${today}

To,
${recipient || 'Sir/Madam'}

Subject: ${subject || 'Official Communication'}

Dear Sir/Madam,

${context || 'This is with reference to the above-mentioned subject.'}

We wish to bring to your kind attention the matter pertaining to the subject cited above. The details of the same are as under:

1. The matter has been reviewed by the undersigned and necessary action is being initiated accordingly.

2. We request your good office to take note of the above and take necessary action at your end.

3. Any observations or clarifications, if any, may be communicated to the undersigned within 7 working days from the date of receipt of this letter.

We hope this meets with your approval.

Thanking you,

Yours faithfully,

For ${orgFull}
Authorized Signatory`;
}

function generateReplyTemplate({ originalRef, originalSubject, originalFrom, org }) {
  const orgFull = org === 'KMRCL' ? 'Kolkata Metro Rail Corporation Limited' : org === 'Metro Rail' ? 'Metro Rail Corporation' : 'BEML Limited';
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `Ref: ${org}/REPLY/${new Date().getFullYear()}/___

Date: ${today}

To,
${originalFrom || 'Sir/Madam'}

Subject: Re: ${originalSubject || 'Your correspondence'}

Reference: Your letter ${originalRef || 'Not specified'}

Dear Sir/Madam,

We acknowledge the receipt of your letter referenced above regarding "${originalSubject || 'the subject matter'}".

After careful consideration of the points raised in your communication, we wish to convey the following:

1. The matter has been examined in detail by the concerned department.

2. Necessary corrective/preventive action is being initiated as appropriate.

3. We request you to kindly bear with us while we complete the necessary formalities.

4. We shall revert with our detailed response at the earliest, preferably within 15 working days.

For any further clarification, please feel free to contact the undersigned.

Thanking you,

Yours faithfully,

For ${orgFull}
Authorized Signatory`;
}

function generateNCRTemplate({ project, itemDesc, severity, trainNo, car, vendor, context }) {
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `NON-CONFORMITY REPORT (NCR)

NCR Report No: NCR-${new Date().getFullYear()}/___
Date of NCR: ${today}
Date of Detection: ${today}

PROJECT: ${project || 'To be determined'}
ITEM DESCRIPTION: ${itemDesc || 'To be determined'}
TRAIN NO: ${trainNo || 'N/A'}
CAR: ${car || 'N/A'}
VENDOR/OEM: ${vendor || 'N/A'}
SEVERITY: ${severity || 'Major'}

DESCRIPTION OF NON-CONFORMITY:
${context || 'The non-conformity observed is as follows: The item/product does not conform to the specified requirements as per the approved drawings/specifications.'}

ROOT CAUSE ANALYSIS:
The root cause of the non-conformity is under investigation. Preliminary assessment indicates the issue may be related to:
- Material quality deviation
- Process deviation during manufacturing
- Non-adherence to approved specifications

CORRECTIVE ACTION:
1. Immediate containment action has been initiated.
2. The defective items have been quarantined.
3. Supplier/vendor has been notified for root cause analysis.

PREVENTIVE ACTION:
1. Enhanced incoming inspection protocol to be implemented.
2. Periodic audit of supplier processes to be conducted.
3. Training awareness for relevant personnel.

DISPOSITION:
To be determined based on engineering evaluation.

RAISED BY: _______________
ASSIGNED TO: _______________
STATUS: Open`;
}

// ══════════════════════════════════════════════════════════════
//  AI INTEGRATION - Letter & NCR Generation
// ══════════════════════════════════════════════════════════════

async function callAI(prompt, systemPrompt) {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || '';
  const provider = (process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : 'openai')).toLowerCase();
  const model = process.env.AI_MODEL || 'gpt-4o-mini';

  if (!apiKey) throw new Error('AI API key not configured. Set AI_API_KEY in environment.');

  if (provider === 'gemini') {
    const geminiModel = process.env.AI_MODEL || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: (systemPrompt || '') + '\n\n' + prompt }] }] })
    });
    const data = await res.json();
    if (data.error) {
      console.error('❌ Gemini API error:', data.error.message || JSON.stringify(data.error));
      throw new Error(data.error.message || 'Gemini API error');
    }
    console.log('✅ Gemini response received');
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model, temperature: 0.7, max_tokens: 4000,
      messages: [
        { role: 'system', content: systemPrompt || 'You are an expert BEML railway documentation assistant. Generate professional, formal, technically accurate content following Indian railway documentation standards.' },
        { role: 'user', content: prompt }
      ]
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'OpenAI API error');
  return data.choices?.[0]?.message?.content || '';
}

app.post('/api/ai/generate-letter', authenticateToken, async (req, res) => {
  try {
    const { org, subject, recipient, context, tone, letterType } = req.body;
    const orgName = org || 'BEML';
    let content = '';
    let source = 'ai';

    try {
      const prompt = `Generate a professional ${orgName} official letter with the following details:
Subject: ${subject || 'To be determined'}
Recipient: ${recipient || 'Sir/Madam'}
Context/Purpose: ${context || 'Official correspondence'}
Letter Type: ${letterType || 'General'}
Tone: ${tone || 'Professional and formal'}

Generate the complete letter body in professional railway documentation style. Include proper salutation, structured body paragraphs, and formal closing. Use Indian English and official government/PSU communication style.`;
      content = await callAI(prompt);
    } catch (aiErr) {
      console.log('⚠️ AI generation failed, using template:', aiErr.message);
      source = 'template';
      content = generateLetterTemplate({ org: orgName, subject, recipient, context, letterType });
    }

    res.json({ success: true, content, source });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/ai/generate-reply', authenticateToken, async (req, res) => {
  try {
    const { originalLetter, originalRef, originalSubject, originalFrom, org, customInstructions } = req.body;
    let content = '';
    let source = 'ai';

    try {
      const prompt = `You are an expert BEML (Bharat Earth Movers Limited) correspondence officer. Generate a professional REPLY letter from BEML against the following incoming letter:

Original Reference: ${originalRef || 'Not specified'}
From: ${originalFrom || 'Not specified'}
Subject: ${originalSubject || 'Not specified'}
Original Letter Content:
${originalLetter || 'Not provided'}

${customInstructions ? `Additional Instructions: ${customInstructions}` : ''}

Generate a complete BEML reply letter including:
1. BEML Reference Number format: BEML/PROJECT/DEPT/NUMBER/YEAR
2. Date
3. To address (respond to the original sender)
4. Subject line with "Re:" prefix and original reference
5. Proper reference to original letter
6. Professional response addressing all points
7. Technical commitments if applicable
8. Proper closing with for BEML Limited

Use formal Indian PSU communication style. Be technically precise and professional.`;
      content = await callAI(prompt, 'You are an expert BEML letter drafting assistant. Generate professional reply letters in BEML official format. Use Indian English, formal PSU communication style, and railway engineering terminology.');
    } catch (aiErr) {
      console.log('⚠️ AI reply failed, using template:', aiErr.message);
      source = 'template';
      content = generateReplyTemplate({ originalRef, originalSubject, originalFrom, org });
    }

    res.json({ success: true, content, source });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/ai/generate-ncr', authenticateToken, async (req, res) => {
  try {
    const { project, itemDesc, severity, context, trainNo, car, vendor } = req.body;
    let content = '';
    let source = 'ai';

    try {
      const prompt = `Generate a professional BEML Non-Conformity Report (NCR) content with the following details:

Project: ${project || 'Not specified'}
Item/Product: ${itemDesc || 'Not specified'}
Severity: ${severity || 'Major'}
Train No: ${trainNo || 'Not specified'}
Car: ${car || 'Not specified'}
Vendor/OEM: ${vendor || 'Not specified'}
Context/Issue: ${context || 'Not specified'}

Generate the following NCR sections:
1. Description of Non-Conformity (detailed technical description)
2. Root Cause Analysis (systematic root cause with 5-Why analysis)
3. Corrective Action (immediate fix and long-term correction)
4. Preventive Action (measures to prevent recurrence)
5. Disposition recommendation

Use professional railway engineering language, BEML standards, and Indian railway terminology. Be technically precise.`;
      content = await callAI(prompt, 'You are an expert BEML quality assurance engineer. Generate professional NCR content using railway engineering terminology, Indian railway standards, and formal quality documentation style.');
    } catch (aiErr) {
      console.log('⚠️ AI NCR failed, using template:', aiErr.message);
      source = 'template';
      content = generateNCRTemplate({ project, itemDesc, severity, trainNo, car, vendor, context });
    }

    res.json({ success: true, content, source });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/ai/improve-content', authenticateToken, async (req, res) => {
  try {
    const { content, type, instructions } = req.body;
    let improved = '';
    let source = 'ai';

    try {
      const typeLabel = type === 'ncr' ? 'NCR' : type === 'letter' ? 'official letter' : 'document';
      const prompt = `Improve the following ${typeLabel} content. Make it more professional, technically accurate, and well-structured:

Original Content:
${content}

${instructions ? `Specific improvements requested: ${instructions}` : ''}

Return the improved content maintaining the same structure and key information. Use formal Indian PSU/railway documentation style.`;
      improved = await callAI(prompt);
    } catch (aiErr) {
      console.log('⚠️ AI improve failed:', aiErr.message);
      source = 'template';
      improved = content + '\n\n[Note: AI improvement unavailable. Enable Gemini API at https://console.developers.google.com/apis/api/generativelanguage.googleapis.com]';
    }

    res.json({ success: true, content: improved, source });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/ai/status', (req, res) => {
  const hasKey = !!(process.env.AI_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);
  const provider = process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : 'openai');
  res.json({ configured: hasKey, provider, model: process.env.AI_MODEL || (provider === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o-mini') });
});

// ══════════════════════════════════════════════════════════════
//  REPLY LETTER GENERATION - Parse incoming & generate BEML reply
// ══════════════════════════════════════════════════════════════

app.post('/api/letter/generate-reply', authenticateToken, async (req, res) => {
  try {
    const { letterContent, refNumber, subject, from, to, org } = req.body;
    const incomingText = letterContent || req.body.text || '';
    const parsed = parseLetterContent(incomingText, org || 'BEML');

    const replyData = {
      incomingRef: refNumber || parsed.refLetterNumber || '',
      incomingSubject: subject || parsed.subject || '',
      incomingFrom: from || parsed.from || '',
      incomingDate: parsed.date || '',
      incomingTo: parsed.to || '',
      incomingContent: incomingText.substring(0, 2000),
      replySubject: 'Re: ' + (subject || parsed.subject || 'Your correspondence'),
      replyTo: from || parsed.from || '',
      replyDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    };

    let aiReply = '';
    try {
      const prompt = `Generate a BEML reply letter against:
From: ${replyData.incomingFrom}
Ref: ${replyData.incomingRef}
Subject: ${replyData.incomingSubject}
Content: ${replyData.incomingContent}

Generate a professional BEML reply with proper reference, technical response, and formal closing.`;
      aiReply = await callAI(prompt, 'You are BEML correspondence expert. Generate formal reply letters.');
    } catch (aiErr) {
      console.log('AI reply generation failed, using template:', aiErr.message);
      aiReply = `We acknowledge receipt of your letter ref: ${replyData.incomingRef} regarding "${replyData.incomingSubject}".

We are examining the matter and shall revert with our detailed response at the earliest.

For any clarifications, please contact the undersigned.

Thanking you,
Yours faithfully,
For BEML Limited`;
    }

    res.json({ success: true, replyData, aiContent: aiReply });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
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
