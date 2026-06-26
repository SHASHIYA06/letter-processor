#!/bin/bash
# Google Cloud Setup Script for Letter Processor
# Run this script to set up Google Sheets and Drive integration

echo "=========================================="
echo "  Google Cloud Setup for Letter Processor"
echo "=========================================="
echo ""

# Step 1: Install gcloud CLI if not present
if ! command -v gcloud &> /dev/null; then
    echo "Installing Google Cloud CLI..."
    brew install google-cloud-sdk 2>/dev/null || {
        echo "Please install gcloud manually:"
        echo "  brew install google-cloud-sdk"
        echo "  OR visit: https://cloud.google.com/sdk/docs/install"
        exit 1
    }
fi

echo "Step 1: Login to Google Cloud"
gcloud auth login

echo ""
echo "Step 2: Create or select project"
echo "Available projects:"
gcloud projects list --format="table(projectId,name)"
echo ""
read -p "Enter project ID (or press Enter to create new): " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    read -p "Enter name for new project: " PROJECT_NAME
    PROJECT_ID="letter-processor-$(date +%s)"
    gcloud projects create $PROJECT_ID --name="$PROJECT_NAME"
fi

gcloud config set project $PROJECT_ID

echo ""
echo "Step 3: Enable APIs"
gcloud services enable sheets.googleapis.com
gcloud services enable drive.googleapis.com

echo ""
echo "Step 4: Create service account"
SA_NAME="letter-processor-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create $SA_NAME \
    --display-name="Letter Processor Service Account" \
    --description="Service account for Letter Processor app" 2>/dev/null || echo "Service account may already exist"

echo ""
echo "Step 5: Download credentials"
mkdir -p credentials
gcloud iam service-accounts keys create credentials/service-account.json \
    --iam-account=$SA_EMAIL

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Service Account Email: $SA_EMAIL"
echo ""
echo "NEXT STEPS:"
echo "1. Open your Google Sheet"
echo "2. Click Share → Add: $SA_EMAIL → Editor"
echo "3. Open your Drive folder"
echo "4. Click Share → Add: $SA_EMAIL → Editor"
echo ""
echo "Then restart the app:"
echo "  cd ~/letter\\ application"
echo "  pkill -f 'node server.js'"
echo "  node server.js"
echo ""
