# Webhook Setup Guide

## Overview
This webhook endpoint allows your Google Sheets to send aiResponse data directly to your Ramble PostgreSQL database on Railway.

## Files Created
1. `backend/scripts/guest-messages-migration.js` - Database migration script
2. `backend/routes/webhook.js` - Webhook endpoint implementation
3. `google-sheets-webhook-integration.gs` - Google Apps Script integration
4. Updated `backend/server.js` with webhook route and rate limiting

## Setup Instructions

### 1. Environment Selection
**STAGING (Recommended First):**
- Branch: `develop` (current branch)
- Railway Environment: staging
- Test thoroughly before production deployment

**PRODUCTION:**
- Branch: `main` 
- Railway Environment: production
- Deploy after staging validation

### 2. Database Migration
Run this migration on your Railway PostgreSQL database:

**For Staging:**
```bash
# In Railway staging environment, run the migration:
cd backend
node scripts/guest-messages-migration.js
```

**For Production:**
```bash
# After merging to main and deploying to production:
cd backend  
node scripts/guest-messages-migration.js
```

### 3. Railway Environment Variables
Add these environment variables to your Railway deployment:

**Staging Environment:**
```
WEBHOOK_API_KEY=rambley_staging_wh_k3y_2024_a7f9c2e1d8b6
```

**Production Environment:**
```
WEBHOOK_API_KEY=rambley_prod_wh_secure_2024_x9m7n3p5q8w2
```

**Or generate your own:**
```bash
# Generate a random secure key:
openssl rand -hex 16
```

> **Security Note:** Use different API keys for staging and production

### 4. Google Apps Script Setup
1. Open your Google Sheets with the aiResponse data
2. Go to Extensions > Apps Script
3. Replace the default code with the content from `google-sheets-webhook-integration.gs`
4. Set these Script Properties (Project Settings > Script Properties):

**For Staging Testing:**
   - `WEBHOOK_URL`: `https://your-staging-app.railway.app/api/webhook/google-sheets-messages`
   - `WEBHOOK_API_KEY`: `rambley_staging_wh_k3y_2024_a7f9c2e1d8b6`
   - `ACCOUNT_ID`: Your Ramble account ID (usually `1` for demo account)

**For Production:**
   - `WEBHOOK_URL`: `https://your-production-app.railway.app/api/webhook/google-sheets-messages`
   - `WEBHOOK_API_KEY`: `rambley_prod_wh_secure_2024_x9m7n3p5q8w2`
   - `ACCOUNT_ID`: Your Ramble account ID (usually `1` for demo account)

### 5. Testing
**Staging Environment Testing:**
1. From Google Apps Script: Run `sendTestData()` function to test the connection
2. Run `sendLatestAiResponse()` to send the most recent row
3. Check Railway staging logs for successful webhook calls
4. Verify data appears in staging database `guest_messages` table

**Production Deployment:**
1. After staging validation, merge `develop` → `main` 
2. Update Google Apps Script with production webhook URL and API key
3. Use `setupAutoWebhook()` to enable automatic sending (every 5 minutes)

## Webhook Endpoints

### POST /api/webhook/google-sheets-messages
Accepts aiResponse data from Google Sheets.

**Headers:**
- `Content-Type: application/json`
- `X-API-Key: your-webhook-api-key`

**Body:**
```json
{
  "account_id": 1,
  "property_id": "PROP-001",
  "booking_id": "BOOKING-123",
  "guest_message": "Hello, I have a question...",
  "property_details_json": "{\"name\": \"Test Property\"}",
  "booking_details_json": "{\"checkin\": \"2024-01-15\"}",
  "property_faqs_json": "[{\"question\": \"...\", \"answer\": \"...\"}]",
  "escalation_risk_indicators": "Low",
  "available_knowledge": "Yes",
  "sub_category": "General Inquiry",
  "raw_data": {}
}
```

### GET /api/webhook/status
Health check endpoint for webhook service.

## Database Schema

The `guest_messages` table stores all incoming data with these fields:
- `id` - Primary key
- `account_id` - Links to your account (multi-tenant support)
- `property_id`, `booking_id` - Identifiers from your sheets
- `guest_message` - The actual message content
- `property_details_json`, `booking_details_json`, `property_faqs_json` - JSONB fields
- `escalation_risk_indicators`, `available_knowledge`, `sub_category` - Text fields
- `raw_data` - JSONB field storing the complete original data
- `created_at`, `updated_at` - Timestamps

## Security Features
- API key authentication via `X-API-Key` header
- Rate limiting: 10 requests per minute
- Row Level Security (RLS) for multi-tenant data isolation
- Request size limits and JSON validation

## Google Sheets Integration Features
- Automatic column mapping from aiResponse sheet headers
- Flexible header name matching (handles variations)
- Error handling and retry logic
- Manual and automated sending options
- Test functions for validation

## Next Steps
Once data is flowing into the `guest_messages` table, you can:
1. Build a Messages page in your Ramble frontend
2. Create API endpoints to retrieve and manage guest messages
3. Add notification systems for new messages
4. Integrate with your existing contacts and properties data