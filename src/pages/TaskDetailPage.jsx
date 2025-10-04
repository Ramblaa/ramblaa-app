import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Send, Bot, BotOff, UserCircle, Users, User, MessageCircle, Clock, MapPin, Calendar } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { cn } from '../lib/utils'
import { useParams, useNavigate } from 'react-router-dom'
import { Switch } from '../components/ui/switch'

// Mock data restructured to group by person
const tasks = [
  {
    id: 1,
    title: 'Deliver fresh towels - Room 12',
    type: 'cleaning',
    property: 'Sunset Villa',
    assignee: 'Maria Garcia',
    dueDate: '2024-01-15',
    dueTime: '11:00 AM',
    status: 'pending',
    priority: 'high',
    description: 'Deep clean after guest checkout. Focus on kitchen and bathrooms.',
    conversations: [
      {
        id: 'sarah-johnson',
        personName: 'Sarah Johnson',
        personRole: 'Guest',
        personType: 'guest',
        lastActivity: '2:13 PM',
        autoResponseEnabled: true,
        messages: [
          { id: 1, text: 'Could I get some fresh towels delivered to the room?', sender: 'guest', senderName: 'Sarah Johnson', timestamp: '2:05 PM' },
          { id: 2, text: 'Of course! I\'ll arrange for fresh towels to be delivered within the hour.', sender: 'rambley', senderName: 'Ramble', timestamp: '2:06 PM' },
          { id: 3, text: 'Task created: Fresh towel delivery for Room 12. Assigned to Maria Garcia.', sender: 'rambley', senderName: 'Ramble', timestamp: '2:06 PM', isSystemMessage: true },
          { id: 4, text: 'Your fresh towels are on the way! Maria will deliver them within 15 minutes.', sender: 'rambley', senderName: 'Ramble', timestamp: '2:12 PM' },
          { id: 5, text: 'Great, thank you so much!', sender: 'guest', senderName: 'Sarah Johnson', timestamp: '2:13 PM' }
        ]
      },
      {
        id: 'maria-garcia',
        personName: 'Maria Garcia',
        personRole: 'Housekeeping Staff',
        personType: 'staff',
        lastActivity: '2:11 PM',
        autoResponseEnabled: false,
        messages: [
          { id: 6, text: 'Hi Maria! Guest in Room 12 needs fresh towels delivered ASAP. Can you handle this?', sender: 'rambley', senderName: 'Ramble', timestamp: '2:07 PM' },
          { id: 7, text: 'Sure! I\'m finishing up Room 8, will be there in 15 minutes.', sender: 'staff', senderName: 'Maria Garcia', timestamp: '2:10 PM' },
          { id: 8, text: 'Perfect, thank you Maria!', sender: 'rambley', senderName: 'Ramble', timestamp: '2:11 PM' }
        ]
      }
    ]
  },
  {
    id: 2,
    title: 'WiFi troubleshooting - Mountain Retreat',
    type: 'maintenance',
    property: 'Mountain Retreat',
    assignee: 'John Smith',
    dueDate: '2024-01-15',
    dueTime: '2:00 PM',
    status: 'in-progress',
    priority: 'medium',
    description: 'Guest reported WiFi password issues.',
    conversations: [
      {
        id: 'john-smith',
        personName: 'John Smith',
        personRole: 'Maintenance Technician',
        personType: 'staff',
        lastActivity: '2:15 PM',
        autoResponseEnabled: false,
        messages: [
          { id: 1, text: 'John, we have a WiFi issue at Mountain Retreat. Guest says the password isn\'t working.', sender: 'rambley', senderName: 'Ramble', timestamp: '1:35 PM' },
          { id: 2, text: 'I\'ll check the router remotely first, then head over if needed.', sender: 'staff', senderName: 'John Smith', timestamp: '1:40 PM' },
          { id: 3, text: 'Router looks fine. Password should be "MountainView2024". Let me verify the connection.', sender: 'staff', senderName: 'John Smith', timestamp: '2:15 PM' }
        ]
      },
      {
        id: 'mike-chen',
        personName: 'Mike Chen',
        personRole: 'Guest',
        personType: 'guest',
        lastActivity: '1:58 PM',
        autoResponseEnabled: true,
        messages: [
          { id: 4, text: 'Hi, I just checked in but the WiFi password isn\'t working', sender: 'guest', senderName: 'Mike Chen', timestamp: '1:55 PM' },
          { id: 5, text: 'Hi Mike! Let me help you with that. Try "MountainView2024" - make sure to include the capital letters. I\'ve also created a tech support task to verify the connection.', sender: 'rambley', senderName: 'Ramble', timestamp: '1:58 PM' },
          { id: 6, text: 'WiFi troubleshooting task created. Assigned to John Smith.', sender: 'rambley', senderName: 'Ramble', timestamp: '1:58 PM', isSystemMessage: true }
        ]
      }
    ]
  },
  {
    id: 3,
    title: 'Fix dripping bathroom faucet - Beach House',
    type: 'maintenance',
    property: 'Beach House',
    assignee: 'John Smith',
    dueDate: '2024-01-16',
    dueTime: '10:00 AM',
    status: 'pending',
    priority: 'medium',
    description: 'Guest reported dripping faucet in bathroom.',
    conversations: [
      {
        id: 'john-smith-2',
        personName: 'John Smith',
        personRole: 'Maintenance Technician',
        personType: 'staff',
        lastActivity: '12:52 PM',
        autoResponseEnabled: false,
        messages: [
          { id: 1, text: 'John, we have a dripping faucet at Beach House bathroom. Guest reported it during checkout.', sender: 'rambley', senderName: 'Ramble', timestamp: '12:51 PM' },
          { id: 2, text: 'Got it. I can take a look tomorrow morning. Probably just needs a new washer.', sender: 'staff', senderName: 'John Smith', timestamp: '12:52 PM' }
        ]
      },
      {
        id: 'emma-rodriguez',
        personName: 'Emma Rodriguez',
        personRole: 'Guest',
        personType: 'guest',
        lastActivity: '12:50 PM',
        autoResponseEnabled: false,
        messages: [
          { id: 3, text: 'Hi! We had a wonderful stay. Just wanted to let you know we\'ve checked out and left the keys on the counter.', sender: 'guest', senderName: 'Emma Rodriguez', timestamp: '12:30 PM' },
          { id: 4, text: 'Thank you Emma! So glad you enjoyed your stay. Hope to host you again soon!', sender: 'rambley', senderName: 'Ramble', timestamp: '12:32 PM' },
          { id: 5, text: 'Actually, we noticed the bathroom faucet was dripping. Thought you should know.', sender: 'guest', senderName: 'Emma Rodriguez', timestamp: '12:45 PM' },
          { id: 6, text: 'Thanks for letting us know! I\'ve logged this for our maintenance team.', sender: 'rambley', senderName: 'Ramble', timestamp: '12:50 PM' },
          { id: 7, text: 'Maintenance task created: Fix dripping bathroom faucet. Assigned to John Smith.', sender: 'rambley', senderName: 'Ramble', timestamp: '12:50 PM', isSystemMessage: true }
        ]
      }
    ]
  },
  {
    id: 4,
    title: 'Post-checkout inspection - Beach House',
    type: 'inspection',
    property: 'Beach House',
    assignee: 'Sarah Wilson',
    dueDate: '2024-01-16',
    dueTime: '2:00 PM',
    status: 'completed',
    priority: 'low',
    description: 'Routine post-checkout property inspection.',
    conversations: [
      {
        id: 'sarah-wilson',
        personName: 'Sarah Wilson',
        personRole: 'Property Inspector',
        personType: 'staff',
        lastActivity: '12:51 PM',
        autoResponseEnabled: false,
        messages: [
          { id: 1, text: 'Sarah, we need a post-checkout inspection at Beach House tomorrow. Guest checked out this morning.', sender: 'rambley', senderName: 'Ramble', timestamp: '12:50 PM' },
          { id: 2, text: 'Sure thing! I\'ll do the inspection tomorrow afternoon after the maintenance work is done.', sender: 'staff', senderName: 'Sarah Wilson', timestamp: '12:51 PM' },
          { id: 3, text: 'Inspection task created: Post-checkout inspection. Assigned to Sarah Wilson.', sender: 'rambley', senderName: 'Ramble', timestamp: '12:51 PM', isSystemMessage: true }
        ]
      }
    ]
  }
]

