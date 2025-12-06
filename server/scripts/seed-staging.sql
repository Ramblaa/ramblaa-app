-- ============================================================
-- STAGING DATABASE SEED SCRIPT
-- Run this on Railway PostgreSQL to set up test data
-- ============================================================

-- Clear existing test data (optional - uncomment if needed)
-- DELETE FROM messages;
-- DELETE FROM tasks;
-- DELETE FROM ai_logs;
-- DELETE FROM scheduled_messages;
-- DELETE FROM bookings;
-- DELETE FROM staff;
-- DELETE FROM faqs;
-- DELETE FROM task_definitions;
-- DELETE FROM properties;

-- ============================================================
-- 1. CREATE PROPERTY
-- ============================================================
INSERT INTO properties (id, name, address, host_name, host_phone, property_json, created_at)
VALUES (
  'kaum-villa-1',
  'Bali Oasis: 2BR Villa Private Pool',
  'Jl. Bidadari II, Seminyak, Bali',
  'Kaum Villas',
  'whatsapp:+31630211666',
  '{"Platform":"Airbnb","Wifi Network Name":"kaum_villa","Wifi Password":"balilestari","Property Title":"Bali Oasis: 2BR Villa Private Pool & Fast Wi-Fi"}',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  host_phone = EXCLUDED.host_phone,
  property_json = EXCLUDED.property_json;

-- ============================================================
-- 2. CREATE STAFF
-- ============================================================
INSERT INTO staff (id, property_id, name, phone, role, preferred_language, details_json, created_at)
VALUES (
  'staff-made-1',
  'kaum-villa-1',
  'Made Wiratni',
  'whatsapp:+31630211666',
  'Housekeeping',
  'id',
  '{"specialty":"Housekeeping","available":true}',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  phone = EXCLUDED.phone,
  preferred_language = EXCLUDED.preferred_language;

-- ============================================================
-- 3. CREATE FAQs
-- ============================================================
INSERT INTO faqs (id, property_id, sub_category, description, details_json, created_at)
VALUES 
  ('faq-wifi-1', 'kaum-villa-1', 'WiFi', 'Network: kaum_villa, Password: balilestari', '{"ssid":"kaum_villa","password":"balilestari"}', NOW()),
  ('faq-checkin-1', 'kaum-villa-1', 'Check-in Time', 'Standard check-in time is from 2:00 PM onwards. Early check-in may be available upon request.', '{"CheckIn":"14:00","primaryCategory":"Check-in & Check-out"}', NOW()),
  ('faq-checkout-1', 'kaum-villa-1', 'Check-out Time', 'Check-out time is by 11:00 AM. Late check-out may be available on request.', '{"CheckOut":"11:00","primaryCategory":"Check-in & Check-out"}', NOW()),
  ('faq-howcheckin-1', 'kaum-villa-1', 'How do I check in?', 'A secure lockbox is provided for contactless check-in. The code will be shared on Airbnb prior to your arrival.', '{"Method":"Lockbox","Instructions":"Lockbox located to the left of the front door. Code provided via Airbnb.","primaryCategory":"Check-in & Check-out"}', NOW()),
  ('faq-lockbox-1', 'kaum-villa-1', 'Where is the lockbox?', 'The lockbox is mounted on the wall just to the left of the front entrance.', '{"Location":"Left of front door","primaryCategory":"Check-in & Check-out"}', NOW()),
  ('faq-checkoutproc-1', 'kaum-villa-1', 'Check-out procedure', 'At check-out, lock all doors and return the key to the lockbox. Ensure the combination is scrambled.', '{"Instructions":"Lock the door and return the key to the lockbox. Randomize code.","primaryCategory":"Check-in & Check-out"}', NOW())
ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  details_json = EXCLUDED.details_json;

-- ============================================================
-- 4. CREATE TASK DEFINITIONS
-- ============================================================
INSERT INTO task_definitions (id, property_id, sub_category, staff_requirements, guest_requirements, host_escalation, staff_id, created_at)
VALUES
  ('taskdef-towels-1', 'kaum-villa-1', 'Fresh Towels', 'Confirm the time or window you can deliver the towels.', 'Best time or day to deliver the towels', 'No available towels; Guest has damaged the towels', 'staff-made-1', NOW()),
  ('taskdef-linen-1', 'kaum-villa-1', 'Fresh Linen', 'Confirm the time or window you can deliver the linen.', 'Best time or day to deliver the linen', 'No available linen; Guest has damaged the linen', 'staff-made-1', NOW()),
  ('taskdef-cleaning-1', 'kaum-villa-1', 'Cleaning', 'Confirm availability and time for cleaning.', 'Specific areas needing attention', 'Deep cleaning required; Special equipment needed', 'staff-made-1', NOW()),
  ('taskdef-pooltowels-1', 'kaum-villa-1', 'Pool Towels', 'Confirm delivery time for pool towels.', 'Number of towels needed', 'No pool towels available', 'staff-made-1', NOW()),
  ('taskdef-poolclean-1', 'kaum-villa-1', 'Pool Clean', 'Confirm when pool can be cleaned.', 'Issue with pool (if any)', 'Pool equipment malfunction', 'staff-made-1', NOW()),
  ('taskdef-maintenance-1', 'kaum-villa-1', 'Maintenance', 'Confirm issue details and ETA for fix.', 'Description of the issue', 'Major repairs; Safety issues; Cost approval needed', 'staff-made-1', NOW())
ON CONFLICT (id) DO UPDATE SET
  staff_requirements = EXCLUDED.staff_requirements,
  guest_requirements = EXCLUDED.guest_requirements,
  host_escalation = EXCLUDED.host_escalation;

-- ============================================================
-- 5. CREATE BOOKING (Active booking for test phone number)
-- ============================================================
INSERT INTO bookings (id, property_id, guest_name, guest_phone, guest_email, start_date, end_date, details_json, is_active, created_at)
VALUES (
  'booking-test-1',
  'kaum-villa-1',
  'Test Guest Danyon',
  '+31630211666',
  'test@ramblaa.com',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '7 days',
  '{"platform":"Airbnb","confirmationCode":"HMTEST123","guests":2}',
  1,
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  guest_phone = EXCLUDED.guest_phone,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  is_active = EXCLUDED.is_active;

-- ============================================================
-- 6. VERIFY DATA
-- ============================================================
SELECT 'Properties' as table_name, COUNT(*) as count FROM properties WHERE id = 'kaum-villa-1'
UNION ALL
SELECT 'Staff', COUNT(*) FROM staff WHERE property_id = 'kaum-villa-1'
UNION ALL
SELECT 'FAQs', COUNT(*) FROM faqs WHERE property_id = 'kaum-villa-1'
UNION ALL
SELECT 'Task Definitions', COUNT(*) FROM task_definitions WHERE property_id = 'kaum-villa-1'
UNION ALL
SELECT 'Bookings', COUNT(*) FROM bookings WHERE property_id = 'kaum-villa-1';

-- Show the phone numbers configured
SELECT 'Guest Phone' as type, guest_phone as phone FROM bookings WHERE id = 'booking-test-1'
UNION ALL
SELECT 'Host Phone', host_phone FROM properties WHERE id = 'kaum-villa-1'
UNION ALL
SELECT 'Staff Phone', phone FROM staff WHERE id = 'staff-made-1';

