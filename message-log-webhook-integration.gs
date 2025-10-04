/**
 * Google Apps Script integration for sending d:messageLog data to Ramble webhook
 * 
 * ADD THIS TO YOUR EXISTING guestResponse.gs script - don't replace it!
 * 
 * Setup Instructions:
 * 1. Add these functions to your existing guestResponse.gs
 * 2. The webhook properties should already be set from the previous integration:
 *    - WEBHOOK_URL: Your Ramble webhook endpoint 
 *    - WEBHOOK_API_KEY: Your webhook API key
 *    - ACCOUNT_ID: Your Ramble account ID
 */

/**
 * Send message log data to Ramble webhook
 * @param {Object} messageData - The message data object to send
 * @returns {Object} Response from the webhook
 */
function sendMessageLogToWebhook(messageData) {
  const properties = PropertiesService.getScriptProperties();
  const webhookUrl = properties.getProperty('WEBHOOK_URL');
  const apiKey = properties.getProperty('WEBHOOK_API_KEY');
  const accountId = parseInt(properties.getProperty('ACCOUNT_ID')) || 1;
  
  if (!webhookUrl || !apiKey) {
    console.log('Webhook not configured - skipping message log');
    return null;
  }
  
  // Prepare payload for message_log data_type
  const payload = {
    data_type: 'message_log',
    account_id: accountId,
    message_uuid: messageData.sidSM || '',
    timestamp: messageData.timestamp ? new Date(messageData.timestamp).toISOString() : new Date().toISOString(),
    from_number: messageData.from || '',
    to_number: messageData.to || '',
    message_body: messageData.body || '',
    image_url: messageData.imageUrl || '',
    message_type: messageData.typ || 'Outbound',
    reference_message_uuids: messageData.refMsg || '',
    reference_task_uuids: messageData.refTask || '',
    booking_id: messageData.bookingId || '',
    requestor_role: messageData.requestorRole || '',
    ai_enrichment_uuid: messageData.euid || '',
    raw_data: {
      original_data: messageData,
      timestamp: new Date().toISOString(),
      sheet_name: 'd:messageLog'
    }
  };
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    },
    payload: JSON.stringify(payload)
  };
  
  try {
    const response = UrlFetchApp.fetch(webhookUrl, options);
    const responseText = response.getContentText();
    const responseCode = response.getResponseCode();
    
    console.log(`Message log webhook response (${responseCode}): ${responseText}`);
    
    if (responseCode >= 200 && responseCode < 300) {
      return JSON.parse(responseText);
    } else {
      console.error(`Message log webhook failed with status ${responseCode}: ${responseText}`);
      return null;
    }
  } catch (error) {
    console.error('Message log webhook error:', error.toString());
    return null;
  }
}

/**
 * Enhanced appendMessageLog function that includes webhook integration
 * This should REPLACE your existing appendMessageLog function in the existing script
 */
