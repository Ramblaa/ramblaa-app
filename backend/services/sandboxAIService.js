import OpenAI from 'openai';
import pool from '../config/database.js';

class SandboxAIService {
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey || apiKey === 'your-openai-api-key-here') {
      console.warn('OpenAI API key not configured - using mock responses for demo');
      this.openai = null;
    } else {
      this.openai = new OpenAI({
        apiKey: apiKey
      });
    }
    this.model = 'gpt-4o-mini';
  }

  /**
   * Main orchestrator function - runs the complete automation pipeline
   */
  async runFullAutomation(sessionId, accountId) {
    console.log(`Starting sandbox automation for session: ${sessionId}`);

    try {
      // 1. Process and summarize new messages
      console.log('[SandboxAI] Step 1: Processing and summarizing messages...');
      const summaries = await this.processSummarizeMessages(sessionId, accountId);
      console.log(`[SandboxAI] Step 1 completed: Found ${summaries.length} summaries`);

      // 2. Generate AI responses based on summaries
      console.log('[SandboxAI] Step 2: Building AI responses from summaries...');
      const responses = await this.buildAiResponseFromSummaries(sessionId, summaries);
      console.log(`[SandboxAI] Step 2 completed: Generated ${responses.length} responses`);

      // 3. Create tasks if needed
      console.log('[SandboxAI] Step 3: Creating staff tasks...');
      const tasks = await this.createStaffTasks(sessionId, summaries);
      console.log(`[SandboxAI] Step 3 completed: Created ${tasks.length} tasks`);

      // 4. Evaluate task status and generate follow-ups
      console.log('[SandboxAI] Step 4: Evaluating task status...');
      const followUps = await this.evaluateTaskStatus(sessionId);
      console.log(`[SandboxAI] Step 4 completed: Generated ${followUps.length} follow-ups`);

      // 5. Process any escalations
      console.log('[SandboxAI] Step 5: Processing escalations...');
      const escalations = await this.processHostEscalations(sessionId, summaries);
      console.log(`[SandboxAI] Step 5 completed: Processed ${escalations.length} escalations`);

      return {
        summaries,
        responses,
        tasks,
        followUps,
        escalations,
        success: true
      };
    } catch (error) {
      console.error('Sandbox automation error:', error);
      throw error;
    }
  }

  /**
   * Process and summarize incoming messages
   */
  async processSummarizeMessages(sessionId, accountId) {
    const client = await pool.connect();

    try {
      // Get unprocessed messages from this sandbox session
      const messagesQuery = `
        SELECT
          ml.*,
          ss.scenario_data,
          p.property_title as property_name,
          p.property_location as property_address,
          p.check_in_time,
          p.check_out_time
        FROM message_log ml
        JOIN sandbox_sessions ss ON ml.sandbox_session_id = ss.id
        LEFT JOIN properties p ON (ss.scenario_data->>'property_id')::INTEGER = p.id
        WHERE ml.sandbox_session_id = $1
        AND ml.is_sandbox = TRUE
        AND ml.message_type = 'Inbound'
        AND NOT EXISTS (
          SELECT 1 FROM sandbox_ai_processing sap
          WHERE sap.sandbox_session_id = ml.sandbox_session_id
          AND sap.message_uuid = ml.message_uuid
          AND sap.processing_type = 'summarization'
          AND sap.processing_status = 'completed'
        )
        ORDER BY ml.timestamp ASC
      `;

      const messages = await client.query(messagesQuery, [sessionId]);

      const summaries = [];

      for (const message of messages.rows) {
        // Get conversation history for context
        const historyQuery = `
          SELECT message_body, message_type, timestamp
          FROM message_log
          WHERE sandbox_session_id = $1
          AND timestamp < $2
          ORDER BY timestamp DESC
          LIMIT 10
        `;

        const history = await client.query(historyQuery, [sessionId, message.timestamp]);

        // Build context for AI
        const context = this.buildMessageContext(message, history.rows);

        // Generate summary using AI
        const summary = await this.generateMessageSummary(context, message);

        // Store the summary in processing table
        await client.query(`
          INSERT INTO sandbox_ai_processing (
            sandbox_session_id, message_uuid, processing_type,
            input_data, output_data, ai_model, processing_status, processed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
          sessionId,
          message.message_uuid,
          'summarization',
          { message: message.message_body, context },
          summary,
          this.model,
          'completed'
        ]);

        summaries.push({
          message_uuid: message.message_uuid,
          original_message: message.message_body,
          summary
        });
      }

      return summaries;
    } finally {
      client.release();
    }
  }

  /**
   * Build context for message processing
   */
  buildMessageContext(message, history) {
    const scenarioData = message.scenario_data || {};

    return {
      property: {
        id: scenarioData.property_id,
        name: message.property_name,
        address: message.property_address,
        checkIn: message.check_in_time,
        checkOut: message.check_out_time
      },
      guest: {
        name: scenarioData.guest_name || 'Guest',
        phone: message.from_number,
        bookingDates: {
          checkIn: scenarioData.check_in_date,
          checkOut: scenarioData.check_out_date
        }
      },
      conversationHistory: history.map(h => ({
        text: h.message_body,
        type: h.message_type,
        timestamp: h.timestamp
      }))
    };
  }

  /**
   * Generate AI summary of a message
   */
  async generateMessageSummary(context, message) {
    // If no OpenAI API key, return mock response
    if (!this.openai) {
      return this.getMockSummary(message.message_body);
    }

    const prompt = `
You are an AI assistant for a property management system. Analyze this guest message and provide a structured summary.

Property: ${context.property.name}
Guest: ${context.guest.name}
Current Message: "${message.message_body}"

Recent Conversation History:
${context.conversationHistory.map(h => `${h.type}: ${h.text}`).join('\n')}

Please provide a JSON response with:
{
  "language": "detected language (en, es, fr, etc.)",
  "sentiment": "positive/neutral/negative/urgent",
  "tone": "friendly/formal/frustrated/confused",
  "actionRequired": true/false,
  "actionTitle": "brief description of what needs to be done",
  "category": "booking/maintenance/check-in/check-out/amenities/complaint/general",
  "priority": "low/medium/high/urgent",
  "keyInformation": ["list of important details extracted"],
  "suggestedResponse": "brief suggested response to the guest"
}`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a helpful property management assistant. Always respond with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
      console.error('Error generating summary:', error);
      return this.getMockSummary(message.message_body);
    }
  }

  /**
   * Generate mock summary for demo purposes
   */
  getMockSummary(messageText) {
    const message = messageText.toLowerCase();

    // Simple keyword-based analysis for demo
    let category = 'general';
    let actionRequired = false;
    let priority = 'medium';
    let sentiment = 'neutral';
    let actionTitle = 'Message received';

    if (message.includes('key') || message.includes('check in') || message.includes('access')) {
      category = 'check-in';
      actionRequired = true;
      priority = 'high';
      actionTitle = 'Help with property access';
    } else if (message.includes('wifi') || message.includes('password') || message.includes('network')) {
      category = 'amenities';
      actionRequired = true;  // Changed to true
      priority = 'medium';
      actionTitle = 'WiFi information request';
    } else if (message.includes('broken') || message.includes('fix') || message.includes('repair')) {
      category = 'maintenance';
      actionRequired = true;
      priority = 'medium';
      actionTitle = 'Maintenance request';
    } else if (message.includes('noise') || message.includes('complaint') || message.includes('problem')) {
      category = 'complaint';
      actionRequired = true;
      priority = 'high';
      sentiment = 'negative';
      actionTitle = 'Address guest complaint';
    } else if (message.includes('clean')) {
      category = 'cleaning';
      actionRequired = true;
      priority = 'medium';
      actionTitle = 'Cleaning request';
    }

    return {
      language: 'en',
      sentiment,
      tone: sentiment === 'negative' ? 'frustrated' : 'friendly',
      actionRequired,
      actionTitle,
      category,
      priority,
      keyInformation: [actionTitle],
      suggestedResponse: actionRequired ?
        `Thank you for letting me know. I'll take care of this right away.` :
        `Thank you for your message. Is there anything I can help you with?`
    };
  }

  /**
   * Generate AI responses based on message summaries
   */
  async buildAiResponseFromSummaries(sessionId, summaries) {
    console.log(`[SandboxAI] buildAiResponseFromSummaries: Processing ${summaries.length} summaries`);
    const client = await pool.connect();
    const responses = [];

    try {
      for (const [index, summary] of summaries.entries()) {
        console.log(`[SandboxAI] Processing summary ${index + 1}/${summaries.length}:`, {
          actionRequired: summary.summary.actionRequired,
          category: summary.summary.category,
          priority: summary.summary.priority
        });

        // Skip if no action required
        if (!summary.summary.actionRequired) {
          console.log(`[SandboxAI] Skipping summary ${index + 1}: No action required`);
          continue;
        }

        console.log(`[SandboxAI] Processing summary ${index + 1}: Action required, getting property data...`);

        // Get property FAQs and templates
        const propertyData = await this.getPropertyData(sessionId, client);

        console.log(`[SandboxAI] Processing summary ${index + 1}: Generating AI response...`);

        // Generate appropriate response
        const response = await this.generateAiResponse(summary, propertyData);

        // Store the response as an outbound message
        const messageUuid = `RESP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await client.query(`
          INSERT INTO message_log (
            account_id, message_uuid, timestamp, from_number, to_number,
            message_body, message_type, requestor_role, is_sandbox,
            sandbox_session_id, sandbox_metadata
          ) VALUES (
            (SELECT account_id FROM sandbox_sessions WHERE id = $1),
            $2, NOW(), $3, $4, $5, $6, $7, TRUE, $1, $8
          )
        `, [
          sessionId,
          messageUuid,
          'System', // From (host/AI)
          summary.original_message.from_number || 'Guest',
          response.message,
          'Outbound',
          'ai',
          {
            generated_from: summary.message_uuid,
            summary: summary.summary
          }
        ]);

        // Record AI processing
        await client.query(`
          INSERT INTO sandbox_ai_processing (
            sandbox_session_id, message_uuid, processing_type,
            input_data, output_data, ai_model, processing_status, processed_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
          sessionId,
          messageUuid,
          'response_generation',
          { summary: summary.summary },
          response,
          this.model,
          'completed'
        ]);

        responses.push({
          message_uuid: messageUuid,
          response: response.message,
          metadata: response
        });
      }

      return responses;
    } finally {
      client.release();
    }
  }

  /**
   * Get property data for context
   */
  async getPropertyData(sessionId, client) {
    const query = `
      SELECT
        ss.scenario_data,
        p.*,
        COALESCE(
          array_agg(DISTINCT f.*) FILTER (WHERE f.id IS NOT NULL),
          ARRAY[]::faqs[]
        ) as faqs
      FROM sandbox_sessions ss
      LEFT JOIN properties p ON (ss.scenario_data->>'property_id')::INTEGER = p.id
      LEFT JOIN faqs f ON f.property_id = p.id
      WHERE ss.id = $1
      GROUP BY ss.id, ss.scenario_data, p.id
    `;

    const result = await client.query(query, [sessionId]);
    const data = result.rows[0] || {};

    // Ensure faqs is always an array
    if (!Array.isArray(data.faqs)) {
      data.faqs = [];
    }

    // Debug logging to see what property data we have
    console.log('[SandboxAI] Property data retrieved:', {
      propertyId: data.id,
      propertyTitle: data.property_title,
      columns: Object.keys(data).filter(key => key.startsWith('wifi') || key.includes('password') || key.includes('WiFi'))
    });

    return data;
  }

  /**
   * Build comprehensive property information string from all available data
   */
  buildComprehensivePropertyInfo(propertyData) {
    if (!propertyData || !propertyData.id) {
      return 'Property Information: Not available';
    }

    // Core property fields mapping
    const fieldMappings = {
      'Property Name': propertyData.property_title || propertyData.name,
      'Address': propertyData.property_location || propertyData.address,
      'Check-in Time': propertyData.check_in_time,
      'Check-out Time': propertyData.check_out_time,
      'WiFi Network': propertyData.wifi_network_name,
      'WiFi Password': propertyData.wifi_password,
      'Number of Bedrooms': propertyData.bedrooms,
      'Number of Bathrooms': propertyData.bathrooms,
      'Max Guests': propertyData.max_guests,
      'Property Type': propertyData.property_type,
      'Description': propertyData.description,
      'House Rules': propertyData.house_rules,
      'Amenities': propertyData.amenities,
      'Parking Information': propertyData.parking_info,
      'Emergency Contact': propertyData.emergency_contact,
      'Host Phone': propertyData.host_phone,
      'Host Email': propertyData.host_email,
      'Local Area Information': propertyData.local_area_info,
      'Transportation': propertyData.transportation_info,
      'Nearby Attractions': propertyData.nearby_attractions,
      'Restaurant Recommendations': propertyData.restaurant_recommendations,
      'Grocery Stores': propertyData.grocery_stores,
      'Medical Facilities': propertyData.medical_facilities,
      'Pet Policy': propertyData.pet_policy,
      'Smoking Policy': propertyData.smoking_policy,
      'Noise Policy': propertyData.noise_policy,
      'Party Policy': propertyData.party_policy,
      'Additional Instructions': propertyData.additional_instructions,
      'Cleaning Instructions': propertyData.cleaning_instructions,
      'Appliance Instructions': propertyData.appliance_instructions,
      'Heating/Cooling': propertyData.hvac_instructions,
      'Security System': propertyData.security_system_info,
      'Key/Access Information': propertyData.key_access_info
    };

    // Filter out empty/null values and build property info string
    const propertyLines = [];
    propertyLines.push('Property Information:');

    Object.entries(fieldMappings).forEach(([label, value]) => {
      if (value && String(value).trim() && String(value).trim() !== 'null') {
        propertyLines.push(`- ${label}: ${value}`);
      }
    });

    // Also include any additional data that might be stored in other columns
    const excludeKeys = ['id', 'account_id', 'created_at', 'updated_at', 'is_active', 'faqs', 'scenario_data'];
    Object.keys(propertyData).forEach(key => {
      if (!excludeKeys.includes(key) && !Object.values(fieldMappings).includes(propertyData[key])) {
        const value = propertyData[key];
        if (value && String(value).trim() && String(value).trim() !== 'null') {
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          propertyLines.push(`- ${label}: ${value}`);
        }
      }
    });

    return propertyLines.join('\n');
  }

  /**
   * Generate AI response to guest
   */
  async generateAiResponse(summary, propertyData) {
    console.log('[SandboxAI] Generating AI response for summary:', JSON.stringify(summary, null, 2));

    // If no OpenAI API key, return mock response
    if (!this.openai) {
      console.log('[SandboxAI] No OpenAI API key found, returning mock response');
      return this.getMockResponse(summary.summary);
    }

    console.log('[SandboxAI] OpenAI API key available, proceeding with AI generation...');

    // Ensure FAQs is an array for safe processing
    const faqsArray = Array.isArray(propertyData.faqs) ? propertyData.faqs : [];
    const validFaqs = faqsArray.filter(f => f && f.question && f.answer);

    // Build comprehensive property information from all available data
    const propertyInfo = this.buildComprehensivePropertyInfo(propertyData);

    const prompt = `
You are a helpful property host assistant. Generate a friendly, professional response to the guest.

Guest Message Summary:
${JSON.stringify(summary.summary, null, 2)}

${propertyInfo}

Available FAQs:
${validFaqs.length > 0 ? validFaqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n') : 'None'}

Generate a response that:
1. Addresses the guest's concern
2. Provides helpful information
3. Maintains a ${summary.summary.tone === 'frustrated' ? 'empathetic and apologetic' : 'friendly and professional'} tone
4. Is concise and clear
5. If the issue requires human intervention, mention that the host will follow up

Respond with JSON:
{
  "message": "the response message to send",
  "requiresFollowUp": true/false,
  "escalationNeeded": true/false,
  "taskType": "cleaning/maintenance/none"
}`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a helpful property management assistant. Respond with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
      console.error('Error generating response:', error);
      return this.getMockResponse(summary.summary);
    }
  }

  /**
   * Generate mock response for demo purposes
   */
  getMockResponse(summary) {
    let message = "Thank you for your message! ";
    let taskType = 'none';
    let escalationNeeded = false;

    switch(summary.category) {
      case 'check-in':
        message += "The door code is 1234. You can find detailed check-in instructions in your booking confirmation.";
        break;
      case 'maintenance':
        message += "I'm sorry to hear about this issue. I'll send someone to take a look at it right away.";
        taskType = 'maintenance';
        break;
      case 'cleaning':
        message += "I'll arrange for housekeeping to address this immediately.";
        taskType = 'cleaning';
        break;
      case 'complaint':
        message += "I sincerely apologize for this inconvenience. I'm taking immediate action to resolve this issue.";
        escalationNeeded = true;
        break;
      default:
        message += "Is there anything specific I can help you with during your stay?";
    }

    return {
      message,
      requiresFollowUp: summary.priority === 'high',
      escalationNeeded,
      taskType
    };
  }

  /**
   * Create staff tasks based on message analysis
   */
  async createStaffTasks(sessionId, summaries) {
    console.log(`[SandboxAI] createStaffTasks: Processing ${summaries.length} summaries`);
    const client = await pool.connect();
    const tasks = [];

    try {
      for (const [index, summary] of summaries.entries()) {
        console.log(`[SandboxAI] Task Creation ${index + 1}/${summaries.length}:`, {
          actionRequired: summary.summary.actionRequired,
          category: summary.summary.category,
          priority: summary.summary.priority
        });

        // Check if task creation is needed based on category and action required
        const taskBuckets = this.getTaskBucketsFromCategory(summary.summary.category);
        const needsTask = summary.summary.actionRequired && taskBuckets.length > 0;

        if (!needsTask) {
          console.log(`[SandboxAI] Skipping task creation ${index + 1}: No action required or no task buckets found`);
          continue;
        }

        console.log(`[SandboxAI] Task buckets identified for ${summary.summary.category}:`, taskBuckets);

        // Get session property info for task creation
        const sessionData = await this.getSessionData(sessionId, client);

        // Create tasks for each bucket (mimics Google Apps Script logic)
        for (const taskBucket of taskBuckets) {
          // Check if similar task already exists
          const existingTask = await this.findExistingOpenTask(sessionId, taskBucket, client);
          if (existingTask) {
            console.log(`[SandboxAI] Skipping duplicate task creation for bucket: ${taskBucket}`);
            continue;
          }

          // Determine task details based on task bucket
          const taskDetails = this.determineTaskDetailsByBucket(taskBucket, summary.summary, sessionData);

          const taskUuid = `TASK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          console.log(`[SandboxAI] Creating task:`, {
            taskBucket,
            taskUuid,
            type: taskDetails.type,
            title: taskDetails.title
          });

          // Create task
          await client.query(`
            INSERT INTO sandbox_tasks (
              sandbox_session_id, task_title, task_description,
              assigned_to_role, assignee_name, status, priority, task_type,
              due_date, due_time
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [
            sessionId,
            taskDetails.title,
            taskDetails.description,
            taskDetails.assignee_role,
            taskDetails.assignee_name,
            taskDetails.status,
            summary.summary.priority,
            taskDetails.task_type,
            taskDetails.due_date,
            taskDetails.due_time
          ]);

          tasks.push({
            task_uuid: taskUuid,
            task_bucket: taskBucket,
            ...taskDetails
          });
        }
      }

      console.log(`[SandboxAI] createStaffTasks completed: Created ${tasks.length} tasks`);
      return tasks;
    } finally {
      client.release();
    }
  }

  /**
   * Get task buckets from message category (mimics Google Apps Script task categorization)
   */
  getTaskBucketsFromCategory(category) {
    // Map message categories to task buckets based on Google Apps Script logic
    const categoryToTaskBuckets = {
      'maintenance': ['Maintenance', 'Repairs'],
      'cleaning': ['Cleaning', 'Housekeeping'],
      'amenities': ['Property Support', 'Guest Services'],
      'check-in': ['Check-in Support'],
      'check-out': ['Check-out Support'],
      'booking': ['Booking Support'],
      'complaint': ['Property Management', 'Guest Relations'],
      'urgent': ['Emergency Response', 'Priority Support'],
      'general': ['General Support']
    };

    return categoryToTaskBuckets[category] || ['General Support'];
  }

  /**
   * Find existing open task for the same bucket to avoid duplicates
   */
  async findExistingOpenTask(sessionId, taskBucket, client) {
    const query = `
      SELECT * FROM sandbox_tasks
      WHERE sandbox_session_id = $1
        AND task_bucket = $2
        AND status NOT IN ('completed', 'cancelled', 'closed')
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await client.query(query, [sessionId, taskBucket]);
    return result.rows[0] || null;
  }

  /**
   * Get session data for task creation
   */
  async getSessionData(sessionId, client) {
    const query = `
      SELECT ss.*, p.id as property_id, p.property_title
      FROM sandbox_sessions ss
      LEFT JOIN properties p ON (ss.scenario_data->>'property_id')::INTEGER = p.id
      WHERE ss.id = $1
    `;

    const result = await client.query(query, [sessionId]);
    return result.rows[0] || {};
  }

  /**
   * Determine comprehensive task details based on task bucket (Google Apps Script approach)
   */
  determineTaskDetailsByBucket(taskBucket, summary, sessionData) {
    // Generate meaningful task title based on category and key information
    const taskTitle = this.generateTaskTitle(taskBucket, summary, sessionData);

    // Calculate due date based on task priority and type
    const dueDate = this.calculateDueDate(summary.priority, taskBucket);

    const baseDetails = {
      title: taskTitle,
      description: this.buildTaskDescription(summary, taskBucket, sessionData),
      property_id: sessionData.property_id || null,
      property_name: sessionData.property_title || 'Unknown Property',
      status: 'pending',
      due_date: dueDate.date,
      due_time: dueDate.time
    };

    // Task bucket specific configuration (mimics Google Apps Script task definitions)
    const taskConfig = this.getTaskConfiguration(taskBucket);

    // Determine action holder based on requirements
    const hasGuestRequirements = taskConfig.guest_requirements && taskConfig.guest_requirements.length > 0;
    const action_holder = hasGuestRequirements ? 'Guest' : 'Staff';

    return {
      ...baseDetails,
      type: taskConfig.type,
      assignee_name: taskConfig.staff_name || 'Support Team',
      assignee_role: taskConfig.staff_role || 'Support Staff',
      action_holder,
      guest_requirements: taskConfig.guest_requirements || '',
      staff_requirements: taskConfig.staff_requirements || '',
      host_escalation: taskConfig.host_escalation || false
    };
  }

  /**
   * Get task configuration for specific task bucket
   */
  getTaskConfiguration(taskBucket) {
    const taskConfigurations = {
      'Maintenance': {
        type: 'maintenance',
        staff_name: 'Maintenance Team',
        staff_role: 'Maintenance Technician',
        staff_requirements: 'Assess issue, provide repair estimate, complete repairs',
        guest_requirements: 'Provide access to property for inspection',
        host_escalation: false
      },
      'Repairs': {
        type: 'maintenance',
        staff_name: 'Repair Specialist',
        staff_role: 'Repair Technician',
        staff_requirements: 'Diagnose problem, source parts, complete repair work',
        guest_requirements: 'Schedule convenient repair time',
        host_escalation: false
      },
      'Cleaning': {
        type: 'cleaning',
        staff_name: 'Housekeeping Team',
        staff_role: 'Housekeeper',
        staff_requirements: 'Address cleaning concerns, refresh amenities',
        guest_requirements: '',
        host_escalation: false
      },
      'Housekeeping': {
        type: 'cleaning',
        staff_name: 'Housekeeping Supervisor',
        staff_role: 'Housekeeping Manager',
        staff_requirements: 'Coordinate additional cleaning, quality check',
        guest_requirements: '',
        host_escalation: false
      },
      'Property Support': {
        type: 'support',
        staff_name: 'Property Support',
        staff_role: 'Property Assistant',
        staff_requirements: 'Provide property information and assistance',
        guest_requirements: '',
        host_escalation: false
      },
      'Guest Services': {
        type: 'service',
        staff_name: 'Guest Services',
        staff_role: 'Guest Relations',
        staff_requirements: 'Address guest needs and requests',
        guest_requirements: '',
        host_escalation: false
      },
      'Check-in Support': {
        type: 'checkin',
        staff_name: 'Check-in Coordinator',
        staff_role: 'Front Desk',
        staff_requirements: 'Facilitate smooth check-in process',
        guest_requirements: 'Provide arrival time and contact information',
        host_escalation: false
      },
      'Check-out Support': {
        type: 'checkout',
        staff_name: 'Check-out Coordinator',
        staff_role: 'Front Desk',
        staff_requirements: 'Process check-out and property inspection',
        guest_requirements: 'Complete departure checklist',
        host_escalation: false
      },
      'Property Management': {
        type: 'management',
        staff_name: 'Property Manager',
        staff_role: 'Management',
        staff_requirements: 'Investigate issue, develop resolution plan',
        guest_requirements: '',
        host_escalation: true
      },
      'Guest Relations': {
        type: 'relations',
        staff_name: 'Guest Relations Manager',
        staff_role: 'Management',
        staff_requirements: 'Address guest concerns, provide compensation if needed',
        guest_requirements: '',
        host_escalation: true
      },
      'Emergency Response': {
        type: 'emergency',
        staff_name: 'Emergency Coordinator',
        staff_role: 'Emergency Response',
        staff_requirements: 'Immediate response, coordinate emergency services',
        guest_requirements: 'Provide emergency contact information',
        host_escalation: true
      },
      'General Support': {
        type: 'general',
        staff_name: 'Support Team',
        staff_role: 'Support Staff',
        staff_requirements: 'Provide general assistance and information',
        guest_requirements: '',
        host_escalation: false
      }
    };

    return taskConfigurations[taskBucket] || taskConfigurations['General Support'];
  }

  /**
   * Build comprehensive task description
   */
  buildTaskDescription(summary, taskBucket, sessionData = {}) {
    const parts = [
      `Property: ${sessionData.property_title || 'Unknown Property'}`,
      `Guest: ${sessionData.guest_name || 'Unknown Guest'}`,
      '',
      `Task Type: ${taskBucket}`,
      `Category: ${summary.category}`,
      `Priority: ${summary.priority}`,
      `Sentiment: ${summary.sentiment}`,
      `Tone: ${summary.tone}`,
      ''
    ];

    if (summary.keyInformation && summary.keyInformation.length > 0) {
      parts.push(`Issue Details:`);
      summary.keyInformation.forEach(info => {
        parts.push(`- ${info}`);
      });
      parts.push('');
    }

    if (summary.actionTitle) {
      parts.push(`Action Required: ${summary.actionTitle}`);
      parts.push('');
    }

    if (summary.suggestedResponse) {
      parts.push(`Suggested Response: ${summary.suggestedResponse}`);
      parts.push('');
    }

    // Add property details if available
    if (sessionData.property_location) {
      parts.push(`Property Location: ${sessionData.property_location}`);
    }

    return parts.join('\n');
  }

  /**
   * Generate meaningful task title based on context
   */
  generateTaskTitle(taskBucket, summary, sessionData) {
    // Extract key information for title
    const keyInfo = summary.keyInformation && summary.keyInformation.length > 0
      ? summary.keyInformation[0]
      : null;

    const propertyName = sessionData.property_title || 'Property';

    // Generate contextual titles based on category and task bucket
    const titleTemplates = {
      'maintenance': {
        'Maintenance': keyInfo ? `Maintenance Issue: ${keyInfo} - ${propertyName}` : `Maintenance Request - ${propertyName}`,
        'Repairs': keyInfo ? `Repair Needed: ${keyInfo} - ${propertyName}` : `Repair Request - ${propertyName}`
      },
      'cleaning': {
        'Cleaning': keyInfo ? `Cleaning Issue: ${keyInfo} - ${propertyName}` : `Cleaning Request - ${propertyName}`,
        'Housekeeping': keyInfo ? `Housekeeping: ${keyInfo} - ${propertyName}` : `Housekeeping Request - ${propertyName}`
      },
      'amenities': {
        'Property Support': keyInfo ? `Property Support: ${keyInfo} - ${propertyName}` : `Property Support Request - ${propertyName}`,
        'Guest Services': keyInfo ? `Guest Services: ${keyInfo} - ${propertyName}` : `Guest Services Request - ${propertyName}`
      },
      'complaint': {
        'Property Management': keyInfo ? `Property Issue: ${keyInfo} - ${propertyName}` : `Property Management Issue - ${propertyName}`,
        'Guest Relations': keyInfo ? `Guest Concern: ${keyInfo} - ${propertyName}` : `Guest Relations Issue - ${propertyName}`
      }
    };

    // Get template based on category and task bucket
    const categoryTemplates = titleTemplates[summary.category];
    if (categoryTemplates && categoryTemplates[taskBucket]) {
      return categoryTemplates[taskBucket];
    }

    // Fallback to actionTitle or generic title
    if (summary.actionTitle) {
      return `${summary.actionTitle} - ${propertyName}`;
    }

    return `${taskBucket} Request - ${propertyName}`;
  }

  /**
   * Calculate realistic due date and time based on priority and task type
   */
  calculateDueDate(priority, taskBucket) {
    const now = new Date();
    let hoursToAdd = 24; // default 24 hours

    // Adjust hours based on priority
    switch (priority?.toLowerCase()) {
      case 'high':
      case 'urgent':
        hoursToAdd = 4; // 4 hours for urgent tasks
        break;
      case 'medium':
        hoursToAdd = 12; // 12 hours for medium priority
        break;
      case 'low':
        hoursToAdd = 48; // 48 hours for low priority
        break;
    }

    // Adjust based on task type
    switch (taskBucket) {
      case 'Maintenance':
      case 'Repairs':
        hoursToAdd += 12; // Maintenance tasks take longer
        break;
      case 'Cleaning':
      case 'Housekeeping':
        hoursToAdd += 2; // Cleaning can be done quickly
        break;
      case 'Property Support':
      case 'Guest Services':
        hoursToAdd = Math.max(hoursToAdd - 2, 2); // Service requests should be fast
        break;
    }

    const dueDate = new Date(now.getTime() + (hoursToAdd * 60 * 60 * 1000));

    // Format date as YYYY-MM-DD
    const dateStr = dueDate.toISOString().split('T')[0];

    // Set reasonable business hours (9 AM - 5 PM)
    const hour = dueDate.getHours();
    let businessHour = hour;
    if (hour < 9) businessHour = 9;
    if (hour > 17) businessHour = 17;

    const timeStr = `${businessHour.toString().padStart(2, '0')}:00`;

    return {
      date: dateStr,
      time: timeStr
    };
  }

  /**
   * Determine task details from summary
   */
  determineTaskDetails(summary) {
    const baseDetails = {
      title: summary.actionTitle || 'Guest Request',
      description: `Category: ${summary.category}\nPriority: ${summary.priority}\nDetails: ${summary.keyInformation.join(', ')}`
    };

    // Determine task type and assignee based on category
    switch(summary.category) {
      case 'maintenance':
        return {
          ...baseDetails,
          type: 'maintenance',
          assignee_name: 'Maintenance Team',
          assignee_role: 'Maintenance Staff'
        };
      case 'cleaning':
        return {
          ...baseDetails,
          type: 'cleaning',
          assignee_name: 'Cleaning Team',
          assignee_role: 'Cleaning Staff'
        };
      case 'complaint':
        return {
          ...baseDetails,
          type: 'inspection',
          assignee_name: 'Property Manager',
          assignee_role: 'Management'
        };
      default:
        return {
          ...baseDetails,
          type: 'general',
          assignee_name: 'Support Team',
          assignee_role: 'Support Staff'
        };
    }
  }

  /**
   * Evaluate task status and generate follow-ups
   */
  async evaluateTaskStatus(sessionId) {
    const client = await pool.connect();

    try {
      // Get open tasks
      const tasksQuery = `
        SELECT * FROM sandbox_tasks
        WHERE sandbox_session_id = $1
        AND status IN ('pending', 'in-progress')
        ORDER BY created_at ASC
      `;

      const tasks = await client.query(tasksQuery, [sessionId]);
      const followUps = [];

      for (const task of tasks.rows) {
        // Check if task needs follow-up (e.g., been pending too long)
        const hoursSinceCreated = (Date.now() - new Date(task.created_at)) / (1000 * 60 * 60);

        if (hoursSinceCreated > 2 && task.status === 'pending') {
          followUps.push({
            task_uuid: task.task_uuid,
            message: `Following up on ${task.title} - this task has been pending for ${Math.round(hoursSinceCreated)} hours.`,
            type: 'reminder'
          });
        }
      }

      return followUps;
    } finally {
      client.release();
    }
  }

  /**
   * Process host escalations for urgent matters
   */
  async processHostEscalations(sessionId, summaries) {
    const escalations = [];

    for (const summary of summaries) {
      if (summary.summary.priority === 'urgent' || summary.summary.sentiment === 'urgent') {
        escalations.push({
          message_uuid: summary.message_uuid,
          reason: 'Urgent guest request',
          summary: summary.summary,
          recommended_action: 'Immediate host attention required'
        });
      }
    }

    return escalations;
  }
}

export default new SandboxAIService();