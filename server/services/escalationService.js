/**
 * Escalation Service
 * Handles creation and management of escalations to hosts
 *
 * Triggers:
 * 1. Immediate - When AI detects risk indicators (LegalThreat, SafetyRisk, ChurnRisk, etc.)
 * 2. Delayed - When task triage determines host intervention is needed
 */

import { v4 as uuidv4 } from 'uuid';
import { getDbWithPrepare as getDb } from '../db/index.js';
import { sendWhatsAppMessage } from './twilio.js';

// Risk indicators that map to critical priority
const CRITICAL_RISKS = ['LegalThreat', 'SafetyRisk'];
// Risk indicators that map to high priority
const HIGH_RISKS = ['ChurnRisk', 'PublicComplaint', 'HighImpact'];

/**
 * Determine priority based on risk indicator and trigger type
 */
function determinePriority(riskIndicator, triggerType) {
  if (CRITICAL_RISKS.includes(riskIndicator)) return 'critical';
  if (HIGH_RISKS.includes(riskIndicator)) return 'high';
  // Task triage escalations default to medium unless they have a risk indicator
  if (triggerType === 'task_triage') return 'medium';
  return 'high';
}

/**
 * Create a new escalation
 *
 * @param {Object} options
 * @param {string} options.triggerType - 'message_risk' | 'task_triage'
 * @param {string} options.riskIndicator - ChurnRisk, LegalThreat, SafetyRisk, etc.
 * @param {string} options.messageId - Original message ID (for message-triggered escalations)
 * @param {string} options.taskId - Task ID (for task-triggered escalations)
 * @param {string} options.bookingId - Booking ID
 * @param {string} options.propertyId - Property ID
 * @param {string} options.guestPhone - Guest phone number
 * @param {string} options.guestName - Guest name
 * @param {string} options.originalMessage - The message that caused escalation
 * @param {string} options.reason - Human-readable reason for escalation
 * @returns {Object} - Created escalation record
 */
export async function createEscalation({
  triggerType,
  riskIndicator = null,
  messageId = null,
  taskId = null,
  bookingId = null,
  propertyId = null,
  guestPhone = null,
  guestName = null,
  originalMessage = null,
  reason = null,
}) {
  const db = getDb();
  const id = uuidv4();
  const priority = determinePriority(riskIndicator, triggerType);

  console.log(`[EscalationService] Creating escalation ${id}`);
  console.log(`[EscalationService]   trigger: ${triggerType}, risk: ${riskIndicator}, priority: ${priority}`);

  // Look up guest name from booking if not provided
  if (!guestName && bookingId) {
    const booking = await db.prepare('SELECT guest_name FROM bookings WHERE id = ?').get(bookingId);
    guestName = booking?.guest_name || null;
  }

  // Insert escalation
  await db.prepare(`
    INSERT INTO escalations (
      id, trigger_type, risk_indicator, message_id, task_id,
      booking_id, property_id, guest_phone, guest_name,
      original_message, reason, priority, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', CURRENT_TIMESTAMP)
  `).run(
    id,
    triggerType,
    riskIndicator,
    messageId,
    taskId,
    bookingId,
    propertyId,
    guestPhone,
    guestName,
    originalMessage,
    reason,
    priority
  );

  console.log(`[EscalationService] Escalation ${id} created successfully`);

  // Get the created escalation
  const escalation = await db.prepare('SELECT * FROM escalations WHERE id = ?').get(id);

  // Notify host
  await notifyHost(escalation);

  return escalation;
}

/**
 * Notify the host about an escalation via WhatsApp
 */
async function notifyHost(escalation) {
  const db = getDb();

  // Get host phone from property
  let hostPhone = null;
  if (escalation.property_id) {
    const property = await db.prepare('SELECT host_phone, name FROM properties WHERE id = ?').get(escalation.property_id);
    hostPhone = property?.host_phone;
  }

  if (!hostPhone) {
    console.log(`[EscalationService] No host phone found for escalation ${escalation.id}`);
    return;
  }

  // Build notification message
  const priorityEmoji = {
    critical: '🚨',
    high: '⚠️',
    medium: '📋',
    low: '📝',
  };

  const emoji = priorityEmoji[escalation.priority] || '📋';
  const priorityLabel = escalation.priority.toUpperCase();

  let message = `${emoji} ESCALATION (${priorityLabel})\n\n`;

  if (escalation.risk_indicator) {
    message += `Risk: ${escalation.risk_indicator}\n`;
  }

  if (escalation.guest_name) {
    message += `Guest: ${escalation.guest_name}\n`;
  }

  if (escalation.reason) {
    message += `Reason: ${escalation.reason}\n`;
  }

  message += `\nOriginal message:\n"${escalation.original_message || 'N/A'}"`;

  message += `\n\nPlease review and respond to this escalation.`;

  console.log(`[EscalationService] Notifying host at ${hostPhone} for escalation ${escalation.id}`);

  // Send WhatsApp message
  const result = await sendWhatsAppMessage({
    to: hostPhone,
    body: message,
    recipientType: 'Host',
    metadata: {
      propertyId: escalation.property_id,
      escalationId: escalation.id,
    },
  });

  // Update escalation with notification status
  if (result.success) {
    await db.prepare(`
      UPDATE escalations
      SET host_notified = 1, host_notified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(escalation.id);
    console.log(`[EscalationService] Host notified successfully for escalation ${escalation.id}`);
  } else {
    console.error(`[EscalationService] Failed to notify host for escalation ${escalation.id}:`, result.error);
  }
}

/**
 * Get escalation by ID
 */
export async function getEscalation(id) {
  const db = getDb();
  return await db.prepare('SELECT * FROM escalations WHERE id = ?').get(id);
}

/**
 * List escalations with filters
 */
export async function listEscalations({ status, propertyId, priority, limit = 50, offset = 0 } = {}) {
  const db = getDb();

  let query = 'SELECT * FROM escalations WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  if (propertyId) {
    query += ' AND property_id = ?';
    params.push(propertyId);
  }

  if (priority) {
    query += ' AND priority = ?';
    params.push(priority);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return await db.prepare(query).all(...params);
}

/**
 * Update escalation status
 */
export async function updateEscalationStatus(id, status, resolutionNotes = null) {
  const db = getDb();

  const updates = {
    status,
    updated_at: 'CURRENT_TIMESTAMP',
  };

  if (status === 'acknowledged') {
    await db.prepare(`
      UPDATE escalations
      SET status = ?, acknowledged_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, id);
  } else if (status === 'resolved') {
    await db.prepare(`
      UPDATE escalations
      SET status = ?, resolved_at = CURRENT_TIMESTAMP, resolution_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, resolutionNotes, id);
  } else {
    await db.prepare(`
      UPDATE escalations
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, id);
  }

  console.log(`[EscalationService] Escalation ${id} status updated to ${status}`);

  return await getEscalation(id);
}

/**
 * Check if a message should trigger an escalation based on risk indicators
 */
export function shouldEscalate(riskIndicator) {
  if (!riskIndicator || riskIndicator === 'None') {
    return false;
  }
  // Any non-None risk indicator should trigger escalation
  return true;
}

export default {
  createEscalation,
  getEscalation,
  listEscalations,
  updateEscalationStatus,
  shouldEscalate,
};
