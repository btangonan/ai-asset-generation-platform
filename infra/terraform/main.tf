# AI Asset Generation Platform - Terraform Infrastructure
# This sets up the core GCP resources needed for the platform

terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# Configure the Google Cloud Provider
provider "google" {
  project = var.project_id
  region  = var.region
}

# Variables
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "storage.googleapis.com",
    "pubsub.googleapis.com",
    "sheets.googleapis.com",
    "aiplatform.googleapis.com",
  ])

  service = each.key
  
  disable_dependent_services = false
  disable_on_destroy         = false
}

# GCS Bucket for AI-generated assets
resource "google_storage_bucket" "ai_assets" {
  name          = "${var.project_id}-ai-renders"
  location      = var.region
  force_destroy = false

  # Enable versioning
  versioning {
    enabled = true
  }

  # Lifecycle rules for cost optimization
  lifecycle_rule {
    condition {
      age = 90
      matches_prefix = ["images/"]
      matches_suffix = ["var_1.png", "var_2.png", "var_3.png"]
    }
    action {
      type = "Delete"
    }
  }

  # Keep approved images longer
  lifecycle_rule {
    condition {
      age = 365
      matches_prefix = ["images/"]
      matches_suffix = ["approved/seed.png"]
    }
    action {
      type = "Delete"
    }
  }

  # CORS settings for web access
  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD"]
    response_header = ["*"]
    max_age_seconds = 3600
  }

  # Prevent public access by default
  public_access_prevention = "enforced"
}

# Pub/Sub Topic for image processing
resource "google_pubsub_topic" "image_processing" {
  name = "image-processing"

  # Enable message ordering if needed
  enable_message_ordering = false
}

# Pub/Sub Subscription for image processing
resource "google_pubsub_subscription" "image_processing_sub" {
  name  = "image-processing-sub"
  topic = google_pubsub_topic.image_processing.name

  # Acknowledgment deadline
  ack_deadline_seconds = 600 # 10 minutes for long-running image generation

  # Dead letter queue after 5 retries
  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.image_processing_dlq.id
    max_delivery_attempts = 5
  }

  # Retry policy with exponential backoff
  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "300s"
  }

  # Enable exactly-once delivery
  enable_exactly_once_delivery = true
}

# Dead letter queue for failed jobs
resource "google_pubsub_topic" "image_processing_dlq" {
  name = "image-processing-dlq"
}

resource "google_pubsub_subscription" "image_processing_dlq_sub" {
  name  = "image-processing-dlq-sub"
  topic = google_pubsub_topic.image_processing_dlq.name

  # Long retention for failed jobs analysis
  message_retention_duration = "604800s" # 7 days
}

# Service Account for the orchestrator service
resource "google_service_account" "orchestrator" {
  account_id   = "ai-orchestrator"
  display_name = "AI Asset Generation Orchestrator"
  description  = "Service account for AI asset generation platform"
}

# IAM roles for the orchestrator service account
resource "google_project_iam_member" "orchestrator_roles" {
  for_each = toset([
    "roles/storage.objectUser",           # Read/write GCS objects
    "roles/pubsub.publisher",            # Publish to Pub/Sub topics
    "roles/pubsub.subscriber",           # Subscribe to Pub/Sub subscriptions
    "roles/sheets.developer",            # Access Google Sheets API
    "roles/aiplatform.user",             # Access Vertex AI (for Phase 2)
  ])

  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.orchestrator.email}"
}

# Secret Manager secrets (create manually with actual values)
resource "google_secret_manager_secret" "gemini_api_key" {
  secret_id = "gemini-api-key"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "sheets_api_key" {
  secret_id = "sheets-api-key"

  replication {
    auto {}
  }
}

# Grant orchestrator access to secrets
resource "google_secret_manager_secret_iam_member" "orchestrator_secrets" {
  for_each = toset([
    google_secret_manager_secret.gemini_api_key.secret_id,
    google_secret_manager_secret.sheets_api_key.secret_id,
  ])

  secret_id = each.key
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.orchestrator.email}"
}

# Cloud Run service (placeholder - will be deployed via Cloud Build)
data "google_cloud_run_service" "orchestrator" {
  name     = "ai-orchestrator"
  location = var.region
  
  # This will error if service doesn't exist yet, which is expected for initial deployment
  depends_on = []
}

# Outputs
output "project_id" {
  description = "GCP Project ID"
  value       = var.project_id
}

output "bucket_name" {
  description = "GCS bucket name for AI assets"
  value       = google_storage_bucket.ai_assets.name
}

output "pubsub_topic" {
  description = "Pub/Sub topic for image processing"
  value       = google_pubsub_topic.image_processing.name
}

output "service_account_email" {
  description = "Service account email for orchestrator"
  value       = google_service_account.orchestrator.email
}

output "region" {
  description = "GCP region"
  value       = var.region
}