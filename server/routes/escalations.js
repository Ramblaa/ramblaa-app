/**
 * Escalations Routes
 * API endpoints for escalation management
 */

import { Router } from 'express';
import { getDbWithPrepare as getDb } from '../db/index.js';
import {
  getEscalation,
  listEscalations,
  updateEscalationStatus,
} from '../services/escalationService.js';

const router = Router();

/**
 * GET /api/escalations
 * Get all escalations with optional filters
 */
router.get('/', async (req, res) => {
  try {
    const { status, propertyId, priority, limit = 50, offset = 0 } = req.query;
    const db = getDb();

    let sql = `
      SELECT e.*,
        p.name as property_name,
        b.guest_name as booking_guest_name
      FROM escalations e
      LEFT JOIN properties p ON e.property_id = p.id
      LEFT JOIN bookings b ON e.booking_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND e.status = ?';
      params.push(status);
    }

    if (propertyId) {
      sql += ' AND e.property_id = ?';
      params.push(propertyId);
    }

    if (priority) {
      sql += ' AND e.priority = ?';
      params.push(priority);
    }

    sql += ' ORDER BY e.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const escalations = await db.prepare(sql).all(...params);

    // Format response
    const formatted = escalations.map(e => formatEscalation(e));

    res.json(formatted);
  } catch (error) {
    console.error('[Escalations] List error:', error);
    res.status(500).json({ error: 'Failed to fetch escalations' });
  }
});

/**
 * GET /api/escalations/stats
 * Get escalation statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const db = getDb();

    const stats = await db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'open') as open,
        COUNT(*) FILTER (WHERE status = 'acknowledged') as acknowledged,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
        COUNT(*) FILTER (WHERE priority = 'critical') as critical,
        COUNT(*) FILTER (WHERE priority = 'high') as high,
        COUNT(*) FILTER (WHERE priority = 'medium') as medium,
        COUNT(*) FILTER (WHERE priority = 'low') as low
      FROM escalations
    `).get();

    res.json(stats);
  } catch (error) {
    console.error('[Escalations] Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch escalation stats' });
  }
});

/**
 * GET /api/escalations/:id
 * Get a single escalation by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const escalation = await db.prepare(`
      SELECT e.*,
        p.name as property_name,
        p.host_phone,
        p.host_name,
        b.guest_name as booking_guest_name,
        b.guest_email,
        t.task_bucket,
        t.task_request_title,
        t.status as task_status
      FROM escalations e
      LEFT JOIN properties p ON e.property_id = p.id
      LEFT JOIN bookings b ON e.booking_id = b.id
      LEFT JOIN tasks t ON e.task_id = t.id
      WHERE e.id = ?
    `).get(id);

    if (!escalation) {
      return res.status(404).json({ error: 'Escalation not found' });
    }

    res.json(formatEscalationDetail(escalation));
  } catch (error) {
    console.error('[Escalations] Get error:', error);
    res.status(500).json({ error: 'Failed to fetch escalation' });
  }
});

/**
 * PATCH /api/escalations/:id
 * Update an escalation (status, resolution notes)
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNotes } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['open', 'acknowledged', 'in_progress', 'resolved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updated = await updateEscalationStatus(id, status, resolutionNotes);

    if (!updated) {
      return res.status(404).json({ error: 'Escalation not found' });
    }

    res.json(formatEscalation(updated));
  } catch (error) {
    console.error('[Escalations] Update error:', error);
    res.status(500).json({ error: 'Failed to update escalation' });
  }
});

/**
 * POST /api/escalations/:id/acknowledge
 * Mark an escalation as acknowledged
 */
router.post('/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await updateEscalationStatus(id, 'acknowledged');

    if (!updated) {
      return res.status(404).json({ error: 'Escalation not found' });
    }

    res.json(formatEscalation(updated));
  } catch (error) {
    console.error('[Escalations] Acknowledge error:', error);
    res.status(500).json({ error: 'Failed to acknowledge escalation' });
  }
});

/**
 * POST /api/escalations/:id/resolve
 * Mark an escalation as resolved
 */
router.post('/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionNotes } = req.body;

    const updated = await updateEscalationStatus(id, 'resolved', resolutionNotes);

    if (!updated) {
      return res.status(404).json({ error: 'Escalation not found' });
    }

    res.json(formatEscalation(updated));
  } catch (error) {
    console.error('[Escalations] Resolve error:', error);
    res.status(500).json({ error: 'Failed to resolve escalation' });
  }
});

/**
 * Format escalation for list response
 */
function formatEscalation(e) {
  return {
    id: e.id,
    triggerType: e.trigger_type,
    riskIndicator: e.risk_indicator,
    reason: e.reason,
    originalMessage: e.original_message,
    status: e.status,
    priority: e.priority,
    // Guest info
    guestPhone: e.guest_phone,
    guestName: e.guest_name || e.booking_guest_name,
    // Property info
    propertyId: e.property_id,
    propertyName: e.property_name,
    // Linked entities
    messageId: e.message_id,
    taskId: e.task_id,
    bookingId: e.booking_id,
    // Host handling
    hostNotified: e.host_notified === 1,
    hostNotifiedAt: e.host_notified_at,
    acknowledgedAt: e.acknowledged_at,
    resolvedAt: e.resolved_at,
    resolutionNotes: e.resolution_notes,
    // Timestamps
    createdAt: e.created_at,
    updatedAt: e.updated_at,
  };
}

/**
 * Format escalation for detail response (includes related data)
 */
function formatEscalationDetail(e) {
  return {
    ...formatEscalation(e),
    // Additional property info
    hostPhone: e.host_phone,
    hostName: e.host_name,
    // Guest info from booking
    guestEmail: e.guest_email,
    // Task info (if task-triggered)
    taskBucket: e.task_bucket,
    taskRequestTitle: e.task_request_title,
    taskStatus: e.task_status,
  };
}

export default router;
