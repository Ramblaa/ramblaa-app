const API_BASE_URL = 'http://localhost:3001/api';

// Get auth token from localStorage
const getAuthToken = () => {
  const token = localStorage.getItem('accessToken');
  if (!token) {
    throw new Error('No authentication token found');
  }
  return token;
};

// Common headers for API requests
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`,
});

// Initialize a new sandbox session
export const initializeSandboxSession = async (sessionData) => {
  const response = await fetch(`${API_BASE_URL}/sandbox/initialize`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(sessionData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to initialize sandbox session');
  }

  return response.json();
};

// Get all sandbox sessions
export const getSandboxSessions = async (activeOnly = true) => {
  const response = await fetch(`${API_BASE_URL}/sandbox/sessions?active_only=${activeOnly}`, {
    method: 'GET',
    headers: getHeaders()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch sandbox sessions');
  }

  return response.json();
};

// Get specific sandbox session details
export const getSandboxSession = async (sessionId) => {
  const response = await fetch(`${API_BASE_URL}/sandbox/session/${sessionId}`, {
    method: 'GET',
    headers: getHeaders()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch sandbox session');
  }

  return response.json();
};

// Send a message in sandbox
export const sendSandboxMessage = async (sessionId, messageData) => {
  const response = await fetch(`${API_BASE_URL}/sandbox/message`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      session_id: sessionId,
      ...messageData
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send sandbox message');
  }

  return response.json();
};

// Trigger AI processing for a session
export const processSandboxSession = async (sessionId) => {
  const response = await fetch(`${API_BASE_URL}/sandbox/process`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      session_id: sessionId
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to process sandbox session');
  }

  return response.json();
};

// Delete/deactivate a sandbox session
export const deleteSandboxSession = async (sessionId) => {
  const response = await fetch(`${API_BASE_URL}/sandbox/session/${sessionId}`, {
    method: 'DELETE',
    headers: getHeaders()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete sandbox session');
  }

  return response.json();
};

// Get properties for scenario setup
export const getSandboxProperties = async () => {
  const response = await fetch(`${API_BASE_URL}/sandbox/properties`, {
    method: 'GET',
    headers: getHeaders()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch properties');
  }

  return response.json();
};