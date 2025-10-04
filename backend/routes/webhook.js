import express from 'express';
import { validationResult, body } from 'express-validator';
import pool from '../config/database.js';

const router = express.Router();

// API Key authentication middleware
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.WEBHOOK_API_KEY;
  
  if (!expectedApiKey) {
    return res.status(500).json({ error: 'Webhook API key not configured' });
  }
  
  if (!apiKey || apiKey !== expectedApiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
};

// Validation rules for webhook data
const webhookValidation = [
  body('account_id').isInt({ min: 1 }).withMessage('Valid account_id is required'),
  body('data_type').isIn(['guest_message', 'message_log']).withMessage('data_type must be guest_message or message_log'),
  body('raw_data').optional(),
  
  // Guest message specific fields
  body('property_id').optional().trim(),
  body('booking_id').optional().trim(),
  body('guest_message').optional().trim(),
  body('property_details_json').optional().isJSON().withMessage('Property details must be valid JSON'),
  body('booking_details_json').optional().isJSON().withMessage('Booking details must be valid JSON'),
  body('property_faqs_json').optional().isJSON().withMessage('Property FAQs must be valid JSON'),
  body('escalation_risk_indicators').optional().trim(),
  body('available_knowledge').optional().trim(),
  body('sub_category').optional().trim(),
  
  // Message log specific fields
  body('message_uuid').optional().trim(),
  body('timestamp').optional().isISO8601().withMessage('timestamp must be valid ISO8601 date'),
  body('from_number').optional().trim(),
  body('to_number').optional().trim(),
  body('message_body').optional().trim(),
  body('image_url').optional().trim(),
  body('message_type').optional().trim(),
  body('reference_message_uuids').optional().trim(),
  body('reference_task_uuids').optional().trim(),
  body('requestor_role').optional().trim(),
  body('ai_enrichment_uuid').optional().trim()
];

// POST /api/webhook/google-sheets-messages - Accept data from Google Sheets (guest_message or message_log)
router.post('/google-sheets-messages', authenticateApiKey, webhookValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { account_id, data_type, raw_data } = req.body;

    // Route to appropriate handler based on data_type
    if (data_type === 'guest_message') {
      return await handleGuestMessage(req, res);
    } else if (data_type === 'message_log') {
      return await handleMessageLog(req, res);
    } else {
      return res.status(400).json({ 
        error: 'Invalid data_type',
        message: 'data_type must be guest_message or message_log'
      });
    }

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to process webhook data'
    });
  }
});

// Handle guest message data
async function handleGuestMessage(req, res) {
  const {
    account_id,
    property_id,
    booking_id,
    guest_message,
    property_details_json,
    booking_details_json,
    property_faqs_json,
    escalation_risk_indicators,
    available_knowledge,
    sub_category,
    raw_data
  } = req.body;

  if (!guest_message) {
    return res.status(400).json({ 
      error: 'Validation failed',
      message: 'guest_message is required for guest_message data_type'
    });
  }

  // Parse JSON fields if they're strings
  let propertyDetails = null;
  let bookingDetails = null;
  let propertyFaqs = null;
  
  try {
    if (property_details_json) {
      propertyDetails = typeof property_details_json === 'string' 
        ? JSON.parse(property_details_json) 
        : property_details_json;
    }
    
    if (booking_details_json) {
      bookingDetails = typeof booking_details_json === 'string' 
        ? JSON.parse(booking_details_json) 
        : booking_details_json;
    }
    
    if (property_faqs_json) {
      propertyFaqs = typeof property_faqs_json === 'string' 
        ? JSON.parse(property_faqs_json) 
        : property_faqs_json;
    }
  } catch (jsonError) {
    return res.status(400).json({ 
      error: 'Invalid JSON format in data fields',
      details: jsonError.message
    });
  }

  // Insert into guest_messages table
  const result = await pool.query(`
    INSERT INTO guest_messages (
      account_id,
      property_id,
      booking_id,
      guest_message,
      property_details_json,
      booking_details_json,
      property_faqs_json,
      escalation_risk_indicators,
      available_knowledge,
      sub_category,
      raw_data,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
    RETURNING id, created_at
  `, [
    account_id,
    property_id || null,
    booking_id || null,
    guest_message,
    propertyDetails,
    bookingDetails,
    propertyFaqs,
    escalation_risk_indicators || null,
    available_knowledge || null,
    sub_category || null,
    raw_data || null
  ]);

  const insertedMessage = result.rows[0];

  return res.status(201).json({
    success: true,
    message: 'Guest message stored successfully',
    data_type: 'guest_message',
    data: {
      id: insertedMessage.id,
      created_at: insertedMessage.created_at
    }
  });
}

// Handle message log data
async function handleMessageLog(req, res) {
  const {
    account_id,
    message_uuid,
    timestamp,
    from_number,
    to_number,
    message_body,
    image_url,
    message_type,
    reference_message_uuids,
    reference_task_uuids,
    booking_id,
    requestor_role,
    ai_enrichment_uuid,
    raw_data
  } = req.body;

  if (!message_uuid) {
    return res.status(400).json({ 
      error: 'Validation failed',
      message: 'message_uuid is required for message_log data_type'
    });
  }

  // Parse timestamp if provided, otherwise use current time
  let messageTimestamp = new Date();
  if (timestamp) {
    messageTimestamp = new Date(timestamp);
    if (isNaN(messageTimestamp.getTime())) {
      return res.status(400).json({ 
        error: 'Invalid timestamp format',
        message: 'timestamp must be a valid ISO8601 date'
      });
    }
  }

  // Insert into message_log table
  const result = await pool.query(`
    INSERT INTO message_log (
      account_id,
      message_uuid,
      timestamp,
      from_number,
      to_number,
      message_body,
      image_url,
      message_type,
      reference_message_uuids,
      reference_task_uuids,
      booking_id,
      requestor_role,
      ai_enrichment_uuid,
      raw_data,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
    RETURNING id, created_at
  `, [
    account_id,
    message_uuid,
    messageTimestamp,
    from_number || null,
    to_number || null,
    message_body || null,
    image_url || null,
    message_type || 'Outbound',
    reference_message_uuids || null,
    reference_task_uuids || null,
    booking_id || null,
    requestor_role || null,
    ai_enrichment_uuid || null,
    raw_data || null
  ]);

  const insertedLog = result.rows[0];

  return res.status(201).json({
    success: true,
    message: 'Message log stored successfully',
    data_type: 'message_log',
    data: {
      id: insertedLog.id,
      created_at: insertedLog.created_at
    }
  });
}

// GET /api/webhook/status - Simple health check for webhook endpoints
router.get('/status', authenticateApiKey, (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Ramble Webhook API',
    timestamp: new Date().toISOString() 
  });
});

export default router;