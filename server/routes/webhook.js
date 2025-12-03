/**
 * Webhook Routes - Ported from twilioApiWebhook.gs
 * Handles inbound Twilio WhatsApp messages
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDbWithPrepare as getDb } from '../db/index.js';
import { canonPhoneTokens, normalizeWhatsAppPhone } from '../utils/phoneUtils.js';
import { processInboundMessage } from '../services/messageProcessor.js';
import { sendToWebhook, fetchTwilioMedia } from '../services/twilio.js';

const router = Router();

/**
 * POST /api/webhook/twilio
 * Receive inbound WhatsApp messages from Twilio
 */
router.post('/twilio', async (req, res) => {
  try {
    const params = req.body;
    console.log('[Webhook] Received:', JSON.stringify(params));

    const from = normalizeWhatsAppPhone(params.From);
    const to = normalizeWhatsAppPhone(params.To);
    const body = String(params.Body || '');
    const messageSid = params.MessageSid || params.SmsMessageSid || '';
    const numMedia = parseInt(params.NumMedia || '0', 10) || 0;

    const id = messageSid || uuidv4();
    const db = getDb();

    // Handle media attachments
    const mediaUrls = [];
    if (numMedia > 0) {
      for (let i = 0; i < numMedia; i++) {
        const mediaUrl = params[`MediaUrl${i}`];
        if (mediaUrl) {
          mediaUrls.push(mediaUrl);
          // Note: In production, you'd want to download and store media
          // const media = await fetchTwilioMedia(mediaUrl);
        }
      }
    }

    // Determine requestor role
    let bookingId = '';
    let propertyId = '';
    let requestorRole = '';
    let staffId = '';

    // Check for prefix (Staff: or Host:)
    const prefixMatch = body.match(/^\s*(Staff|Host)\s*:/i);
    if (prefixMatch) {
      requestorRole = prefixMatch[1].toLowerCase() === 'staff' ? 'Staff' : 'Host';
    } else {
      // Try to find booking by phone (Guest)
      const booking = lookupBookingByPhone(db, from);
      if (booking) {
        bookingId = booking.id;
        propertyId = booking.property_id;
        requestorRole = 'Guest';
      }

      // Try to find staff record
      if (!requestorRole) {
        const staff = lookupStaffByPhone(db, from, 'Staff');
        if (staff) {
          requestorRole = 'Staff';
          propertyId = propertyId || staff.property_id;
          staffId = staff.id;
        }
      }

      // Try to find host record
      if (!requestorRole) {
        const host = lookupStaffByPhone(db, from, 'Host');
        if (host) {
          requestorRole = 'Host';
          propertyId = propertyId || host.property_id;
        }
      }

      // Default to Guest
      if (!requestorRole) {
        requestorRole = 'Guest';
      }
    }

    // Insert message into database
    const stmt = db.prepare(`
      INSERT INTO messages (
        id, from_number, to_number, body, media_url, message_type,
        requestor_role, booking_id, property_id, staff_id, created_at
      ) VALUES (?, ?, ?, ?, ?, 'Inbound', ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run(
      id,
      from,
      to,
      body,
      mediaUrls.join(', ') || null,
      requestorRole,
      bookingId || null,
      propertyId || null,
      staffId || null
    );

    console.log(`[Webhook] Logged message: ${id}, role=${requestorRole}, booking=${bookingId}`);

    // Send to external webhook (if configured)
    try {
      await sendToWebhook({
        messageSid: id,
        from,
        to,
        body,
        type: 'Inbound',
        bookingId,
        propertyId,
        requestorRole,
        staffId,
        mediaUrls,
      });
    } catch (e) {
      console.error('[Webhook] External webhook error:', e.message);
    }

    // Process the message through AI pipeline (for Guest messages)
    if (requestorRole === 'Guest' && body.trim()) {
      const message = {
        id,
        from_number: from,
        to_number: to,
        body,
        booking_id: bookingId,
        property_id: propertyId,
        requestor_role: requestorRole,
      };

      // Process asynchronously
      processInboundMessage(message).catch(err => {
        console.error('[Webhook] AI processing error:', err.message);
      });
    }

    // Return TwiML empty response
    res.type('text/xml');
    res.send('<Response></Response>');
  } catch (error) {
    console.error('[Webhook] Error:', error);
    res.status(500).send('<Response></Response>');
  }
});

/**
 * GET /api/webhook/health
 * Health check for webhook endpoint
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', endpoint: 'webhook' });
});

/**
 * Lookup booking by guest phone
 */
function lookupBookingByPhone(db, phone) {
  const tokens = canonPhoneTokens(phone);
  if (!tokens.digits) return null;

  const pattern = `%${tokens.last10}%`;
  const today = new Date().toISOString().split('T')[0];

  // Active booking
  let booking = db.prepare(`
    SELECT * FROM bookings 
    WHERE guest_phone LIKE ? AND start_date <= ? AND end_date >= ?
    ORDER BY start_date DESC LIMIT 1
  `).get([pattern, today, today]);

  if (booking) return booking;

  // Upcoming booking
  booking = db.prepare(`
    SELECT * FROM bookings 
    WHERE guest_phone LIKE ? AND start_date >= ?
    ORDER BY start_date ASC LIMIT 1
  `).get([pattern, today]);

  if (booking) return booking;

  // Most recent past booking
  booking = db.prepare(`
    SELECT * FROM bookings 
    WHERE guest_phone LIKE ?
    ORDER BY end_date DESC LIMIT 1
  `).get([pattern]);

  return booking;
}

/**
 * Lookup staff/host by phone and role
 */
function lookupStaffByPhone(db, phone, role) {
  const tokens = canonPhoneTokens(phone);
  if (!tokens.digits) return null;

  const pattern = `%${tokens.last10}%`;

  return db.prepare(`
    SELECT * FROM staff 
    WHERE phone LIKE ? AND LOWER(role) = LOWER(?)
    LIMIT 1
  `).get([pattern, role]);
}

export default router;

