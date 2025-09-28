import express from 'express';
import { validationResult, body, query } from 'express-validator';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { setAccountContext } from '../middleware/setAccountContext.js';

const router = express.Router();

// Apply authentication and account context to all routes
router.use(authenticateToken);
router.use(setAccountContext);

// Validation rules
const faqValidation = [
  body('question').trim().notEmpty().withMessage('Question is required'),
  body('answer').optional().trim(),
  body('answer_type').optional().isIn(['llm', 'host', 'unanswered']).withMessage('Answer type must be llm, host, or unanswered'),
  body('confidence').optional().isFloat({ min: 0, max: 1 }).withMessage('Confidence must be between 0 and 1'),
  body('category_id').optional().isInt({ min: 1 }).withMessage('Category ID must be a positive integer'),
  body('property_id').optional().isInt({ min: 1 }).withMessage('Property ID must be a positive integer'),
  body('tags').optional().isArray().withMessage('Tags must be an array')
];

const categoryValidation = [
  body('name').trim().notEmpty().withMessage('Category name is required'),
  body('description').optional().trim(),
  body('color').optional().matches(/^#[0-9A-F]{6}$/i).withMessage('Color must be a valid hex color')
];

// GET /api/faqs - List all FAQs with filtering and search
router.get('/', [
  query('answer_type').optional().isIn(['llm', 'host', 'unanswered']),
  query('category_id').optional().isInt({ min: 1 }),
  query('property_id').optional().isInt({ min: 1 }),
  query('search').optional().trim(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sort').optional().isIn(['ask_count', 'last_asked', 'created_at', 'question']),
  query('order').optional().isIn(['asc', 'desc'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      answer_type,
      category_id,
      property_id,
      search,
      page = 1,
      limit = 50,
      sort = 'last_asked',
      order = 'desc'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    let whereConditions = ['f.is_active = true'];
    let queryParams = [];
    let paramCount = 0;

    // Add filters
    if (answer_type) {
      paramCount++;
      whereConditions.push(`f.answer_type = $${paramCount}`);
      queryParams.push(answer_type);
    }

    if (category_id) {
      paramCount++;
      whereConditions.push(`f.category_id = $${paramCount}`);
      queryParams.push(parseInt(category_id));
    }

    if (property_id) {
      paramCount++;
      whereConditions.push(`f.property_id = $${paramCount}`);
      queryParams.push(parseInt(property_id));
    }

    // Full-text search
    if (search) {
      paramCount++;
      whereConditions.push(`(
        to_tsvector('english', f.question || ' ' || COALESCE(f.answer, '')) @@ plainto_tsquery('english', $${paramCount})
        OR f.question ILIKE $${paramCount + 1}
        OR f.answer ILIKE $${paramCount + 1}
      )`);
      queryParams.push(search, `%${search}%`);
      paramCount++; // Account for the second parameter
    }

    const whereClause = whereConditions.join(' AND ');

    // Simplified query for existing table structure
    const query = `
      SELECT 
        f.*,
        NULL as category_name,
        NULL as category_color,
        NULL as property_name,
        '[]'::json as tags
      FROM faqs f
      WHERE ${whereClause}
      ORDER BY f.${sort} ${order.toUpperCase()}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    queryParams.push(parseInt(limit), offset);

    const result = await pool.query(query, queryParams);

    // Get total count - simplified
    const countQuery = `
      SELECT COUNT(*) as total
      FROM faqs f
      WHERE ${whereClause}
    `;
    
    const countResult = await pool.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    res.json({
      faqs: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching FAQs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/faqs/:id - Get single FAQ with full details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        f.*,
        fc.name as category_name,
        fc.color as category_color,
        p.property_title as property_name,
        u1.email as created_by_email,
        u2.email as updated_by_email,
        ARRAY_AGG(
          CASE WHEN ft.name IS NOT NULL 
          THEN json_build_object('id', ft.id, 'name', ft.name)
          ELSE NULL END
        ) FILTER (WHERE ft.name IS NOT NULL) as tags
      FROM faqs f
      LEFT JOIN faq_categories fc ON f.category_id = fc.id
      LEFT JOIN properties p ON f.property_id = p.id
      LEFT JOIN users u1 ON f.created_by = u1.id
      LEFT JOIN users u2 ON f.updated_by = u2.id
      LEFT JOIN faq_tag_relationships ftr ON f.id = ftr.faq_id
      LEFT JOIN faq_tags ft ON ftr.tag_id = ft.id
      WHERE f.id = $1 AND f.is_active = true
      GROUP BY f.id, fc.name, fc.color, p.property_title, u1.email, u2.email
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'FAQ not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error fetching FAQ:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/faqs - Create new FAQ (simplified for existing table)
router.post('/', faqValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      question, 
      answer,
      answer_type = 'unanswered'
    } = req.body;

    // Simplified insert for existing table structure
    const faqQuery = `
      INSERT INTO faqs (question, answer, answer_type, account_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *, NULL as category_name, NULL as category_color, NULL as property_name, '[]'::json as tags
    `;

    // Get account_id - assume first account for now
    const accountResult = await pool.query('SELECT id FROM accounts ORDER BY id LIMIT 1');
    const accountId = accountResult.rows[0]?.id || 1;

    const result = await pool.query(faqQuery, [
      question, 
      answer || null, 
      answer_type,
      accountId
    ]);

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('Error creating FAQ:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/faqs/:id - Update FAQ
router.put('/:id', faqValidation, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await client.query('BEGIN');

    const { id } = req.params;
    const { 
      question, 
      answer,
      answer_type,
      confidence,
      category_id,
      property_id,
      tags = []
    } = req.body;

    // Check if FAQ exists
    const faqCheck = await client.query(
      'SELECT id FROM faqs WHERE id = $1 AND is_active = true', 
      [id]
    );
    if (faqCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'FAQ not found' });
    }

    // Validate category_id exists if provided
    if (category_id) {
      const categoryCheck = await client.query(
        'SELECT id FROM faq_categories WHERE id = $1', 
        [category_id]
      );
      if (categoryCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Category not found' });
      }
    }

    // Validate property_id exists if provided
    if (property_id) {
      const propertyCheck = await client.query(
        'SELECT id FROM properties WHERE id = $1 AND is_active = true', 
        [property_id]
      );
      if (propertyCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Property not found' });
      }
    }

    // Update FAQ
    const updateQuery = `
      UPDATE faqs 
      SET question = $1, answer = $2, answer_type = $3, confidence = $4,
          category_id = $5, property_id = $6, updated_by = $7,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `;

    await client.query(updateQuery, [
      question, answer, answer_type, confidence, category_id, property_id,
      req.user.userId, id
    ]);

    // Update tags - first remove all existing tags for this FAQ
    await client.query('DELETE FROM faq_tag_relationships WHERE faq_id = $1', [id]);

    // Add new tags
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        // Create or get tag
        const tagResult = await client.query(`
          INSERT INTO faq_tags (name, account_id) 
          VALUES ($1, $2) 
          ON CONFLICT (name, account_id) DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        `, [tagName.trim(), req.user.accountId]);

        const tagId = tagResult.rows[0].id;

        // Link tag to FAQ
        await client.query(
          'INSERT INTO faq_tag_relationships (faq_id, tag_id) VALUES ($1, $2)',
          [id, tagId]
        );
      }
    }

    await client.query('COMMIT');

    // Fetch the updated FAQ with all related data
    const completeQuery = `
      SELECT 
        f.*,
        fc.name as category_name,
        fc.color as category_color,
        p.property_title as property_name,
        ARRAY_AGG(
          CASE WHEN ft.name IS NOT NULL 
          THEN json_build_object('id', ft.id, 'name', ft.name)
          ELSE NULL END
        ) FILTER (WHERE ft.name IS NOT NULL) as tags
      FROM faqs f
      LEFT JOIN faq_categories fc ON f.category_id = fc.id
      LEFT JOIN properties p ON f.property_id = p.id
      LEFT JOIN faq_tag_relationships ftr ON f.id = ftr.faq_id
      LEFT JOIN faq_tags ft ON ftr.tag_id = ft.id
      WHERE f.id = $1
      GROUP BY f.id, fc.name, fc.color, p.property_title
    `;

    const completeResult = await client.query(completeQuery, [id]);

    res.json(completeResult.rows[0]);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating FAQ:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// DELETE /api/faqs/:id - Delete FAQ (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if FAQ exists
    const faqCheck = await pool.query(
      'SELECT id FROM faqs WHERE id = $1 AND is_active = true', 
      [id]
    );
    if (faqCheck.rows.length === 0) {
      return res.status(404).json({ error: 'FAQ not found' });
    }

    // Soft delete the FAQ
    await pool.query(
      'UPDATE faqs SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    res.json({ message: 'FAQ deleted successfully' });

  } catch (error) {
    console.error('Error deleting FAQ:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/faqs/:id/ask - Record an FAQ ask event for analytics
router.post('/:id/ask', async (req, res) => {
  try {
    const { id } = req.params;
    const { source = 'web', user_agent, ip_address } = req.body;

    // Check if FAQ exists
    const faqCheck = await pool.query(
      'SELECT id FROM faqs WHERE id = $1 AND is_active = true', 
      [id]
    );
    if (faqCheck.rows.length === 0) {
      return res.status(404).json({ error: 'FAQ not found' });
    }

    // Update ask count and last asked
    await pool.query(`
      UPDATE faqs 
      SET ask_count = ask_count + 1, last_asked = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);

    // Record analytics event
    await pool.query(`
      INSERT INTO faq_analytics (faq_id, asked_by, source, user_agent, ip_address, account_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, req.user.userId, source, user_agent, ip_address, req.user.accountId]);

    res.json({ message: 'FAQ ask recorded successfully' });

  } catch (error) {
    console.error('Error recording FAQ ask:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/faqs/categories - List all FAQ categories
router.get('/categories/list', async (req, res) => {
  try {
    const query = `
      SELECT fc.*, COUNT(f.id) as faq_count
      FROM faq_categories fc
      LEFT JOIN faqs f ON fc.id = f.category_id AND f.is_active = true
      GROUP BY fc.id
      ORDER BY fc.name
    `;

    const result = await pool.query(query);
    res.json(result.rows);

  } catch (error) {
    console.error('Error fetching FAQ categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/faqs/categories - Create new FAQ category
router.post('/categories', categoryValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, color = '#3B82F6' } = req.body;

    const query = `
      INSERT INTO faq_categories (name, description, color, account_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await pool.query(query, [name, description, color, req.user.accountId]);

    res.status(201).json(result.rows[0]);

  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ error: 'Category name already exists' });
    }
    console.error('Error creating FAQ category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/faqs/tags - List all FAQ tags
router.get('/tags/list', async (req, res) => {
  try {
    const query = `
      SELECT ft.*, COUNT(ftr.faq_id) as usage_count
      FROM faq_tags ft
      LEFT JOIN faq_tag_relationships ftr ON ft.id = ftr.tag_id
      GROUP BY ft.id
      ORDER BY usage_count DESC, ft.name
    `;

    const result = await pool.query(query);
    res.json(result.rows);

  } catch (error) {
    console.error('Error fetching FAQ tags:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;