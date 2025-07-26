import React, { useState, useEffect, createContext, useContext, ReactNode, useRef, useCallback } from 'react';
import { apiClient } from '@/services/api-client';
import { createStudioLogger } from '@/utils/logger';
import type { User } from '@/types';

const logger = createStudioLogger('useAuth');

// Session configuration
const SESSION_CONFIG = {
  // Auto-refresh token 5 minutes before expiry
  REFRESH_BUFFER_MS: 5 * 60 * 1000,
  // Warn user 10 minutes before expiry
  WARNING_BUFFER_MS: 10 * 60 * 1000,
  // Check session every 30 seconds
  CHECK_INTERVAL_MS: 30 * 1000,
  // Session timeout for content management (2 hours)
  DEFAULT_TIMEOUT_MS: 2 * 60 * 60 * 1000,
  // Extended session for "Remember Me" (7 days)
  EXTENDED_TIMEOUT_MS: 7 * 24 * 60 * 60 * 1000,
  // Inactivity timeout (30 minutes)
  INACTIVITY_TIMEOUT_MS: 30 * 60 * 1000
};

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  sessionExpiresAt: Date | null;
  showTimeoutWarning: boolean;
  lastActivity: Date;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshSession: () => Promise<void>;
  dismissTimeoutWarning: () => void;
  updateActivity: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    refreshToken: null,
    isLoading: true,
    sessionExpiresAt: null,
    showTimeoutWarning: false,
    lastActivity: new Date()
  });

  const sessionCheckRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityCheckRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);

  // Track user activity for inactivity detection
  const updateActivity = useCallback(() => {
    setAuthState(prev => ({ ...prev, lastActivity: new Date() }));
  }, []);

  // Auto-refresh session before expiry
  const refreshSession = useCallback(async () => {
    if (isRefreshingRef.current || !authState.refreshToken) {
      return;
    }

    try {
      isRefreshingRef.current = true;
      logger.info('Refreshing session automatically');
      
      const response = await apiClient.post('/api/auth/refresh', { 
        refreshToken: authState.refreshToken 
      });
      
      if (response.success && response.data) {
        const { token, refreshToken, expiresAt } = response.data;
        
        // Update stored tokens
        localStorage.setItem('trokky_auth_token', token);
        localStorage.setItem('trokky_refresh_token', refreshToken);
        
        // Update auth client
        apiClient.setAuthToken(token);
        
        setAuthState(prev => ({
          ...prev,
          token,
          refreshToken,
          sessionExpiresAt: new Date(expiresAt),
          showTimeoutWarning: false
        }));
        
        logger.info('Session refreshed successfully');
      } else {
        throw new Error('Failed to refresh session');
      }
    } catch (error) {
      logger.error('Session refresh failed', error);
      // Force logout on refresh failure
      await logout();
    } finally {
      isRefreshingRef.current = false;
    }
  }, [authState.refreshToken]);

  const checkAuth = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      // Check for stored tokens
      const storedToken = localStorage.getItem('trokky_auth_token');
      const storedRefreshToken = localStorage.getItem('trokky_refresh_token');
      logger.info('Checking auth', { hasStoredToken: !!storedToken, hasRefreshToken: !!storedRefreshToken });
      
      if (!storedToken) {
        logger.info('No stored token, showing login page');
        setAuthState({
          isAuthenticated: false,
          user: null,
          token: null,
          refreshToken: null,
          isLoading: false,
          sessionExpiresAt: null,
          showTimeoutWarning: false,
          lastActivity: new Date()
        });
        return;
      }

      // Ensure token is set in apiClient before validation
      apiClient.setAuthToken(storedToken);
      
      // Validate token with server
      logger.info('Validating stored token with server');
      const response = await apiClient.post('/api/auth/validate', { token: storedToken });
      
      logger.info('Token validation response', { 
        success: response.success, 
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        error: response.error
      });
      
      if (response.success && response.data && 'valid' in response.data && response.data.valid && 'session' in response.data && response.data.session) {
        logger.info('Authentication validated successfully');
        
        const sessionData = response.data.session as any;
        const expiresAt = sessionData.expiresAt ? new Date(sessionData.expiresAt) : null;
        
        setAuthState({
          isAuthenticated: true,
          user: sessionData?.user || sessionData,
          token: storedToken,
          refreshToken: storedRefreshToken,
          isLoading: false,
          sessionExpiresAt: expiresAt,
          showTimeoutWarning: false,
          lastActivity: new Date()
        });
        
        // Start session monitoring
        startSessionMonitoring(expiresAt);
      } else {
        // Token invalid, try to refresh if we have a refresh token
        if (storedRefreshToken) {
          try {
            const refreshResponse = await apiClient.post('/api/auth/refresh', { 
              refreshToken: storedRefreshToken 
            });
            
            if (refreshResponse.success && refreshResponse.data) {
              const { token, refreshToken, user, expiresAt } = refreshResponse.data;
              
              localStorage.setItem('trokky_auth_token', token);
              localStorage.setItem('trokky_refresh_token', refreshToken);
              apiClient.setAuthToken(token);
              
              const sessionExpiresAt = new Date(expiresAt);
              
              setAuthState({
                isAuthenticated: true,
                user,
                token,
                refreshToken,
                isLoading: false,
                sessionExpiresAt,
                showTimeoutWarning: false,
                lastActivity: new Date()
              });
              
              startSessionMonitoring(sessionExpiresAt);
              logger.info('Session restored via refresh token');
              return;
            }
          } catch (refreshError) {
            logger.warn('Refresh token also invalid', refreshError);
          }
        }
        
        // Both tokens invalid, clear auth state
        logger.warn('Stored tokens are invalid, clearing auth state', { response });
        localStorage.removeItem('trokky_auth_token');
        localStorage.removeItem('trokky_refresh_token');
        apiClient.clearAuthToken();
        setAuthState({
          isAuthenticated: false,
          user: null,
          token: null,
          refreshToken: null,
          isLoading: false,
          sessionExpiresAt: null,
          showTimeoutWarning: false,
          lastActivity: new Date()
        });
      }
    } catch (error) {
      logger.error('Auth check failed', error);
      // Clear invalid tokens
      localStorage.removeItem('trokky_auth_token');
      localStorage.removeItem('trokky_refresh_token');
      apiClient.clearAuthToken();
      setAuthState({
        isAuthenticated: false,
        user: null,
        token: null,
        refreshToken: null,
        isLoading: false,
        sessionExpiresAt: null,
        showTimeoutWarning: false,
        lastActivity: new Date()
      });
    }
  };

  const login = async (username: string, password: string, rememberMe = false): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await apiClient.post('/api/auth/login', { 
        username, 
        password, 
        rememberMe 
      });
      
      if (response.success && response.data) {
        const { user, token, refreshToken, expiresAt } = response.data;
        
        logger.info('User login successful', { username, rememberMe });
        
        // Store tokens
        localStorage.setItem('trokky_auth_token', token);
        localStorage.setItem('trokky_refresh_token', refreshToken);
        
        // Update API client
        apiClient.setAuthToken(token);
        
        const sessionExpiresAt = new Date(expiresAt);
        
        setAuthState({
          isAuthenticated: true,
          user,
          token,
          refreshToken,
          isLoading: false,
          sessionExpiresAt,
          showTimeoutWarning: false,
          lastActivity: new Date()
        });
        
        // Start session monitoring
        startSessionMonitoring(sessionExpiresAt);
        
        return { success: true };
      } else {
        logger.warn('Login failed', { username, error: response.error?.message });
        return { 
          success: false, 
          error: response.error?.message || 'Login failed' 
        };
      }
    } catch (error) {
      logger.error('Login error', { username, error });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Login failed' 
      };
    }
  };

  const logout = async () => {
    try {
      // Stop session monitoring
      stopSessionMonitoring();
      
      // Attempt server logout
      if (authState.refreshToken) {
        await apiClient.post('/api/auth/logout', { refreshToken: authState.refreshToken });
      }
      logger.info('User logout successful');
    } catch (error) {
      logger.error('Logout failed', error);
    } finally {
      // Always clear local state
      localStorage.removeItem('trokky_auth_token');
      localStorage.removeItem('trokky_refresh_token');
      apiClient.clearAuthToken();
      setAuthState({
        isAuthenticated: false,
        user: null,
        token: null,
        refreshToken: null,
        isLoading: false,
        sessionExpiresAt: null,
        showTimeoutWarning: false,
        lastActivity: new Date()
      });
    }
  };

  const dismissTimeoutWarning = useCallback(() => {
    setAuthState(prev => ({ ...prev, showTimeoutWarning: false }));
  }, []);

  // Session monitoring functions
  const startSessionMonitoring = useCallback((expiresAt: Date | null) => {
    if (!expiresAt) return;
    
    stopSessionMonitoring();
    
    // Set up periodic session checks
    sessionCheckRef.current = setInterval(() => {
      const now = new Date();
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();
      
      // Show warning if close to expiry
      if (timeUntilExpiry <= SESSION_CONFIG.WARNING_BUFFER_MS && !authState.showTimeoutWarning) {
        setAuthState(prev => ({ ...prev, showTimeoutWarning: true }));
        logger.warn('Session expiring soon, showing warning');
      }
      
      // Auto-refresh if within refresh buffer
      if (timeUntilExpiry <= SESSION_CONFIG.REFRESH_BUFFER_MS && timeUntilExpiry > 0) {
        refreshSession();
      }
      
      // Force logout if expired
      if (timeUntilExpiry <= 0) {
        logger.warn('Session expired, forcing logout');
        logout();
      }
    }, SESSION_CONFIG.CHECK_INTERVAL_MS);
    
    // Set up inactivity monitoring
    inactivityCheckRef.current = setInterval(() => {
      const now = new Date();
      const timeSinceActivity = now.getTime() - authState.lastActivity.getTime();
      
      if (timeSinceActivity >= SESSION_CONFIG.INACTIVITY_TIMEOUT_MS) {
        logger.warn('User inactive for too long, forcing logout');
        logout();
      }
    }, SESSION_CONFIG.CHECK_INTERVAL_MS);
  }, [authState.showTimeoutWarning, authState.lastActivity, refreshSession, logout]);

  const stopSessionMonitoring = useCallback(() => {
    if (sessionCheckRef.current) {
      clearInterval(sessionCheckRef.current);
      sessionCheckRef.current = null;
    }
    if (inactivityCheckRef.current) {
      clearInterval(inactivityCheckRef.current);
      inactivityCheckRef.current = null;
    }
  }, []);

  // Set up activity tracking
  useEffect(() => {
    if (!authState.isAuthenticated) return;
    
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => updateActivity();
    
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });
    
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [authState.isAuthenticated, updateActivity]);

  // Check auth on mount - but only after apiClient is initialized
  useEffect(() => {
    // Ensure apiClient is initialized first
    if (!(apiClient as any).baseUrl) {
      apiClient.initialize();
    }
    checkAuth();
    
    // Cleanup on unmount
    return () => {
      stopSessionMonitoring();
    };
  }, []);

  // Clean up timers when component unmounts
  useEffect(() => {
    return stopSessionMonitoring;
  }, [stopSessionMonitoring]);

  const contextValue = {
    ...authState,
    login,
    logout,
    checkAuth,
    refreshSession,
    dismissTimeoutWarning,
    updateActivity
  } as AuthContextType;

  return React.createElement(
    AuthContext.Provider,
    { value: contextValue },
    children
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}