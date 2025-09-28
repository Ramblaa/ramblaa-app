import express from 'express';
import { validationResult, body, query } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { setAccountContext } from '../middleware/setAccountContext.js';

const router = express.Router();

// Apply authentication and account context to all routes
router.use(authenticateToken);
router.use(setAccountContext);

// Validation rules (updated for staff)
const contactValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('service_type').trim().notEmpty().withMessage('Service type is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required')
    .matches(/^\+?[\d\s\(\)\-\.]+$/).withMessage('Invalid phone number format'),
  body('preferred_language').optional().isLength({ min: 2, max: 10 }).withMessage('Invalid language code'),
  body('notes').optional().trim(),
  body('serviceLocations').optional().isArray().withMessage('Service locations must be an array'),
  body('serviceLocations.*').optional().isInt({ min: 1 }).withMessage('Invalid property ID')
];

// GET /api/contacts - List all staff (transformed as contacts)
router.get('/', [
  query('service_type').optional().trim(),
  query('property_id').optional().isInt({ min: 1 }),
  query('language').optional().isLength({ min: 2, max: 10 }),
  query('search').optional().trim(),
  query('active').optional().isBoolean(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  const client = await pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Set RLS context on the same connection that will run the query
    if (req.user && req.user.accountId) {
      await client.query(`SET app.current_account_id = '${req.user.accountId}'`);
      await client.query(`SET app.current_user_id = '${req.user.userId}'`);
    }

    const {
      service_type,
      property_id,
      language,
      search,
      active = 'true',
      page = 1,
      limit = 20
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    let whereConditions = ['s.account_id = $1'];
    let queryParams = [req.user.accountId];
    let paramCount = 1;

    // Build dynamic WHERE clause
    if (service_type) {
      paramCount++;
      whereConditions.push(`TRIM(s.role) ILIKE $${paramCount}`);
      queryParams.push(`%${service_type}%`);
    }

    if (language) {
      paramCount++;
      whereConditions.push(`s.preferred_language = $${paramCount}`);
      queryParams.push(language);
    }

    if (search) {
      paramCount++;
      whereConditions.push(`(s.staff_name ILIKE $${paramCount} OR s.phone ILIKE $${paramCount})`);
      queryParams.push(`%${search}%`);
    }

    if (property_id) {
      paramCount++;
      whereConditions.push(`s.property_id = $${paramCount}`);
      queryParams.push(parseInt(property_id));
    }

    const whereClause = whereConditions.join(' AND ');
    
    // Main query transforming staff to contacts format
    const query = `
      SELECT 
        s.id,
        s.staff_name as name,
        TRIM(BOTH FROM REPLACE(s.role, chr(13), '')) as service_type,
        s.phone,
        COALESCE(s.preferred_language, 'en') as preferred_language,
        '' as notes,
        true as is_active,
        s.created_at,
        s.updated_at,
        CASE 
          WHEN s.property_id IS NOT NULL THEN 
            json_build_array(
              json_build_object(
                'id', p.id,
                'name', p.property_title,
                'address', p.property_location
              )
            )
          ELSE '[]'::json
        END as service_locations
      FROM staff s
      LEFT JOIN properties p ON s.property_id = p.id
      WHERE ${whereClause}
      ORDER BY s.staff_name
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    queryParams.push(parseInt(limit), offset);

    const result = await client.query(query, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(s.id) as total
      FROM staff s
      WHERE ${whereClause}
    `;
    
    const countResult = await client.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    res.json({
      contacts: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/contacts/:id - Get single staff member (as contact)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        s.id,
        s.staff_name as name,
        TRIM(BOTH FROM REPLACE(s.role, chr(13), '')) as service_type,
        s.phone,
        COALESCE(s.preferred_language, 'en') as preferred_language,
        '' as notes,
        true as is_active,
        s.created_at,
        s.updated_at,
        CASE 
          WHEN s.property_id IS NOT NULL THEN 
            json_build_array(
              json_build_object(
                'id', p.id,
                'name', p.property_title,
                'address', p.property_location
              )
            )
          ELSE '[]'::json
        END as service_locations
      FROM staff s
      LEFT JOIN properties p ON s.property_id = p.id
      WHERE s.id = $1 
        AND s.account_id = COALESCE(
          NULLIF(current_setting('app.current_account_id', true), '')::INTEGER,
          (SELECT account_id FROM users WHERE id = COALESCE(
            NULLIF(current_setting('app.current_user_id', true), '')::INTEGER,
            0
          ))
        )
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error fetching staff member:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/contacts - Create new staff member
router.post('/', contactValidation, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      service_type,
      phone,
      preferred_language = 'en',
      notes,
      serviceLocations = []
    } = req.body;

    await client.query('BEGIN');

    // Set RLS context
    await client.query(`SET app.current_account_id = '${req.user.accountId}'`);
    await client.query(`SET app.current_user_id = '${req.user.userId}'`);

    // Get the property_id (use first service location, null if none)
    const propertyId = serviceLocations.length > 0 ? serviceLocations[0] : null;

    // Verify property ID exists if provided
    if (propertyId) {
      const propertyCheck = await client.query(
        'SELECT id FROM properties WHERE id = $1',
        [propertyId]
      );

      if (propertyCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid property ID' });
      }
    }

    // Insert staff member
    const staffQuery = `
      INSERT INTO staff (staff_name, role, phone, preferred_language, property_id, account_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const staffResult = await client.query(staffQuery, [
      name, service_type, phone, preferred_language || null, propertyId, req.user.accountId
    ]);

    const staff = staffResult.rows[0];

    await client.query('COMMIT');

    // Return staff data in contacts format
    const response = {
      id: staff.id,
      name: staff.staff_name,
      service_type: staff.role ? staff.role.trim() : '',
      phone: staff.phone,
      preferred_language: staff.preferred_language || 'en',
      notes: '',
      is_active: true,
      created_at: staff.created_at,
      updated_at: staff.updated_at,
      service_locations: []
    };

    // Add property info if exists
    if (propertyId) {
      const propertyResult = await client.query(
        'SELECT id, property_title as name, property_location as address FROM properties WHERE id = $1',
        [propertyId]
      );
      if (propertyResult.rows.length > 0) {
        response.service_locations = [propertyResult.rows[0]];
      }
    }

    res.status(201).json(response);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating staff member:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// PUT /api/contacts/:id - Update staff member
router.put('/:id', contactValidation, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const {
      name,
      service_type,
      phone,
      preferred_language,
      notes,
      serviceLocations = []
    } = req.body;

    await client.query('BEGIN');

    // Set RLS context
    await client.query(`SET app.current_account_id = '${req.user.accountId}'`);
    await client.query(`SET app.current_user_id = '${req.user.userId}'`);

    // Check if staff member exists
    const staffCheck = await client.query(
      'SELECT id FROM staff WHERE id = $1 AND account_id = $2', 
      [id, req.user.accountId]
    );
    if (staffCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Get the property_id (use first service location, null if none)
    const propertyId = serviceLocations.length > 0 ? serviceLocations[0] : null;

    // Verify property ID exists if provided
    if (propertyId) {
      const propertyCheck = await client.query(
        'SELECT id FROM properties WHERE id = $1',
        [propertyId]
      );

      if (propertyCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid property ID' });
      }
    }

    // Update staff member
    const updateQuery = `
      UPDATE staff 
      SET staff_name = $1, role = $2, phone = $3, 
          preferred_language = $4, property_id = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND account_id = $7
      RETURNING *
    `;

    const staffResult = await client.query(updateQuery, [
      name, service_type, phone, preferred_language || null, propertyId, id, req.user.accountId
    ]);

    const staff = staffResult.rows[0];

    await client.query('COMMIT');

    // Return staff data in contacts format
    const response = {
      id: staff.id,
      name: staff.staff_name,
      service_type: staff.role ? staff.role.trim() : '',
      phone: staff.phone,
      preferred_language: staff.preferred_language || 'en',
      notes: '',
      is_active: true,
      created_at: staff.created_at,
      updated_at: staff.updated_at,
      service_locations: []
    };

    // Add property info if exists
    if (propertyId) {
      const propertyResult = await client.query(
        'SELECT id, property_title as name, property_location as address FROM properties WHERE id = $1',
        [propertyId]
      );
      if (propertyResult.rows.length > 0) {
        response.service_locations = [propertyResult.rows[0]];
      }
    }

    res.json(response);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating staff member:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// DELETE /api/contacts/:id - Delete staff member
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;

    await client.query('BEGIN');
    
    // Set RLS context
    await client.query(`SET app.current_account_id = '${req.user.accountId}'`);
    await client.query(`SET app.current_user_id = '${req.user.userId}'`);

    const result = await client.query(
      'DELETE FROM staff WHERE id = $1 AND account_id = $2 RETURNING id',
      [id, req.user.accountId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Staff member not found' });
    }

    await client.query('COMMIT');
    res.json({ message: 'Staff member deleted successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting staff member:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/contacts/by-property/:propertyId - Get staff by property
router.get('/by-property/:propertyId', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { propertyId } = req.params;

    // Set RLS context
    await client.query(`SET app.current_account_id = '${req.user.accountId}'`);
    await client.query(`SET app.current_user_id = '${req.user.userId}'`);

    const query = `
      SELECT 
        s.id,
        s.staff_name as name,
        TRIM(BOTH FROM REPLACE(s.role, chr(13), '')) as service_type,
        s.phone,
        COALESCE(s.preferred_language, 'en') as preferred_language,
        '' as notes,
        true as is_active,
        s.created_at,
        s.updated_at,
        json_build_array(
          json_build_object(
            'id', p.id,
            'name', p.property_title,
            'address', p.property_location
          )
        ) as service_locations
      FROM staff s
      INNER JOIN properties p ON s.property_id = p.id
      WHERE s.property_id = $1 
        AND s.account_id = COALESCE(
          NULLIF(current_setting('app.current_account_id', true), '')::INTEGER,
          (SELECT account_id FROM users WHERE id = COALESCE(
            NULLIF(current_setting('app.current_user_id', true), '')::INTEGER,
            0
          ))
        )
      ORDER BY s.staff_name
    `;

    const result = await client.query(query, [propertyId]);
    res.json(result.rows);

  } catch (error) {
    console.error('Error fetching staff by property:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

export default router; 