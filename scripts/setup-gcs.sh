#!/bin/bash

# Google Cloud Storage Setup Script
# Run this after setting your PROJECT_ID

# Set your project ID here
PROJECT_ID="solid-study-467023-i3"
BUCKET_NAME="${PROJECT_ID}-ai-assets"
REGION="us-central1"

echo "🚀 Setting up Google Cloud Storage for AI Asset Generation Platform"
echo "Project: $PROJECT_ID"
echo "Bucket: $BUCKET_NAME"
echo "Region: $REGION"
echo

# Set the project
echo "Setting active project..."
gcloud config set project $PROJECT_ID

# Create the bucket
echo "Creating GCS bucket..."
gcloud storage buckets create gs://$BUCKET_NAME \
    --location=$REGION \
    --uniform-bucket-level-access

# Set bucket lifecycle (auto-delete temp files after 30 days)
echo "Setting up lifecycle policy..."
cat > lifecycle.json << EOF
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {
        "age": 30,
        "matchesPrefix": ["temp/"]
      }
    }
  ]
}
EOF

gcloud storage buckets update gs://$BUCKET_NAME --lifecycle-file=lifecycle.json
rm lifecycle.json

# Set CORS policy for web access
echo "Setting CORS policy..."
cat > cors.json << EOF
[
  {
    "origin": ["*"],
    "method": ["GET"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
EOF

gcloud storage buckets update gs://$BUCKET_NAME --cors-file=cors.json
rm cors.json

# Create folder structure
echo "Creating folder structure..."
echo "" | gcloud storage cp - gs://$BUCKET_NAME/images/.keep
echo "" | gcloud storage cp - gs://$BUCKET_NAME/videos/.keep
echo "" | gcloud storage cp - gs://$BUCKET_NAME/temp/.keep

echo
echo "✅ GCS Setup Complete!"
echo
echo "Your bucket: gs://$BUCKET_NAME"
echo "Add this to your environment variables:"
echo "export GCS_BUCKET=$BUCKET_NAME"
echo
echo "Next steps:"
echo "1. Update your .env.local file with the bucket name"
echo "2. Set up authentication (service account or gcloud auth)"