function appendMessageLogWithWebhook({sidSM, from, to, body, typ, refMsg, refTask, euid, bookingId, requestorRole}) {
  // Your existing messageLog sheet logic
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const msgSh = ss.getSheetByName('d:messageLog');
  if (!msgSh) return;

  // Your existing header mapping logic (use your existing functions)
  const norm = s => String(s||'')
    .replace(/[\u2018\u2019\u201C\u201D]/g,"'")
    .normalize('NFKC').trim().replace(/\s+/g,' ')
    .toLowerCase().replace(/[?:.,;—–-]/g,'');
  
  const headerMap = (sh) => {
    const row = sh.getRange(1,1,1,Math.max(1, sh.getLastColumn())).getValues()[0] || [];
    const m = {}; row.forEach((h,i)=>{ const n = norm(h); if (n && !m[n]) m[n]=i+1; });
    return m;
  };
  
  const pick = (map, alts) => { 
    for (const a of alts){ 
      const idx = map[norm(a)]; 
      if (idx) return idx; 
    } 
    return null; 
  };

  const Hl = headerMap(msgSh);
  const C_UUID   = pick(Hl, ['Message UUID']) || pick(Hl, ['UUID','SID','Message SID']) || 1;
  const C_DATE   = pick(Hl, ['Date','Timestamp']) || 2;
  const C_FROM   = pick(Hl, ['From']) || 3;
  const C_TO     = pick(Hl, ['To'])   || 4;
  const C_MSG    = pick(Hl, ['Message','Body']) || 5;
  const C_IMG    = pick(Hl, ['Image URL','Media URL']);
  const C_TYPE   = pick(Hl, ['Type']);
  const C_REFMSG = pick(Hl, ['Reference Message UUIDs','Reference Message Response','Message Chain UUIDs']);
  const C_REFTSK = pick(Hl, ['Reference Message UUIDs (Tasks)','Task UUIDs','Task UUID']);
  const C_BOOK   = pick(Hl, ['Booking Id','Booking ID','Reservation Id','Reservation ID']);
  const C_REQROLE = pick(Hl, ['Requestor Role','requestor_role','Requestor','Role']);
  const C_EUUID  = pick(Hl, ['Ai Enrichment UUID','AI Enrichment UUID','Enrichment UUID']) || 10;

  // Write to sheet (your existing logic)
  const lastCol = msgSh.getLastColumn();
  const outRow  = Array(lastCol).fill('');
  const set = (col, val) => { if (col && col >= 1 && col <= lastCol) outRow[col-1] = val; };
  
  set(C_UUID,  sidSM);
  set(C_DATE,  new Date());
  set(C_FROM,  from);
  set(C_TO,    to);
  set(C_MSG,   body || '');
  if (C_IMG)   set(C_IMG,  '');
  if (C_TYPE)  set(C_TYPE, typ || 'Outbound');
  if (C_REFMSG)set(C_REFMSG, refMsg || '');
  if (C_REFTSK)set(C_REFTSK, refTask || '');
  if (C_BOOK)  set(C_BOOK, bookingId || '');
  if (C_REQROLE)set(C_REQROLE, requestorRole || '');
  set(C_EUUID, euid || '');
  
  msgSh.getRange(msgSh.getLastRow() + 1, 1, 1, lastCol).setValues([outRow]);

  // NEW: Send to webhook
  sendMessageLogToWebhook({
    sidSM, 
    from, 
    to, 
    body, 
    typ, 
    refMsg, 
    refTask, 
    euid, 
    bookingId,
    requestorRole,
    timestamp: new Date()
  });
}

/**
 * Test function for message log webhook
 */
function testMessageLogWebhook() {
  const testData = {
    sidSM: 'SM' + Math.random().toString(36).substr(2, 32),
    from: '+1234567890',
    to: '+0987654321',
    body: 'Test message from webhook integration',
    typ: 'Outbound',
    refMsg: 'MSG-001',
    refTask: 'TASK-001',
    euid: 'ENRICH-001',
    bookingId: 'BOOKING-TEST-123',
    requestorRole: 'Guest',
    timestamp: new Date()
  };
  
  const response = sendMessageLogToWebhook(testData);
  
  if (response) {
    console.log('✅ Message log webhook test successful:', response);
  } else {
    console.log('❌ Message log webhook test failed');
  }
  
  return response;
}

/**
 * Send latest message log entry to webhook (for testing)
 */
function sendLatestMessageLog() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const msgSh = ss.getSheetByName('d:messageLog');
    
    if (!msgSh) {
      throw new Error('d:messageLog sheet not found');
    }
    
    const lastRow = msgSh.getLastRow();
    if (lastRow < 2) {
      throw new Error('No data rows found in d:messageLog sheet');
    }
    
    // Get the latest row data
    const rowData = msgSh.getRange(lastRow, 1, 1, msgSh.getLastColumn()).getValues()[0];
    
    // Map to messageData format (adjust column indices based on your sheet)
    const messageData = {
      sidSM: rowData[0] || '', // Column A - Message UUID
      timestamp: rowData[1] || new Date(), // Column B - Date/Timestamp
      from: rowData[2] || '', // Column C - From
      to: rowData[3] || '', // Column D - To
      body: rowData[4] || '', // Column E - Message/Body
      imageUrl: rowData[5] || '', // Column F - Image URL (if exists)
      typ: rowData[6] || 'Outbound', // Column G - Type
      refMsg: rowData[7] || '', // Column H - Reference Message UUIDs
      refTask: rowData[8] || '', // Column I - Reference Task UUIDs
      requestorRole: rowData[11] || '', // Column L - Requestor Role (adjust index based on your actual column)
      bookingId: rowData[10] || '', // Column K - Booking Id
      euid: rowData[9] || '' // Column J - AI Enrichment UUID
    };
    
    console.log('Sending latest message log to webhook:', messageData);
    
    const response = sendMessageLogToWebhook(messageData);
    
    if (response) {
      console.log('✅ Latest message log sent successfully:', response);
    } else {
      console.log('❌ Failed to send latest message log');
    }
    
    return response;
    
  } catch (error) {
    console.error('Error sending latest message log:', error.toString());
    throw error;
  }
}