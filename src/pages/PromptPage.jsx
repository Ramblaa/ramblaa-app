import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bot, Save, RefreshCw, CheckSquare, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Label } from '../components/ui/label'
import { Input } from '../components/ui/input'
import { useNotification } from '../contexts/NotificationContext'
import AddTaskForm from '../components/AddTaskForm'

const defaultPrompt = `You are Ramble, an AI assistant for property management. You help manage guest communications, staff coordination, and property operations.

CORE PRINCIPLES:
- Always prioritize guest satisfaction and safety
- Be proactive in identifying and resolving issues
- Escalate appropriately based on the defined rules
- Maintain professional, friendly communication
- Coordinate efficiently with staff and service providers

ESCALATION GUIDELINES:
1. Missing Information: When critical details are missing from requests, gather necessary information before proceeding or escalate for clarification
2. No Response from Contacts: If staff or service providers don't respond within expected timeframes, escalate to ensure guest needs are met
3. User Frustration/Escalation: When guests express dissatisfaction or request manager intervention, escalate immediately while providing immediate support
4. Safety Concerns: Any safety issues or potential hazards must be escalated immediately regardless of other factors

COMMUNICATION STYLE:
- Use warm, professional tone
- Be clear and concise
- Provide specific next steps
- Always acknowledge guest concerns
- Follow up proactively

Remember: Your goal is to provide exceptional guest experiences while efficiently managing property operations.`

// Available contacts for the dropdown
const availableContacts = [
  { id: 1, name: 'Maria Garcia', type: 'Cleaning Service' },
  { id: 2, name: 'John Smith', type: 'Maintenance' },
  { id: 3, name: 'Sarah Wilson', type: 'Property Inspector' },
  { id: 4, name: 'Carlos Rodriguez', type: 'Tour Guide' },
  { id: 5, name: 'Pacific Taxi Co.', type: 'Transportation' },
  { id: 6, name: 'Lisa Chen', type: 'Concierge' },
]

// Available locations for the dropdown
const availableLocations = [
  { id: 1, name: 'Sunset Villa' },
  { id: 2, name: 'Mountain Retreat' },
  { id: 3, name: 'Beach House' },
  { id: 4, name: 'All Properties' }
]

// Task categories for the dropdown
const taskCategories = [
  'Booking',
  'CheckIn/CheckOut', 
  'Amenities',
  'Maintenance',
  'House Rules',
  'Local Rec',
  'Payment',
  'Complaint',
  'Other'
]

