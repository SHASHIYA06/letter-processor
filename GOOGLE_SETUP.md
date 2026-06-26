# Google Cloud Console Setup Guide

## Step 1: Create Google Cloud Project
1. Go to https://console.cloud.google.com
2. Click the project dropdown at the top → **New Project**
3. Name: `Letter-Processor` → Click **Create**
4. Wait for project to be created, then select it

## Step 2: Enable APIs
1. Go to https://console.cloud.google.com/apis/library
2. Search **Google Sheets API** → Click **Enable**
3. Search **Google Drive API** → Click **Enable**

## Step 3: Create Service Account
1. Go to https://console.cloud.google.com/iam-admin/serviceaccounts
2. Click **Create Service Account**
3. Name: `letter-processor-sa`
4. Click **Create and Continue**
5. Role: Select **Editor** (or leave empty)
6. Click **Done**

## Step 4: Download Credentials JSON
1. Click on the service account you just created
2. Go to **Keys** tab → **Add Key** → **Create new key**
3. Select **JSON** → Click **Create**
4. Save the downloaded JSON file

## Step 5: Place the JSON File
Copy the downloaded file to:
```
~/letter application/credentials/service-account.json
```

## Step 6: Share Your Google Sheet
1. Open your sheet: https://docs.google.com/spreadsheets/d/1qx5FAkOE959ng8eOGb_NC_DuF381x-NYRwKED0hgRIk/edit
2. Click **Share** button (top right)
3. Paste the service account email (from the JSON file, field: `client_email`)
4. Set permission: **Editor**
5. Click **Share**

## Step 7: Share Your Drive Folder
1. Open your folder: https://drive.google.com/drive/folders/1M3k66ROJSNVUe-TB5rcF4bJ0O6obBGRp
2. Click **Share** button
3. Paste the same service account email
4. Set permission: **Editor**
5. Click **Share**

## Step 8: Restart the App
```bash
cd ~/letter\ application
pkill -f "node server.js"
node server.js
```

Open http://localhost:3000 — Google Sheets and Drive should show as "Connected"
