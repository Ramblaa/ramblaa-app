import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Clock, MapPin, User, Plus, Wrench, Brush, Search, Package, MessageCircle, Check, Trash2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { cn } from '../lib/utils'
import { useNavigate } from 'react-router-dom'

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Fetch tasks from API
const fetchTasks = async () => {
  try {
    const token = localStorage.getItem('authToken')
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    }

    // Fetch sandbox tasks directly from the tasks endpoint
    const response = await fetch(`${API_BASE_URL}/sandbox/tasks`, { headers })

    if (response.ok) {
      const data = await response.json()
      const tasks = data.tasks.map(task => ({
        id: task.id,
        title: task.title || 'Untitled Task',
        type: task.type || task.task_type || 'general',
        assignee: task.assignee || task.assignee_name || 'Unassigned',
        dueDate: task.due_date || (task.created_at ? new Date(task.created_at).toISOString().split('T')[0] : null),
        dueTime: task.due_time || '09:00',
        status: task.status || 'pending',
        priority: task.priority || 'medium',
        property: task.property || 'Unknown Property',
        guest: task.guest_name || 'Unknown Guest',
        source: 'sandbox'
      }))
      return tasks
    }

    console.error('Failed to fetch tasks:', response.status, response.statusText)
    return []
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return []
  }
}

// Update task status via API
const updateTaskStatus = async (taskId, status, source = 'sandbox') => {
  try {
    const token = localStorage.getItem('authToken')
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    }

    if (source === 'sandbox') {
      const response = await fetch(`${API_BASE_URL}/sandbox/tasks/${taskId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status })
      })
      return response.ok
    }
    return false
  } catch (error) {
    console.error('Error updating task:', error)
    return false
  }
}

// Complete task via API
const completeTask = async (taskId, source = 'sandbox') => {
  try {
    const token = localStorage.getItem('authToken')
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    }

    if (source === 'sandbox') {
      const response = await fetch(`${API_BASE_URL}/sandbox/tasks/${taskId}/complete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({})
      })
      return response.ok
    }
    return false
  } catch (error) {
    console.error('Error completing task:', error)
    return false
  }
}

const statusColors = {
  pending: 'warning',
  'in-progress': 'default',
  completed: 'success',
}

const priorityColors = {
  low: 'secondary',
  medium: 'warning',
  high: 'destructive',
}

const typeIcons = {
  cleaning: Brush,
  maintenance: Wrench,
  inspection: Search,
  restocking: Package,
}

