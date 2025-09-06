# 🎬 AI Asset Generator - Simple Google Sheets Test

## ✅ Ready-to-Use Testing

**Your Apps Script is already deployed!**
- **URL**: https://script.google.com/d/1S_sITLVmAIB87DCqG-MhNWBy8fk_CFB9GBACX20catvVR9o62EiKWv2r/edit
- **API**: https://orchestrator-582559442661.us-central1.run.app

## 🚀 3-Minute Test Setup

### Step 1: Create Google Sheet (30 seconds)
1. Go to https://sheets.google.com
2. Create new spreadsheet
3. Name it: "AI Asset Generator Test"

### Step 2: Add Test Data (30 seconds)
Copy this data into your sheet starting at A1:

```
scene_id,prompt,ref_pack_id,ref_pack_public_url,variants,status_img,nano_img_1,nano_img_2,nano_img_3,job_id,error_msg,cost,approved_image_url,status_video
TEST-001,A warm cinematic kitchen scene with morning sunlight,REF-001,,3,,,,,,,,
TEST-002,Modern living room with cozy plants and lighting,REF-002,,2,,,,,,,,
TEST-003,Elegant bedroom with soft evening ambiance,REF-003,,1,,,,,,,,
```

### Step 3: Connect Apps Script (60 seconds)
1. In your Google Sheet: **Extensions → Apps Script**
2. Replace `Code.gs` content with:

```javascript
// Quick setup - just copy this!
const API_URL = 'https://orchestrator-582559442661.us-central1.run.app';
const API_KEY = 'YOUR_API_KEY_HERE'; // Replace with your actual API key

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎬 AI Generator')
    .addItem('🧪 Test Generate (Free)', 'testGenerate')
    .addItem('🚀 Live Generate ($)', 'liveGenerate')
    .addToUi();
}

function testGenerate() {
  generateImages('dry_run');
}

function liveGenerate() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert('Live Generation', 'This will cost money. Continue?', ui.ButtonSet.YES_NO);
  if (result === ui.Button.YES) {
    generateImages('live');
  }
}

function generateImages(mode) {
  const sheet = SpreadsheetApp.getActiveSheet();
  const selection = sheet.getSelection().getActiveRange();
  
  if (!selection || selection.getRow() === 1) {
    SpreadsheetApp.getUi().alert('Select a data row first (not header)');
    return;
  }
  
  const row = selection.getRow();
  const data = sheet.getRange(row, 1, 1, 14).getValues()[0];
  
  const payload = {
    items: [{
      scene_id: data[0],
      prompt: data[1],
      variants: parseInt(data[4]) || 1
    }],
    runMode: mode
  };
  
  try {
    sheet.getRange(row, 6).setValue('processing...');
    
    const response = UrlFetchApp.fetch(`${API_URL}/batch/images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      payload: JSON.stringify(payload)
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() === 202) {
      sheet.getRange(row, 6).setValue('queued');
      sheet.getRange(row, 10).setValue(result.job_id);
      SpreadsheetApp.getUi().alert('Success!', `Job ${result.job_id} started. Use "Refresh Status" to check progress.`);
    } else {
      sheet.getRange(row, 6).setValue('error');
      sheet.getRange(row, 11).setValue(result.detail);
      SpreadsheetApp.getUi().alert('Error', result.detail);
    }
  } catch (error) {
    sheet.getRange(row, 6).setValue('error');
    sheet.getRange(row, 11).setValue(error.message);
    SpreadsheetApp.getUi().alert('Error', error.message);
  }
}
```

3. **Save** and authorize permissions

### Step 4: Test It! (60 seconds)
1. **Refresh your Google Sheet** (you should see "🎬 AI Generator" menu)
2. **Click on row 2** (the TEST-001 data)
3. **Menu → 🧪 Test Generate (Free)**
4. Wait for "Success!" message

## 🎯 Expected Results

After running the test:
- Column F (status_img) should show "queued" 
- Column J (job_id) should have a job ID
- You should get a success popup

## ❓ Troubleshooting

**No menu appears?**
- Refresh the Google Sheet page
- Check Apps Script is saved

**"Access denied" error?**
- Click "Advanced" → "Go to project (unsafe)" when authorizing
- This is normal for new Apps Script projects

**API errors?**
- The API endpoint is live: https://orchestrator-582559442661.us-central1.run.app/healthz

## 📊 What This Tests

✅ Google Sheets ↔ Apps Script integration  
✅ Apps Script ↔ Cloud Run API connection  
✅ Authentication and error handling  
✅ Job queue system  

**Total setup time: 3 minutes**  
**Zero complexity - just copy/paste!**