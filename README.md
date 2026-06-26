# Letter Processor — BEML | KMRCL | Metro Rail

## Quick Start

```bash
cd ~/letter\ application
npm install
node server.js
```

Open `http://localhost:3000`

## Google Sheets/Drive Setup

1. Go to https://console.cloud.google.com
2. Create a project or select existing
3. Enable: **Google Sheets API** and **Google Drive API**
4. Create a **Service Account** → download JSON key
5. Save as `credentials/service-account.json`
6. Share your Google Sheet and Drive folder with the service account email

## Features

- Upload PDF/JPG/PNG/TIFF/DOCX/TXT letters
- OCR text extraction (Tesseract.js + pdf-parse + mammoth)
- Auto-parse: Ref Number, Date, Subject, From, To, Enclosures
- Save to Google Sheets (all 3 org columns)
- Upload files to Google Drive folder
- Manual entry mode
- Dark mode UI
