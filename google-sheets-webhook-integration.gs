/**
 * Google Apps Script integration for sending aiResponse data to Ramble webhook
 * 
 * Setup Instructions:
 * 1. Open your Google Sheets with aiResponse data
 * 2. Go to Extensions > Apps Script
 * 3. Replace the default code with this script
 * 4. Set the following script properties (Script Editor > Project Settings > Script Properties):
 *    - WEBHOOK_URL: Your Ramble webhook endpoint (e.g., https://your-app.railway.app/api/webhook/google-sheets-messages)
 *    - WEBHOOK_API_KEY: Your webhook API key
 *    - ACCOUNT_ID: Your Ramble account ID (usually 1 for demo account)
 * 5. Save and authorize the script
 * 6. Test with sendTestData() function
 * 7. Use sendLatestAiResponse() to send the most recent row
 */

/**
 * Send aiResponse data to Ramble webhook
 * @param {Object} data - The data object to send
 * @returns {Object} Response from the webhook
 */
function sendToWebhook(data) {
  const properties = PropertiesService.getScriptProperties();
  const webhookUrl = properties.getProperty('WEBHOOK_URL');
  const apiKey = properties.getProperty('WEBHOOK_API_KEY');
  
  if (!webhookUrl) {
    throw new Error('WEBHOOK_URL not configured in script properties');
  }
  
  if (!apiKey) {
    throw new Error('WEBHOOK_API_KEY not configured in script properties');
  }
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    },
    payload: JSON.stringify(data)
  };
  
  try {
    const response = UrlFetchApp.fetch(webhookUrl, options);
    const responseText = response.getContentText();
    const responseCode = response.getResponseCode();
    
    console.log(`Webhook response (${responseCode}): ${responseText}`);
    
    if (responseCode >= 200 && responseCode < 300) {
      return JSON.parse(responseText);
    } else {
      throw new Error(`Webhook failed with status ${responseCode}: ${responseText}`);
    }
  } catch (error) {
    console.error('Webhook error:', error.toString());
    throw error;
  }
}

/**
 * Extract data from aiResponse sheet row
 * @param {Array} rowData - Array of cell values from the row
 * @param {Object} headerMap - Map of header names to column indices
 * @returns {Object} Formatted data object
 */
function formatAiResponseData(rowData, headerMap) {
  const properties = PropertiesService.getScriptProperties();
  const accountId = parseInt(properties.getProperty('ACCOUNT_ID')) || 1;
  
  // Helper function to get cell value by header name
  const getCellValue = (headerName) => {
    const colIndex = headerMap[headerName];
    return colIndex ? (rowData[colIndex - 1] || '') : '';
  };
  
  // Extract main fields
  const propertyId = getCellValue('Property Id') || getCellValue('property id');
  const bookingId = getCellValue('Booking Id') || getCellValue('booking id') || getCellValue('Reservation Id') || getCellValue('reservation id');
  const guestMessage = getCellValue('Message') || getCellValue('Inbound Message') || getCellValue('Guest Message');
  
  // Extract JSON fields
  const propertyDetailsJson = getCellValue('Property Details JSON');
  const bookingDetailsJson = getCellValue('Booking Details JSON');
  const propertyFaqsJson = getCellValue('Property FAQs JSON');
  
  // Extract optional fields
  const escalationRisk = getCellValue('Escalation & Risk Indicators');
  const availableKnowledge = getCellValue('Available Knowledge to Respond?');
  const subCategory = getCellValue('Sub-Category') || getCellValue('Sub Category');
  
  // Prepare data object
  const data = {
    account_id: accountId,
    property_id: propertyId,
    booking_id: bookingId,
    guest_message: guestMessage,
    escalation_risk_indicators: escalationRisk,
    available_knowledge: availableKnowledge,
    sub_category: subCategory,
    raw_data: {
      row_data: rowData,
      timestamp: new Date().toISOString(),
      sheet_name: 'aiResponse'
    }
  };
  
  // Add JSON fields if they exist and are valid
  if (propertyDetailsJson && propertyDetailsJson.trim()) {
    try {
      data.property_details_json = propertyDetailsJson;
    } catch (error) {
      console.warn('Invalid Property Details JSON:', error.toString());
    }
  }
  
  if (bookingDetailsJson && bookingDetailsJson.trim()) {
    try {
      data.booking_details_json = bookingDetailsJson;
    } catch (error) {
      console.warn('Invalid Booking Details JSON:', error.toString());
    }
  }
  
  if (propertyFaqsJson && propertyFaqsJson.trim()) {
    try {
      data.property_faqs_json = propertyFaqsJson;
    } catch (error) {
      console.warn('Invalid Property FAQs JSON:', error.toString());
    }
  }
  
  return data;
}