// Initial task data organized by categories
const initialTaskCategories = {
  'Booking': [
    { id: 1, name: 'Date Change', contactId: 6, requirements: 'Handle guest requests to modify reservation dates', locationId: 4 },
    { id: 2, name: 'Cancellation', contactId: 6, requirements: 'Process booking cancellations and refund policies', locationId: 4 },
    { id: 3, name: 'Extra Guest', contactId: 6, requirements: 'Manage additional guest requests and capacity adjustments', locationId: 4 },
    { id: 4, name: 'Extend Stay', contactId: 6, requirements: 'Handle requests to extend current reservations', locationId: 4 },
    { id: 5, name: 'New Reservation', contactId: 6, requirements: 'Process new booking requests and availability checks', locationId: 4 }
  ],
  'CheckIn/CheckOut': [
    { id: 6, name: 'Early Check-in', contactId: 6, requirements: 'Coordinate early arrival requests and property readiness', locationId: 4 },
    { id: 7, name: 'Late Check-out', contactId: 6, requirements: 'Manage late departure requests and scheduling', locationId: 4 },
    { id: 8, name: 'Key Access', contactId: 6, requirements: 'Provide assistance with key codes and access issues', locationId: 4 },
    { id: 9, name: 'Luggage Storage', contactId: 6, requirements: 'Arrange luggage storage before/after check-in times', locationId: 4 },
    { id: 10, name: 'Self Check-in Help', contactId: 6, requirements: 'Guide guests through self check-in procedures', locationId: 4 }
  ],
  'Amenities': [
    { id: 11, name: 'WiFi', contactId: 2, requirements: 'Troubleshoot internet connectivity issues and provide network details', locationId: 4 },
    { id: 12, name: 'Kitchen', contactId: 2, requirements: 'Handle kitchen appliance issues and usage guidance', locationId: 4 },
    { id: 13, name: 'Laundry', contactId: 2, requirements: 'Assist with laundry facility access and troubleshooting', locationId: 4 },
    { id: 14, name: 'Pool', contactId: 2, requirements: 'Provide pool access, hours, and maintenance coordination', locationId: 4 },
    { id: 15, name: 'Parking', contactId: 6, requirements: 'Guide guests on parking availability and restrictions', locationId: 4 },
    { id: 16, name: 'Heating/AC', contactId: 2, requirements: 'Troubleshoot climate control systems and temperature issues', locationId: 4 },
    { id: 17, name: 'Towels/Toiletries', contactId: 1, requirements: 'Coordinate additional towels and toiletry requests', locationId: 4 },
    { id: 18, name: 'TV/Streaming', contactId: 2, requirements: 'Assist with television and streaming service setup', locationId: 4 }
  ],
  'Maintenance': [
    { id: 19, name: 'Plumbing', contactId: 2, requirements: 'Coordinate plumbing repairs and emergency response', locationId: 4 },
    { id: 20, name: 'Electrical', contactId: 2, requirements: 'Handle electrical issues and safety concerns', locationId: 4 },
    { id: 21, name: 'Appliance', contactId: 2, requirements: 'Troubleshoot and repair household appliances', locationId: 4 },
    { id: 22, name: 'Cleaning', contactId: 1, requirements: 'Address cleanliness issues and schedule additional cleaning', locationId: 4 },
    { id: 23, name: 'Pest', contactId: 2, requirements: 'Coordinate pest control services and prevention', locationId: 4 },
    { id: 24, name: 'Noise', contactId: 6, requirements: 'Address noise complaints and neighbor coordination', locationId: 4 },
    { id: 25, name: 'Internet Outage', contactId: 2, requirements: 'Coordinate internet service restoration and troubleshooting', locationId: 4 }
  ],
  'House Rules': [
    { id: 26, name: 'Smoking', contactId: 6, requirements: 'Enforce no-smoking policies and violations', locationId: 4 },
    { id: 27, name: 'Pets', contactId: 6, requirements: 'Manage pet policies and unauthorized animal issues', locationId: 4 },
    { id: 28, name: 'Parties', contactId: 6, requirements: 'Address party violations and noise disturbances', locationId: 4 },
    { id: 29, name: 'Quiet Hours', contactId: 6, requirements: 'Enforce quiet hour policies and neighbor relations', locationId: 4 },
    { id: 30, name: 'Visitor Policy', contactId: 6, requirements: 'Manage visitor restrictions and unauthorized guests', locationId: 4 }
  ],
  'Local Rec': [
    { id: 31, name: 'Food/Drink', contactId: 6, requirements: 'Provide restaurant and dining recommendations', locationId: 4 },
    { id: 32, name: 'Transport', contactId: 5, requirements: 'Coordinate transportation and taxi services', locationId: 4 },
    { id: 33, name: 'Activities', contactId: 6, requirements: 'Suggest local activities and entertainment options', locationId: 4 },
    { id: 34, name: 'Sightseeing', contactId: 4, requirements: 'Provide tour guide services and attraction recommendations', locationId: 4 },
    { id: 35, name: 'Emergency Services', contactId: 6, requirements: 'Provide emergency contact information and assistance', locationId: 4 },
    { id: 36, name: 'Shopping', contactId: 6, requirements: 'Direct guests to shopping areas and grocery stores', locationId: 4 }
  ],
  'Payment': [
    { id: 37, name: 'Invoice', contactId: 6, requirements: 'Provide billing statements and invoice clarification', locationId: 4 },
    { id: 38, name: 'Refund', contactId: 6, requirements: 'Process refund requests and policy explanations', locationId: 4 },
    { id: 39, name: 'Fee Query', contactId: 6, requirements: 'Explain charges and fee breakdowns', locationId: 4 },
    { id: 40, name: 'Deposit', contactId: 6, requirements: 'Handle security deposit questions and returns', locationId: 4 },
    { id: 41, name: 'Tax Question', contactId: 6, requirements: 'Explain tax charges and local tax requirements', locationId: 4 }
  ],
  'Complaint': [
    { id: 42, name: 'Noise', contactId: 6, requirements: 'Address noise complaints and resolution coordination', locationId: 4 },
    { id: 43, name: 'Cleanliness', contactId: 1, requirements: 'Handle cleanliness complaints and immediate remediation', locationId: 4 },
    { id: 44, name: 'Safety', contactId: 6, requirements: 'Address safety concerns and emergency protocols', locationId: 4 },
    { id: 45, name: 'Service', contactId: 6, requirements: 'Handle service quality complaints and improvement measures', locationId: 4 },
    { id: 46, name: 'Billing Error', contactId: 6, requirements: 'Resolve billing discrepancies and charge corrections', locationId: 4 }
  ],
  'Other': [
    { id: 47, name: 'General Question', contactId: 6, requirements: 'Handle miscellaneous guest inquiries and general support', locationId: 4 },
    { id: 48, name: 'Undefined', contactId: 6, requirements: 'Categorize and route unclassified guest requests', locationId: 4 }
  ]
}

