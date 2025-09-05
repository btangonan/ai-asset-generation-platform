#!/bin/bash

# Google Cloud Authentication Setup Script
# Run this after setting your PROJECT_ID

PROJECT_ID="your-project-id"
SERVICE_ACCOUNT_NAME="ai-asset-generator"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
KEY_FILE="./service-account-key.json"

echo "🔐 Setting up Google Cloud Authentication"
echo "Project: $PROJECT_ID"
echo "Service Account: $SERVICE_ACCOUNT_EMAIL"
echo

# Set the project
gcloud config set project $PROJECT_ID

# Create service account
echo "Creating service account..."
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --display-name="AI Asset Generator Service Account" \
    --description="Service account for AI asset generation platform"

# Grant necessary permissions
echo "Granting permissions..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/sheets.editor"

# Create and download service account key
echo "Creating service account key..."
gcloud iam service-accounts keys create $KEY_FILE \
    --iam-account=$SERVICE_ACCOUNT_EMAIL

echo
echo "✅ Authentication Setup Complete!"
echo
echo "Service account key saved to: $KEY_FILE"
echo
echo "Add this to your environment:"
echo "export GOOGLE_APPLICATION_CREDENTIALS=$(pwd)/$KEY_FILE"
echo
echo "⚠️  IMPORTANT: Keep the service account key secure!"
echo "   - Add $KEY_FILE to .gitignore"
echo "   - Never commit it to version control"
echo "   - Use environment variables in production"