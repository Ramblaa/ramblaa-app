import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Eye,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  Search,
  MapPin,
  Loader2,
  RefreshCw
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { cn } from '../lib/utils'
import { useNavigate } from 'react-router-dom'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export default function EscalationsPage() {
  const navigate = useNavigate()
  const [escalations, setEscalations] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [propertyFilter, setPropertyFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Fetch escalations
  const fetchEscalations = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (selectedFilter !== 'all') {
        params.append('status', selectedFilter)
      }
      if (propertyFilter !== 'all') {
        params.append('propertyId', propertyFilter)
      }

      const response = await fetch(`${API_BASE_URL}/escalations?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch escalations')
      }

      const data = await response.json()
      setEscalations(data)
    } catch (err) {
      console.error('Error fetching escalations:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Fetch properties for filter
  const fetchProperties = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/properties`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setProperties(data)
      }
    } catch (err) {
      console.error('Error fetching properties:', err)
    }
  }

  useEffect(() => {
    fetchEscalations()
    fetchProperties()
  }, [selectedFilter, propertyFilter])

  const getStatusInfo = (status) => {
    switch (status) {
      case 'open':
        return { color: 'bg-red-100 text-red-700', label: 'Open', icon: AlertCircle }
      case 'acknowledged':
        return { color: 'bg-blue-100 text-blue-700', label: 'Acknowledged', icon: Eye }
      case 'in_progress':
        return { color: 'bg-yellow-100 text-yellow-700', label: 'In Progress', icon: Clock }
      case 'resolved':
        return { color: 'bg-green-100 text-green-700', label: 'Resolved', icon: CheckCircle }
      default:
        return { color: 'bg-gray-100 text-gray-700', label: status || 'Unknown', icon: AlertCircle }
    }
  }

  const getPriorityInfo = (priority) => {
    switch (priority) {
      case 'critical':
        return { color: 'border-red-500 bg-red-50', badge: 'bg-red-500 text-white' }
      case 'high':
        return { color: 'border-orange-500 bg-orange-50', badge: 'bg-orange-500 text-white' }
      case 'medium':
        return { color: 'border-yellow-500 bg-yellow-50', badge: 'bg-yellow-500 text-white' }
      case 'low':
        return { color: 'border-green-500 bg-green-50', badge: 'bg-green-500 text-white' }
      default:
        return { color: 'border-gray-500 bg-gray-50', badge: 'bg-gray-500 text-white' }
    }
  }

  const getRiskLabel = (riskIndicator) => {
    const labels = {
      'LegalThreat': 'Legal Threat',
      'SafetyRisk': 'Safety Risk',
      'ChurnRisk': 'Churn Risk',
      'PublicComplaint': 'Public Complaint',
      'HighImpact': 'High Impact',
    }
    return labels[riskIndicator] || riskIndicator || 'Task Escalation'
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  // Handle resolve action
  const handleResolve = async (escalationId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/escalations/${escalationId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({ resolutionNotes: 'Resolved via dashboard' }),
      })

      if (response.ok) {
        // Refresh the list
        fetchEscalations()
      }
    } catch (err) {
      console.error('Error resolving escalation:', err)
    }
  }

  // Handle acknowledge action
  const handleAcknowledge = async (escalationId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/escalations/${escalationId}/acknowledge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      })

      if (response.ok) {
        fetchEscalations()
      }
    } catch (err) {
      console.error('Error acknowledging escalation:', err)
    }
  }

  // Filter escalations by search term
  const filteredEscalations = escalations.filter(escalation => {
    if (!searchTerm.trim()) return true
    const search = searchTerm.toLowerCase()
    return (
      (escalation.reason?.toLowerCase().includes(search)) ||
      (escalation.originalMessage?.toLowerCase().includes(search)) ||
      (escalation.guestName?.toLowerCase().includes(search)) ||
      (escalation.propertyName?.toLowerCase().includes(search)) ||
      (escalation.riskIndicator?.toLowerCase().includes(search))
    )
  })

  // Count escalations by status
  const counts = {
    all: escalations.length,
    open: escalations.filter(e => e.status === 'open').length,
    acknowledged: escalations.filter(e => e.status === 'acknowledged').length,
    in_progress: escalations.filter(e => e.status === 'in_progress').length,
    resolved: escalations.filter(e => e.status === 'resolved').length,
  }

  if (loading && escalations.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-brand-purple mb-4" />
          <p className="text-brand-mid-gray">Loading escalations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-4 sm:space-y-6"
      >
        {/* Header */}
        <div className="flex justify-between items-start sm:items-center">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-brand-dark">Escalations</h1>
            <p className="text-sm sm:text-base text-brand-mid-gray">Monitor and manage escalated issues requiring your attention</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchEscalations}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Error State */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <p className="text-red-700">{error}</p>
              <Button size="sm" variant="outline" onClick={fetchEscalations}>
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Filters and Search */}
        <div className="flex flex-col gap-4">
          {/* Status Filters */}
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'All Escalations', count: counts.all },
              { key: 'open', label: 'Open', count: counts.open },
              { key: 'acknowledged', label: 'Acknowledged', count: counts.acknowledged },
              { key: 'in_progress', label: 'In Progress', count: counts.in_progress },
              { key: 'resolved', label: 'Resolved', count: counts.resolved }
            ].map((filterOption) => (
              <Button
                key={filterOption.key}
                variant={selectedFilter === filterOption.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedFilter(filterOption.key)}
                className="capitalize text-xs sm:text-sm"
              >
                <span className="hidden sm:inline">{filterOption.label}</span>
                <span className="sm:hidden">{filterOption.label.split(' ')[0]}</span>
                <Badge
                  variant="secondary"
                  className={cn(
                    "ml-1 sm:ml-2 text-xs pointer-events-none",
                    selectedFilter === filterOption.key
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
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Search className="h-4 w-4 text-brand-mid-gray flex-shrink-0" />
              <Input
                placeholder="Search escalations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 min-w-0"
              />
            </div>
          </div>
        </div>

        {/* Escalations List */}
        <div className="space-y-4">
          {filteredEscalations.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertTriangle className="mx-auto h-12 w-12 text-brand-mid-gray mb-4" />
                <h3 className="text-lg font-medium text-brand-dark mb-2">No escalations found</h3>
                <p className="text-brand-mid-gray">
                  {searchTerm ? `No results for "${searchTerm}"` : 'No escalations match your current filters.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredEscalations.map((escalation) => {
              const statusInfo = getStatusInfo(escalation.status)
              const priorityInfo = getPriorityInfo(escalation.priority)
              const StatusIcon = statusInfo.icon

              return (
                <Card key={escalation.id} className={`border-l-4 ${priorityInfo.color}`}>
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                          <h3 className="text-base sm:text-lg font-semibold text-brand-dark pr-2">
                            {getRiskLabel(escalation.riskIndicator)}
                          </h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={`text-xs ${priorityInfo.badge}`}>
                              {(escalation.priority || 'medium').toUpperCase()}
                            </Badge>
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                              <StatusIcon className="h-3 w-3" />
                              {statusInfo.label}
                            </div>
                            {escalation.triggerType === 'message_risk' && (
                              <Badge variant="outline" className="text-xs">
                                Message Risk
                              </Badge>
                            )}
                            {escalation.triggerType === 'task_triage' && (
                              <Badge variant="outline" className="text-xs">
                                Task Triage
                              </Badge>
                            )}
                          </div>
                        </div>

                        {escalation.reason && (
                          <p className="text-brand-mid-gray mb-2 text-sm sm:text-base">{escalation.reason}</p>
                        )}

                        {escalation.originalMessage && (
                          <div className="bg-gray-50 rounded-lg p-3 mb-4">
                            <Label className="text-xs text-brand-mid-gray mb-1 block">Original Message</Label>
                            <p className="text-sm text-brand-dark italic">"{escalation.originalMessage}"</p>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 text-sm">
                          {escalation.propertyName && (
                            <div>
                              <Label className="text-xs text-brand-mid-gray">Property</Label>
                              <p className="font-medium truncate">{escalation.propertyName}</p>
                            </div>
                          )}
                          {escalation.guestName && (
                            <div>
                              <Label className="text-xs text-brand-mid-gray">Guest</Label>
                              <p className="font-medium truncate">{escalation.guestName}</p>
                            </div>
                          )}
                          {escalation.guestPhone && (
                            <div>
                              <Label className="text-xs text-brand-mid-gray">Phone</Label>
                              <p className="font-medium truncate">{escalation.guestPhone}</p>
                            </div>
                          )}
                          <div>
                            <Label className="text-xs text-brand-mid-gray">Created</Label>
                            <p className="font-medium text-xs sm:text-sm">{formatDate(escalation.createdAt)}</p>
                          </div>
                          {escalation.hostNotified && (
                            <div>
                              <Label className="text-xs text-brand-mid-gray">Host Notified</Label>
                              <p className="font-medium text-green-600 text-xs sm:text-sm">
                                {formatDate(escalation.hostNotifiedAt) || 'Yes'}
                              </p>
                            </div>
                          )}
                        </div>

                        {escalation.resolvedAt && (
                          <div className="mt-3 text-sm">
                            <Label className="text-xs text-brand-mid-gray">Resolved</Label>
                            <p className="font-medium text-green-600 text-xs sm:text-sm">{formatDate(escalation.resolvedAt)}</p>
                            {escalation.resolutionNotes && (
                              <p className="text-brand-mid-gray text-xs mt-1">{escalation.resolutionNotes}</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex sm:flex-col gap-2 sm:ml-4 self-start">
                        {escalation.status === 'open' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAcknowledge(escalation.id)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Acknowledge
                          </Button>
                        )}
                        {escalation.status !== 'resolved' && (
                          <Button
                            size="sm"
                            onClick={() => handleResolve(escalation.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Resolve
                          </Button>
                        )}
                        {escalation.taskId && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/tasks/${escalation.taskId}`)}
                          >
                            View Task
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </motion.div>
    </div>
  )
}