const tabs = [
  { id: 'prompt', name: 'System Prompt', icon: Bot },
  { id: 'tasks', name: 'Tasks', icon: CheckSquare },
]

export default function PromptPage() {
  const [activeTab, setActiveTab] = useState('prompt')
  const [prompt, setPrompt] = useState(defaultPrompt)
  const [isEdited, setIsEdited] = useState(false)
  const [taskCategories, setTaskCategories] = useState(initialTaskCategories)
  const [expandedCategories, setExpandedCategories] = useState({})
  const [newTask, setNewTask] = useState({
    name: '',
    contactId: '',
    requirements: '',
    locationId: '',
    category: ''
  })
  const { showSuccess, showInfo, showWarning } = useNotification()

  const handlePromptChange = (value) => {
    setPrompt(value)
    setIsEdited(true)
  }

  const handleSave = () => {
    console.log('Saving prompt:', prompt)
    setIsEdited(false)
    showSuccess('AI prompt saved successfully!')
  }

  const handleReset = () => {
    setPrompt(defaultPrompt)
    setIsEdited(true)
    showInfo('Prompt reset to default configuration')
  }

  const handleAddTask = () => {
    if (!newTask.name.trim() || !newTask.requirements.trim() || !newTask.category) {
      showWarning('Please fill in task name, category, and requirements.')
      return
    }

    const task = {
      id: Date.now(),
      name: newTask.name,
      contactId: newTask.contactId ? parseInt(newTask.contactId) : null,
      requirements: newTask.requirements,
      locationId: newTask.locationId ? parseInt(newTask.locationId) : null
    }

    setTaskCategories(prev => ({
      ...prev,
      [newTask.category]: [...(prev[newTask.category] || []), task]
    }))

    setNewTask({
      name: '',
      contactId: '',
      requirements: '',
      locationId: '',
      category: ''
    })
    showSuccess('Task added successfully!')
  }

  const deleteTask = (category, taskId) => {
    setTaskCategories(prev => ({
      ...prev,
      [category]: prev[category].filter(task => task.id !== taskId)
    }))
    showSuccess('Task deleted successfully!')
  }

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  const getContactName = (contactId) => {
    const contact = availableContacts.find(c => c.id === contactId)
    return contact ? `${contact.name} (${contact.type})` : 'Unassigned'
  }

  const getLocationName = (locationId) => {
    const location = availableLocations.find(l => l.id === locationId)
    return location ? location.name : 'Not specified'
  }

  const getTotalTasks = () => {
    return Object.values(taskCategories).reduce((total, tasks) => total + tasks.length, 0)
  }

  const renderSystemPrompt = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl font-semibold text-brand-dark">System Prompt Configuration</h2>
          <p className="text-sm sm:text-base text-brand-mid-gray leading-relaxed">Configure how Ramble thinks about and handles all rules and interactions</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {isEdited && (
            <span className="text-sm text-orange-600 font-medium">
              • Unsaved changes
            </span>
          )}
        </div>
      </div>

      {/* Main Prompt Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-brand-purple" />
            System Prompt
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="system-prompt" className="text-sm font-medium text-brand-dark">
              Core Instructions for AI Behavior
            </Label>
            <p className="text-sm text-brand-mid-gray mt-1 mb-3">
              This prompt defines how Ramble processes information, makes decisions, and interacts with guests and staff. 
              It should include guidance on escalation rules, communication style, and decision-making principles.
            </p>
            <textarea
              id="system-prompt"
              value={prompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              className="w-full h-96 px-3 py-2 border border-input rounded-md text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-brand-purple focus:ring-offset-2 break-words whitespace-pre-wrap overflow-wrap-anywhere"
              placeholder="Enter the system prompt that will guide AI behavior..."
            />
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pt-4 border-t">
            <div className="text-sm text-brand-mid-gray">
              Characters: {prompt.length} | Lines: {prompt.split('\n').length}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button 
                variant="outline" 
                onClick={handleReset}
                disabled={prompt === defaultPrompt}
                className="w-full sm:w-auto"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset to Default
              </Button>
              <Button 
                onClick={handleSave}
                disabled={!isEdited}
                className="w-full sm:w-auto"
              >
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Prompt Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-brand-dark mb-2">Best Practices</h4>
              <ul className="text-sm text-brand-mid-gray space-y-1">
                <li>• Be specific about escalation criteria</li>
                <li>• Define clear communication tone</li>
                <li>• Include safety prioritization</li>
                <li>• Specify decision-making frameworks</li>
                <li>• Reference all active rules and policies</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-brand-dark mb-2">Important Notes</h4>
              <ul className="text-sm text-brand-mid-gray space-y-1">
                <li>• Changes affect all AI interactions</li>
                <li>• Test thoroughly before deploying</li>
                <li>• Keep backup of working prompts</li>
                <li>• Monitor performance after changes</li>
                <li>• Admin-only access required</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderTasks = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-brand-dark">Task Configuration</h2>
          <p className="text-brand-mid-gray">Define task templates organized by category with assigned contacts</p>
        </div>
      </div>

      {/* Add New Task Form */}
      <AddTaskForm 
        newTask={newTask}
        setNewTask={setNewTask}
        initialTaskCategories={initialTaskCategories}
        contacts={availableContacts}
        properties={availableLocations}
        handleAddTask={handleAddTask}
      />

      {/* Tasks Accordion */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-brand-purple" />
            Task Categories ({getTotalTasks()} total tasks)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(taskCategories).map(([category, tasks]) => (
              <div key={category} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    {expandedCategories[category] ? (
                      <ChevronDown className="h-4 w-4 text-brand-mid-gray" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-brand-mid-gray" />
                    )}
                    <h3 className="font-medium text-brand-dark text-left flex-1 px-2">{category}</h3>
                    <span className="text-sm text-brand-mid-gray">({tasks.length} tasks)</span>
                  </div>
                </button>

                {/* Subtasks */}
                {expandedCategories[category] && (
                  <div className="border-t bg-gray-50">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-gray-100">
                            <th className="text-left py-2 px-4 font-medium text-brand-dark text-sm">Task Name</th>
                            <th className="text-left py-2 px-4 font-medium text-brand-dark text-sm">Contact</th>
                            <th className="text-left py-2 px-4 font-medium text-brand-dark text-sm">Requirements</th>
                            <th className="text-left py-2 px-4 font-medium text-brand-dark text-sm">Location</th>
                            <th className="text-center py-2 px-4 font-medium text-brand-dark text-sm">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tasks.map((task) => (
                            <tr key={task.id} className="border-b hover:bg-white">
                              <td className="py-2 px-4">
                                <div className="font-medium text-brand-dark text-sm">{task.name}</div>
                              </td>
                              <td className="py-2 px-4">
                                <div className="text-xs text-brand-mid-gray">{getContactName(task.contactId)}</div>
                              </td>
                              <td className="py-2 px-4">
                                <div className="text-xs text-brand-mid-gray max-w-xs">
                                  {task.requirements.length > 80 
                                    ? `${task.requirements.substring(0, 80)}...` 
                                    : task.requirements}
                                </div>
                              </td>
                              <td className="py-2 px-4">
                                <div className="text-xs text-brand-mid-gray">{getLocationName(task.locationId)}</div>
                              </td>
                              <td className="py-2 px-4 text-center">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => deleteTask(category, task.id)}
                                  className="hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden p-2 space-y-3">
                      {tasks.map((task) => (
                        <div key={task.id} className="bg-white rounded-lg p-3 border shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-brand-dark text-sm mb-2">{task.name}</h4>
                              <div className="space-y-1 text-xs text-brand-mid-gray">
                                <div><span className="font-medium">Contact:</span> {getContactName(task.contactId)}</div>
                                <div><span className="font-medium">Location:</span> {getLocationName(task.locationId)}</div>
                                <div className="pt-1">
                                  <span className="font-medium">Requirements:</span>
                                  <p className="mt-1 text-xs leading-relaxed">
                                    {task.requirements.length > 100 
                                      ? `${task.requirements.substring(0, 100)}...` 
                                      : task.requirements}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteTask(category, task.id)}
                              className="hover:bg-red-50 hover:border-red-300 hover:text-red-600 flex-shrink-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderContent = () => {
    switch (activeTab) {
      case 'prompt':
        return renderSystemPrompt()
      case 'tasks':
        return renderTasks()
      default:
        return renderSystemPrompt()
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-brand-dark">AI Prompt Configuration</h1>
        <p className="text-sm sm:text-base text-brand-mid-gray leading-relaxed">Configure how Ramble thinks about and handles all rules and interactions</p>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-brand-purple text-brand-purple'
                    : 'border-transparent text-brand-mid-gray hover:text-brand-dark hover:border-brand-mid-gray'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {renderContent()}
      </motion.div>
    </div>
  )
} 