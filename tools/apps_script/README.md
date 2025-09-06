# Google Apps Script UI - Deployment Guide

## ✅ **TUNNEL ACTIVE: PUBLIC URL AVAILABLE**

**✅ LocalTunnel running**: `https://upset-lemons-run.loca.lt`
**✅ Backend verified**: Working on localhost:9090
**✅ API tested**: `/batch/sheets` endpoint responding correctly

**Active Tunnel URL:**
```
https://upset-lemons-run.loca.lt
```

## 🚨 **Status: NOT TESTED - REQUIRES DEPLOYMENT**

This implementation has **NOT been tested** and requires manual deployment to Google Apps Script to validate functionality.

## 📁 **Files to Deploy**

```
tools/apps_script/
├── Code.gs          # Main Apps Script file
├── sidebar.html     # Sidebar UI (must be in root)
├── appsscript.json  # Manifest with OAuth scopes
└── README.md        # This file
```

## 🔧 **Deployment Steps**

### 1. Create Apps Script Project
1. Go to [script.google.com](https://script.google.com)
2. Click "New Project"
3. Rename to "AI Asset Generation UI"

### 2. Upload Files
1. **Enable manifest**: Gear icon → check "Show appsscript.json manifest file"
2. **Copy `Code.gs` content** into the default `Code.gs` file
3. **Add HTML file**: Click ➕ → HTML file → name it `sidebar`
4. **Copy `sidebar.html` content** into the new HTML file
5. **Copy `appsscript.json` content** into the manifest file

### 3. Configure Permissions
1. Save the project (Ctrl+S)
2. Run any function to trigger permission setup
3. Accept all required permissions:
   - Google Sheets access
   - External URL access (for API calls)

### 4. Set Up Configuration Sheet
1. **FIRST: Set up ngrok tunnel** (see top of README)
2. In your Google Sheet, add a "CONFIG" tab
3. Add configuration:
   ```
   A1: Setting          B1: Value
   A2: API_BASE_URL     B2: https://upset-lemons-run.loca.lt
   A3: MAX_ROWS_PER_BATCH B3: 10
   ```
   **✅ READY**: URL is active and tested

## 🧪 **Testing Checklist**

### **Phase 1: Menu Integration**
- [ ] Menu appears: "AI" with 4 items
- [ ] Dry-run shows cost estimation
- [ ] Live requires typed confirmation
- [ ] Video shows "not implemented" message
- [ ] Sidebar opens without errors

### **Phase 2: API Integration** 
- [ ] Dry-run makes single POST to `/batch/sheets`
- [ ] Live mode makes single POST with correct payload
- [ ] Error handling shows user-friendly messages
- [ ] Cost calculation matches backend ($0.002 per image)

### **Phase 3: Sidebar Functionality**
- [ ] Shows selected rows with cost preview
- [ ] Displays thumbnails when exactly 1 row selected
- [ ] Thumbnail click selects image
- [ ] Approve button writes `approved_image_url`
- [ ] Refresh updates data from sheet

## ⚠️ **Known Issues to Test**

1. **PUBLIC URL REQUIREMENT**: Apps Script cannot call localhost - ngrok tunnel required
2. **HTML File Reference**: Fixed to use `'sidebar'` instead of `'ui/sidebar'`
3. **API URL Configuration**: Uses CONFIG sheet, must be HTTPS public URL
4. **Header Case Sensitivity**: Uses `.toLowerCase()` for header matching
5. **Sheet Structure Validation**: Requires all headers from REQUIRED_HEADERS array

## 🔧 **Likely Fixes Needed After Testing**

1. **ngrok URL Updates**: Each ngrok restart generates new URL - update CONFIG sheet
2. **Error Messages**: May need adjustment based on actual backend responses
3. **Header Mapping**: May need tweaking for case sensitivity
4. **Cost Format**: Backend returns `$0.0040`, UI expects same format
5. **OAuth Permissions**: May need reauthorization after manifest changes

## 📋 **Backend Compatibility Requirements**

The Apps Script expects these backend behaviors:

### **POST /batch/sheets**
```javascript
// Request
{
  "runMode": "dry_run|live",
  "rowFilter": {
    "status": "all",
    "limit": 10
  }
}

// Response
{
  "batchId": "job_123",
  "processed": 5,
  "results": [...]
}
```

### **Sheet Headers Expected**
```
scene_id, prompt, variants, status_img, nano_img_1, nano_img_2, nano_img_3, job_id, error_msg, cost
```

### **Error Response Format**
```javascript
{
  "error": "VALIDATION_ERROR",
  "message": "Description",
  "issues": [...]  // For Zod validation errors
}
```

## 🎯 **Next Steps**

1. **Deploy** files to Google Apps Script
2. **Test** basic menu functionality
3. **Fix** any reference/permission issues
4. **Test** API integration with local backend
5. **Update** CONFIG sheet with real API URL
6. **Validate** end-to-end workflow

## 📝 **Testing Notes**

After deployment, test with:
- Sheet with proper headers and cost column
- Backend running on localhost:9090
- Service account permissions configured
- At least one row with generated images for sidebar testing