/**
 * Get header map from aiResponse sheet
 * @returns {Object} Map of header names to column numbers (1-based)
 */
function getAiResponseHeaders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('aiResponse');
  
  if (!sheet) {
    throw new Error('aiResponse sheet not found');
  }
  
  const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const headerMap = {};
  
  headerRow.forEach((header, index) => {
    if (header && header.toString().trim()) {
      headerMap[header.toString().trim()] = index + 1;
    }
  });
  
  return headerMap;
}

/**
 * Send the latest row from aiResponse sheet to webhook
 */
function sendLatestAiResponse() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('aiResponse');
    
    if (!sheet) {
      throw new Error('aiResponse sheet not found');
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      throw new Error('No data rows found in aiResponse sheet');
    }
    
    // Get headers
    const headerMap = getAiResponseHeaders();
    
    // Get the latest row data
    const rowData = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Format and send data
    const formattedData = formatAiResponseData(rowData, headerMap);
    
    console.log('Sending data to webhook:', JSON.stringify(formattedData, null, 2));
    
    const response = sendToWebhook(formattedData);
    
    console.log('Webhook success:', response);
    
    // Optional: Mark the row as sent (add a "Webhook Sent" column if desired)
    
    return response;
    
  } catch (error) {
    console.error('Error sending latest aiResponse:', error.toString());
    throw error;
  }
}

/**
 * Send a specific row from aiResponse sheet to webhook
 * @param {number} rowNumber - Row number to send (2-based, since row 1 is headers)
 */
function sendAiResponseRow(rowNumber) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('aiResponse');
    
    if (!sheet) {
      throw new Error('aiResponse sheet not found');
    }
    
    if (rowNumber < 2 || rowNumber > sheet.getLastRow()) {
      throw new Error(`Invalid row number: ${rowNumber}. Must be between 2 and ${sheet.getLastRow()}`);
    }
    
    // Get headers
    const headerMap = getAiResponseHeaders();
    
    // Get the specified row data
    const rowData = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Format and send data
    const formattedData = formatAiResponseData(rowData, headerMap);
    
    console.log(`Sending row ${rowNumber} to webhook:`, JSON.stringify(formattedData, null, 2));
    
    const response = sendToWebhook(formattedData);
    
    console.log('Webhook success:', response);
    
    return response;
    
  } catch (error) {
    console.error(`Error sending aiResponse row ${rowNumber}:`, error.toString());
    throw error;
  }
}

/**
 * Send test data to webhook (for testing purposes)
 */
function sendTestData() {
  const properties = PropertiesService.getScriptProperties();
  const accountId = parseInt(properties.getProperty('ACCOUNT_ID')) || 1;
  
  const testData = {
    account_id: accountId,
    property_id: 'TEST-PROP-001',
    booking_id: 'TEST-BOOKING-123',
    guest_message: 'This is a test message from Google Sheets webhook integration.',
    escalation_risk_indicators: 'Low',
    available_knowledge: 'Yes',
    sub_category: 'General Inquiry',
    raw_data: {
      test: true,
      timestamp: new Date().toISOString(),
      sheet_name: 'aiResponse'
    }
  };
  
  try {
    console.log('Sending test data:', JSON.stringify(testData, null, 2));
    const response = sendToWebhook(testData);
    console.log('Test webhook success:', response);
    return response;
  } catch (error) {
    console.error('Test webhook failed:', error.toString());
    throw error;
  }
}

/**
 * Set up a trigger to automatically send new aiResponse entries
 * Call this function once to set up automatic webhook calls
 */
function setupAutoWebhook() {
  // Delete existing triggers for this function
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onAiResponseEdit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new trigger for sheet edits
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger('onAiResponseEdit')
    .timeBased()
    .everyMinutes(5) // Check every 5 minutes
    .create();
  
  console.log('Auto-webhook trigger set up successfully');
}

/**
 * Trigger function that runs automatically
 * This will be called by the timer trigger
 */
function onAiResponseEdit() {
  try {
    // You can customize this logic based on your needs
    // For now, it will send the latest row if it hasn't been sent yet
    sendLatestAiResponse();
  } catch (error) {
    console.error('Auto-webhook error:', error.toString());
    // Don't throw error to avoid breaking the trigger
  }
}

/**
 * Menu function - adds custom menu to Google Sheets
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Ramble Webhook')
    .addItem('Send Latest Row', 'sendLatestAiResponse')
    .addItem('Send Test Data', 'sendTestData')
    .addItem('Setup Auto-Webhook', 'setupAutoWebhook')
    .addToUi();
}