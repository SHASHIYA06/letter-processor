# Letter Processor — BEML | KMRCL | Metro Rail

Enterprise document management system for BEML, KMRCL, and Metro Rail organizations.

## Features

- **Letter Processing**: Upload and extract data from PDF/JPG/PNG/TIFF/DOCX letters
- **NCR Generation**: Create Non-Conformity Reports with proper BEML format
- **PDF/DOCX Generation**: Generate professional documents matching company letterhead
- **Google Sheets Integration**: Auto-save records to organized spreadsheet tabs
- **Google Drive Upload**: Store original documents in organized folders
- **OCR Text Extraction**: Tesseract.js + pdf-parse for scanned documents
- **Live Preview**: Real-time preview while creating letters/NCRs
- **Auto-Save**: Automatic saving every 5 seconds

## Quick Start (Local)

```bash
# Clone the repository
git clone https://github.com/SHASHIYA06/letter-processor.git
cd letter-processor

# Install dependencies
npm install

# Start the server
npm start
```

Open `http://localhost:3000`

## Google Sheets/Drive Setup

### Option 1: OAuth2 (Recommended for personal use)

1. Go to https://console.cloud.google.com
2. Create a project or select existing
3. Enable: **Google Sheets API** and **Google Drive API**
4. Create OAuth 2.0 credentials (Web application)
5. Add `http://localhost:3000/auth/google/callback` as redirect URI
6. Download credentials to `credentials/oauth-config.json`
7. Visit `http://localhost:3000/auth/google` to authenticate

### Option 2: Service Account (For team/shared use)

1. Create a Service Account in Google Cloud Console
2. Download JSON key to `credentials/service-account.json`
3. Share your Google Sheet and Drive folder with the service account email

## Vercel Deployment

### Prerequisites

- GitHub repository (already configured)
- Vercel account connected to GitHub

### Deploy to Vercel

1. Go to https://vercel.com/new
2. Import the `SHASHIYA06/letter-processor` repository
3. Configure environment variables:
   - `GOOGLE_SPREADSHEET_ID`: Your Google Sheet ID
   - `GOOGLE_DRIVE_FOLDER_ID`: Your Google Drive folder ID
4. Deploy

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_SPREADSHEET_ID` | Google Sheet ID for data storage | Yes |
| `GOOGLE_DRIVE_FOLDER_ID` | Google Drive folder for file uploads | Yes |
| `PORT` | Server port (default: 3000) | No |

## Project Structure

```
letter-processor/
├── server.js              # Express server with API routes
├── pdf-generator.js       # PDF/DOCX generation engine
├── ncr-parser.js          # NCR document parser
├── public/
│   └── index.html         # Frontend SPA
├── assets/
│   ├── beml-letterhead-header.png  # BEML letter header
│   ├── beml-letterhead-footer.png  # BEML letter footer
│   ├── beml-header.jpg             # NCR left logo
│   ├── beml-logo.jpg               # NCR right logo
│   └── ncr-header.png              # NCR header image
├── credentials/           # Google API credentials (gitignored)
├── uploads/               # Temporary file uploads (gitignored)
└── vercel.json            # Vercel deployment config
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/extract` | Extract text from uploaded document |
| POST | `/api/save` | Save record to Google Sheets |
| POST | `/api/ncr/create` | Create new NCR record |
| POST | `/api/ncr/generate-pdf` | Generate NCR PDF |
| POST | `/api/ncr/generate-docx` | Generate NCR Word document |
| POST | `/api/letter/create` | Create new letter record |
| POST | `/api/letter/generate-pdf` | Generate letter PDF |
| POST | `/api/letter/generate-docx` | Generate letter Word document |
| GET | `/api/records` | Get all records from sheets |
| GET | `/api/search?q=` | Search records |

## Tech Stack

- **Backend**: Node.js + Express
- **PDF Generation**: PDFKit
- **DOCX Generation**: docx npm package
- **OCR**: Tesseract.js + pdf-parse
- **Frontend**: Vanilla JavaScript SPA
- **Storage**: Google Sheets + Google Drive
- **Deployment**: Vercel (Serverless)

## License

Private - BEML/KMRCL Project Use Only
