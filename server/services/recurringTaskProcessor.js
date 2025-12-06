import { v4 as uuidv4 } from 'uuid';
import { getDbWithPrepare as getDb } from '../db/index.js';

function toDateTime(dateStr, timeStr = '09:00') {
  const [hour = '09', minute = '00'] = timeStr.split(':');
  const date = new Date(dateStr);
  date.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);
  return date;
}

function addInterval(date, repeatType, intervalDays = 1) {
  const next = new Date(date);
  switch (repeatType) {
    case 'DAILY':
      next.setDate(next.getDate() + 1);
      break;
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'INTERVAL':
      next.setDate(next.getDate() + (intervalDays || 1));
      break;
    default:
      next.setDate(next.getDate() + 1);
  }
  return next;
}

export function computeNextRunAt(startDate, timeOfDay, repeatType, intervalDays, fromDate) {
  const base = fromDate ? new Date(fromDate) : new Date();
  let next = toDateTime(startDate, timeOfDay || '09:00');
  if (next <= base) {
    // advance until in future
    while (next <= base) {
      next = addInterval(next, repeatType, intervalDays);
    }
  }
  return next;
}

export async function createTaskFromRecurringTemplate(template) {
  const db = getDb();
  const id = uuidv4();
  await db.prepare(`
    INSERT INTO tasks (
      id, property_id, booking_id, phone, task_request_title,
      guest_message, task_bucket, staff_id, staff_name, staff_phone,
      recurring_task_id, action_holder, status, created_at, due_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Staff', 'Waiting on Staff', CURRENT_TIMESTAMP, ?)
  `).run(
    id,
    template.property_id,
    template.booking_id || null,
    template.phone || null,
    template.title,
    template.description || '',
    template.task_bucket || 'Other',
    template.staff_id || null,
    template.staff_name || null,
    template.staff_phone || null,
    template.id,
    template.next_run_at || null
  );
  return id;
}

export async function processRecurringTasks() {
  const db = getDb();
  const now = new Date();
  const templates = await db.prepare(`
    SELECT * FROM recurring_tasks
    WHERE is_active = 1
      AND next_run_at IS NOT NULL
      AND next_run_at <= ?
  `).all(now.toISOString());

  let createdCount = 0;

  for (const tpl of templates) {
    // End conditions
    if (tpl.end_date && new Date(tpl.next_run_at) > new Date(tpl.end_date)) {
      continue;
    }
    if (tpl.max_occurrences && tpl.occurrences_created >= tpl.max_occurrences) {
      continue;
    }

    // Create task
    await createTaskFromRecurringTemplate(tpl);
    createdCount += 1;

    // Increment and schedule next
    const nextRun = addInterval(
      new Date(tpl.next_run_at),
      tpl.repeat_type,
      tpl.interval_days || 1
    );

    await db.prepare(`
      UPDATE recurring_tasks
      SET occurrences_created = occurrences_created + 1,
          last_run_at = ?,
          next_run_at = ?
      WHERE id = ?
    `).run(
      new Date().toISOString(),
      nextRun.toISOString(),
      tpl.id
    );
  }

  return { processed: templates.length, created: createdCount };
}