const typeIcons = {
  cleaning: 'bg-blue-100 text-blue-600',
  maintenance: 'bg-orange-100 text-orange-600',
  inspection: 'bg-green-100 text-green-600',
  restocking: 'bg-purple-100 text-purple-600',
}

const senderIcons = {
  guest: UserCircle,
  host: User,
  rambley: Bot,
  staff: Users,
}

const senderColors = {
  guest: 'bg-blue-100 text-blue-600',
  rambley: 'bg-purple-100 text-purple-600',
  staff: 'bg-orange-100 text-orange-600',
}

export default function TaskDetailPage() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [newMessage, setNewMessage] = useState('')
  const [conversationStates, setConversationStates] = useState({})

  const task = tasks.find(t => t.id === parseInt(taskId))
  
  if (!task) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="text-center">
          <h2 className="text-lg font-medium text-brand-dark">Task not found</h2>
          <p className="text-brand-mid-gray">The requested task could not be found.</p>
        </div>
      </div>
    )
  }

  // Sort conversations by latest activity (most recent first)
  const sortedConversations = [...task.conversations].sort((a, b) => {
    const timeToMinutes = (time) => {
      const [timeStr, period] = time.split(' ')
      const [hours, minutes] = timeStr.split(':').map(Number)
      return (period === 'PM' && hours !== 12 ? hours + 12 : hours) * 60 + minutes
    }
    return timeToMinutes(b.lastActivity) - timeToMinutes(a.lastActivity)
  })

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedConversation) return
    
    // When sending a message, disable auto-response for this conversation
    setConversationStates(prev => ({
      ...prev,
      [selectedConversation.id]: {
        ...prev[selectedConversation.id],
        autoResponseEnabled: false
      }
    }))
    
    // In real app, this would send the message via API
    console.log('Sending message:', newMessage, 'to conversation:', selectedConversation.id)
    setNewMessage('')
  }

  const toggleAutoResponse = () => {
    if (!selectedConversation) return
    
    setConversationStates(prev => ({
      ...prev,
      [selectedConversation.id]: {
        ...prev[selectedConversation.id],
        autoResponseEnabled: !getAutoResponseState()
      }
    }))
  }

  const getAutoResponseState = () => {
    if (!selectedConversation) return false
    return conversationStates[selectedConversation.id]?.autoResponseEnabled ?? selectedConversation.autoResponseEnabled
  }

  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return { color: 'bg-yellow-100 text-yellow-700', label: 'Pending' }
      case 'in-progress':
        return { color: 'bg-blue-100 text-blue-700', label: 'In Progress' }
      case 'completed':
        return { color: 'bg-green-100 text-green-700', label: 'Completed' }
      default:
        return { color: 'bg-gray-100 text-gray-700', label: 'Unknown' }
    }
  }

  const statusInfo = getStatusInfo(task.status)
  const isAutoResponseEnabled = getAutoResponseState()

  return (
    <div className="h-full flex">
      {/* Conversations Sidebar */}
      <div className={cn(
        "w-full lg:w-96 border-r bg-background",
        selectedConversation ? "hidden lg:block" : "block"
      )}>
        {/* Task Header */}
        <div className="p-6 border-b">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div className="flex items-start gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              typeIcons[task.type]
            )}>
              <MessageCircle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-lg font-bold text-brand-dark">{task.title}</h1>
                <Badge className={`text-xs ${statusInfo.color}`}>
                  {statusInfo.label}
                </Badge>
              </div>
              <p className="text-sm text-brand-mid-gray mt-1">{task.description}</p>
              
              <div className="flex flex-wrap gap-3 text-xs text-brand-mid-gray mt-2">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>{task.property}</span>
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>{task.assignee}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{task.dueDate} at {task.dueTime}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Conversations List */}
        <div className="overflow-y-auto">
          <div className="p-4">
            <h2 className="text-sm font-medium text-brand-dark mb-3">Task Communications</h2>
          </div>
          
          {sortedConversations.map((conversation) => {
            const lastMessage = conversation.messages[conversation.messages.length - 1]
            
            // Generate initials from person name
            const getInitials = (name) => {
              const names = name.split(' ')
              if (names.length >= 2) {
                return `${names[0][0]}${names[1][0]}`.toUpperCase()
              }
              return name.substring(0, 2).toUpperCase()
            }
            
            // Get avatar background color based on person type
            const getAvatarColor = (personType) => {
              switch (personType) {
                case 'guest':
                  return 'bg-brand-vanilla text-brand-dark'
                case 'staff':
                  return 'bg-brand-dark text-brand-vanilla'
                default:
                  return 'bg-brand-dark text-brand-vanilla'
              }
            }
            
            return (
              <motion.div
                key={conversation.id}
                whileHover={{ backgroundColor: 'rgba(154, 23, 80, 0.05)' }}
                className={cn(
                  "p-4 border-b cursor-pointer transition-colors",
                  selectedConversation?.id === conversation.id ? "bg-brand-purple/10 border-brand-purple/20" : ""
                )}
                onClick={() => setSelectedConversation(conversation)}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-medium text-sm",
                    getAvatarColor(conversation.personType)
                  )}>
                    {getInitials(conversation.personName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-brand-dark text-sm">{conversation.personName}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {conversation.personRole}
                      </Badge>
                    </div>
                    <p className="text-sm text-brand-mid-gray truncate">
                      {lastMessage.senderName}: {lastMessage.text}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-brand-mid-gray">{conversation.lastActivity}</p>
                      <Badge variant="outline" className="text-xs">
                        {conversation.messages.length}
                      </Badge>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Conversation Messages View */}
      <div className={cn(
        "flex-1 flex flex-col",
        !selectedConversation ? "hidden lg:flex" : "flex"
      )}>
        {selectedConversation ? (
          <>
            {/* Desktop Chat Header */}
            <div className="hidden lg:flex items-center justify-between p-4 border-b bg-background">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-vanilla text-brand-dark rounded-full flex items-center justify-center font-medium text-sm">
                  {selectedConversation.personName.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h2 className="font-semibold text-brand-dark">{selectedConversation.personName}</h2>
                  <p className="text-sm text-brand-mid-gray">{selectedConversation.personRole}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-brand-dark">Auto Response</span>
                  <Switch
                    checked={isAutoResponseEnabled}
                    onCheckedChange={toggleAutoResponse}
                  />
                  <span className={cn(
                    "text-xs font-medium",
                    isAutoResponseEnabled ? "text-brand-purple" : "text-brand-mid-gray"
                  )}>
                    {isAutoResponseEnabled ? "ON" : "OFF"}
                  </span>
                  {isAutoResponseEnabled ? (
                    <Bot className="h-4 w-4 text-brand-purple" />
                  ) : (
                    <BotOff className="h-4 w-4 text-brand-mid-gray" />
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Chat Header */}
            <div className="flex items-center justify-between p-4 border-b bg-background lg:hidden">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedConversation(null)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-brand-purple rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-white">
                    {selectedConversation.personName.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <h2 className="font-medium text-brand-dark">{selectedConversation.personName}</h2>
                  <p className="text-xs text-brand-mid-gray">{selectedConversation.personRole}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={isAutoResponseEnabled}
                  onCheckedChange={toggleAutoResponse}
                />
                <span className={cn(
                  "text-xs font-medium",
                  isAutoResponseEnabled ? "text-brand-purple" : "text-brand-mid-gray"
                )}>
                  {isAutoResponseEnabled ? "ON" : "OFF"}
                </span>
                {isAutoResponseEnabled ? (
                  <Bot className="h-4 w-4 text-brand-purple" />
                ) : (
                  <BotOff className="h-4 w-4 text-brand-mid-gray" />
                )}
              </div>
            </div>

            {/* Messages Container - with bottom padding for fixed input */}
            <div className="flex-1 overflow-y-auto pb-20 lg:pb-0">
              <div className="p-4 space-y-4">
                <AnimatePresence>
                  {selectedConversation.messages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={cn(
                      "flex",
                      // Guest messages and contact messages (like Maria) on left, Ramble/host on right
                      message.sender === 'guest' || (message.sender !== 'guest' && message.sender !== 'rambley' && message.sender !== 'host') 
                        ? "justify-start" 
                        : "justify-end",
                      message.isSystemMessage && "opacity-60 justify-center"
                    )}
                  >
                    {message.isSystemMessage ? (
                      <div className="bg-gray-100 text-gray-600 italic text-sm px-3 py-2 rounded-lg max-w-md text-center">
                        {message.text}
                      </div>
                    ) : (
                      <div className={cn(
                        "max-w-[85%] sm:max-w-xs lg:max-w-md",
                        // Guest messages and contact messages (like Maria) on left, Ramble/host on right
                        message.sender === 'guest' || (message.sender !== 'guest' && message.sender !== 'rambley' && message.sender !== 'host')
                          ? "mr-4 sm:mr-12" 
                          : "ml-4 sm:ml-12"
                      )}>
                        {/* Sender badge for non-guest messages */}
                        {message.sender !== 'guest' && (message.sender === 'rambley' || message.sender === 'host') && (
                          <div className={cn(
                            "flex mb-1",
                            // Contact messages (like Maria) show badge on left, Ramble/host on right
                            message.sender !== 'rambley' && message.sender !== 'host'
                              ? "justify-start"
                              : "justify-end"
                          )}>
                            <div className="flex items-center gap-1 text-xs text-brand-mid-gray">
                              {message.sender === 'rambley' ? (
                                <>
                                  <Bot className="h-3 w-3" />
                                  <span>Ramble</span>
                                </>
                              ) : message.sender === 'host' ? (
                                <>
                                  <User className="h-3 w-3" />
                                  <span>Host</span>
                                </>
                              ) : (
                                <>
                                  <User className="h-3 w-3" />
                                  <span>{message.senderName || 'Contact'}</span>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                        <div className={cn(
                          "px-4 py-2 rounded-lg",
                          message.sender === 'guest'
                            ? "bg-brand-vanilla text-brand-dark" // Guest messages on left
                            : message.sender === 'rambley' || message.sender === 'host'
                              ? "bg-brand-purple text-white" // Ramble and Host messages on right (purple)
                              : "bg-brand-dark text-brand-vanilla" // Contact messages on left (dark background, vanilla text)
                        )}>
                          <p className="text-sm">{message.text}</p>
                          <p className={cn(
                            "text-xs mt-1",
                            message.sender === 'guest'
                              ? "text-brand-mid-gray" // Guest timestamp
                              : message.sender === 'rambley' || message.sender === 'host'
                                ? "text-white/70" // Ramble and Host timestamps
                                : "text-brand-vanilla/70" // Contact timestamp
                          )}>
                            {message.timestamp}
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
                </AnimatePresence>  
              </div>
            </div>

            {/* Message Input - Fixed on mobile, normal on desktop */}
            <div className="fixed bottom-0 left-0 right-0 lg:relative lg:bottom-auto lg:left-auto lg:right-auto p-4 border-t bg-background z-20 safe-area-inset-bottom">
              {!isAutoResponseEnabled && (
                <div className="mb-3 p-2 bg-brand-vanilla/50 rounded-lg border border-brand-vanilla">
                  <div className="flex items-center gap-2 text-sm text-brand-dark">
                    <BotOff className="h-4 w-4" />
                    <span>Auto-response is disabled. You're in manual mode for this conversation.</span>
                  </div>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Message ${selectedConversation.personName}...`}
                  className="flex-1"
                />
                <Button type="submit" size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-brand-light/50">
            <div className="text-center">
              <MessageCircle className="mx-auto h-12 w-12 text-brand-mid-gray mb-4" />
              <h3 className="text-lg font-medium text-brand-dark mb-2">Select a conversation</h3>
              <p className="text-brand-mid-gray">Choose a person to view your communication with them</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 