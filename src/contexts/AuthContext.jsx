import { createContext, useContext, useState, useEffect } from 'react';
import apiService from '../services/api';
import { useNotification } from './NotificationContext';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { showError, showSuccess } = useNotification();

  // Check if user is authenticated on app startup
  useEffect(() => {
    const initAuth = async () => {
      if (apiService.isAuthenticated()) {
        try {
          const userData = await apiService.getCurrentUser();
          setUser(userData.user);
          setIsAuthenticated(true);
        } catch (error) {
          console.error('Failed to get current user:', error);
          // Token might be invalid, clear it
          apiService.clearTokens();
          setIsAuthenticated(false);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    try {
      setIsLoading(true);
      const response = await apiService.login(email, password);
      setUser(response.user);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      showError(error.message || 'Login failed');
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const register = async (userData) => {
    try {
      setIsLoading(true);
      const response = await apiService.register(userData);
      showSuccess(`User ${response.user.email} created successfully!`);
      return { success: true, user: response.user };
    } catch (error) {
      showError(error.message || 'Registration failed');
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (userData) => {
    try {
      setIsLoading(true);
      const response = await apiService.signup(userData);
      showSuccess('Account created successfully! Please check your email to verify your account.');
      return { success: true, user: response.user, message: response.message };
    } catch (error) {
      showError(error.message || 'Signup failed');
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const verifyEmail = async (token) => {
    try {
      setIsLoading(true);
      const response = await apiService.verifyEmail(token);
      showSuccess('Email verified successfully! You can now sign in.');
      return { success: true, user: response.user, message: response.message };
    } catch (error) {
      showError(error.message || 'Email verification failed');
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const resendVerification = async (email) => {
    try {
      setIsLoading(true);
      const response = await apiService.resendVerification(email);
      showSuccess('Verification email sent! Please check your inbox.');
      return { success: true, message: response.message };
    } catch (error) {
      showError(error.message || 'Failed to send verification email');
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await apiService.updateProfile(profileData);
      setUser(prev => ({ ...prev, ...response.user }));
      showSuccess('Profile updated successfully!');
      return { success: true };
    } catch (error) {
      showError(error.message || 'Profile update failed');
      return { success: false, error: error.message };
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await apiService.changePassword(currentPassword, newPassword);
      showSuccess('Password changed successfully!');
      return { success: true };
    } catch (error) {
      showError(error.message || 'Password change failed');
      return { success: false, error: error.message };
    }
  };

  // Helper functions
  const isAdmin = () => user?.role === 'admin';
  const isUser = () => user?.role === 'user';

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    register,
    signup,
    verifyEmail,
    resendVerification,
    updateProfile,
    changePassword,
    isAdmin,
    isUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 