export default function TasksPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [propertyFilter, setPropertyFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch tasks on component mount
  useEffect(() => {
    let mounted = true // Prevent state updates on unmounted component

    const loadTasks = async () => {
      setLoading(true)
      setError(null)
      try {
        const fetchedTasks = await fetchTasks()
        if (mounted) {
          setTasks(fetchedTasks)
        }
      } catch (err) {
        if (mounted) {
          setError('Failed to load tasks')
          console.error('Error loading tasks:', err)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadTasks()

    return () => {
      mounted = false
    }
  }, [])

  // Refresh tasks function
  const refreshTasks = async () => {
    const fetchedTasks = await fetchTasks()
    setTasks(fetchedTasks)
  }

  // Get unique properties for the filter dropdown
  const properties = [...new Set(tasks.map(task => task.property))].sort()

  const filteredTasks = tasks.filter(task => {
    // Status filter
    const statusMatch = filter === 'all' ||
      (filter === 'upcoming' && task.status !== 'completed') ||
      (filter === 'completed' && task.status === 'completed') ||
      task.status === filter

    // Property filter
    const propertyMatch = propertyFilter === 'all' || task.property === propertyFilter

    // Search filter
    const searchMatch = !searchTerm.trim() ||
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.property.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.assignee.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.type.toLowerCase().includes(searchTerm.toLowerCase())

    return statusMatch && propertyMatch && searchMatch
  })

  const getTaskCounts = (property = 'all') => {
    const tasksToCount = property === 'all' ? tasks : tasks.filter(t => t.property === property)
    return {
      pending: tasksToCount.filter(t => t.status === 'pending').length,
      inProgress: tasksToCount.filter(t => t.status === 'in-progress').length,
      completed: tasksToCount.filter(t => t.status === 'completed').length,
      highPriority: tasksToCount.filter(t => t.priority === 'high').length,
    }
  }

  const counts = getTaskCounts(propertyFilter)

  const handleMarkComplete = async (e, taskId) => {
    e.stopPropagation()
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const success = await completeTask(taskId, task.source)
    if (success) {
      // Update local state immediately for better UX
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, status: 'completed' } : t
      ))
      // Refresh from server to ensure consistency
      setTimeout(refreshTasks, 500)
    } else {
      setError('Failed to mark task as complete')
    }
  }

  const handleDeleteTask = (e, taskId) => {
    e.stopPropagation()
    // Delete functionality could be added later
    console.log('Deleting task:', taskId)
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-brand-dark">Tasks</h1>
          <p className="text-sm sm:text-base text-brand-mid-gray">Manage cleaning, maintenance, and property tasks</p>
        </div>
        <Button className="sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4">
        {/* Status Filters */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'All Tasks', count: tasks.length },
            { key: 'upcoming', label: 'Upcoming', count: tasks.filter(t => t.status !== 'completed').length },
            { key: 'pending', label: 'Pending', count: counts.pending },
            { key: 'in-progress', label: 'In Progress', count: counts.inProgress },
            { key: 'completed', label: 'Completed', count: counts.completed }
          ].map((filterOption) => (
            <Button
              key={filterOption.key}
              variant={filter === filterOption.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(filterOption.key)}
              className="capitalize text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">{filterOption.label}</span>
              <span className="sm:hidden">
                {filterOption.key === 'in-progress' ? 'Progress' : filterOption.label.split(' ')[0]}
              </span>
              <Badge 
                variant="secondary" 
                className={cn(
                  "ml-1 sm:ml-2 text-xs pointer-events-none",
                  filter === filterOption.key 
                    ? "bg-white/20 text-white" 
                    : "bg-brand-mid-gray/10 text-brand-mid-gray"
                )}
              >
                {filterOption.count}
              </Badge>
            </Button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          {/* Property Filter */}
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="h-4 w-4 text-brand-mid-gray flex-shrink-0" />
            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="h-9 flex-1 sm:w-[200px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple focus:ring-offset-2"
            >
              <option value="all">All Properties</option>
              {properties.map((property) => (
                <option key={property} value={property}>
                  {property}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Search className="h-4 w-4 text-brand-mid-gray flex-shrink-0" />
            <Input 
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-0"
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshTasks}
            className="mt-2"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-6">
              <div className="animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Tasks List */}
          <div className="space-y-4">
            {filteredTasks.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-brand-mid-gray">No tasks found matching your criteria.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshTasks}
                  className="mt-2"
                >
                  Refresh Tasks
                </Button>
              </Card>
            ) : (
              filteredTasks.map((task, index) => {
          const IconComponent = typeIcons[task.type]
          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className={cn(
                  "transition-all hover:shadow-md cursor-pointer",
                  task.status === 'completed' ? 'opacity-75' : ''
                )}
                onClick={() => navigate(`/tasks/${task.id}`)}
              >
                <div className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-brand-vanilla rounded-full flex items-center justify-center">
                          <IconComponent className="h-4 w-4 text-brand-purple" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-brand-dark">{task.title}</h3>
                          <p className="text-sm text-brand-mid-gray mt-1">{task.description}</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-brand-mid-gray">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          <span>{task.property}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          <span>{task.assignee}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{task.dueDate} at {task.dueTime}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageCircle className="h-4 w-4" />
                          <span>{task.threadCount} thread{task.threadCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:items-end gap-2">
                      <div className="flex gap-2">
                        <Badge variant={statusColors[task.status]}>
                          {task.status.replace('-', ' ')}
                        </Badge>
                        <Badge variant={priorityColors[task.priority]}>
                          {task.priority} priority
                        </Badge>
                      </div>
                      
                      <div className="flex gap-2">
                        {task.status !== 'completed' && (
                          <Button 
                            size="icon" 
                            variant="outline"
                            onClick={(e) => handleMarkComplete(e, task.id)}
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          size="icon" 
                          variant="outline"
                          onClick={(e) => handleDeleteTask(e, task.id)}
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )
            })
          )}
        </div>
        </>
      )}
    </div>
  )
} 