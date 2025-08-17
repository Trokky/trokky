import React, { useState, useEffect, createContext, useContext, ReactNode, useRef, useCallback } from 'react';
import { apiClient } from '@/services/api-client';
import { createStudioLogger } from '@/utils/logger';
import type { User } from '@/types';

const logger = createStudioLogger('useAuth');

// Get session configuration from runtime config or use defaults
const getSessionConfig = () => {
  const runtimeConfig = (window as any).TROKKY_CONFIG;
  const sessionConfig = runtimeConfig?.sessionConfig;
  
  return {
    // Auto-refresh token 30 seconds before expiry
    REFRESH_BUFFER_MS: sessionConfig?.refreshBufferMs || 30 * 1000,
    // Disable session warning - let auto-refresh handle expiry silently
    WARNING_BUFFER_MS: sessionConfig?.warningBufferMs || 0,
    // Check session every 30 seconds (less aggressive)
    CHECK_INTERVAL_MS: sessionConfig?.checkIntervalMs || 30 * 1000,
    // Session timeout for content management (2 hours)
    DEFAULT_TIMEOUT_MS: sessionConfig?.defaultTimeoutMs || 2 * 60 * 60 * 1000,
    // Extended session for "Remember Me" (7 days)
    EXTENDED_TIMEOUT_MS: sessionConfig?.extendedTimeoutMs || 7 * 24 * 60 * 60 * 1000,
    // Inactivity timeout (30 minutes)
    INACTIVITY_TIMEOUT_MS: sessionConfig?.inactivityTimeoutMs || 30 * 60 * 1000
  };
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
  updateUser: (user: any) => void;
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

  // Keep refs in sync with state
  useEffect(() => {
    authStateRef.current = authState;
    refreshTokenRef.current = authState.refreshToken;
  }, [authState]);

  const sessionCheckRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityCheckRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);
  const refreshTokenRef = useRef<string | null>(null);
  const authStateRef = useRef<AuthState>(authState);

  // Track user activity for inactivity detection
  const updateActivity = useCallback(() => {
    setAuthState(prev => ({ ...prev, lastActivity: new Date() }));
  }, []); // Empty dependency array - function doesn't depend on external values

  // Auto-refresh session before expiry
  const refreshSession = useCallback(async () => {
    console.log('🔄 refreshSession called', {
      isRefreshing: isRefreshingRef.current,
      hasRefreshToken: !!refreshTokenRef.current,
      refreshTokenValue: refreshTokenRef.current ? 'exists' : 'null'
    });
    
    if (isRefreshingRef.current || !refreshTokenRef.current) {
      console.log('❌ RefreshSession blocked - conditions not met');
      return;
    }

    try {
      isRefreshingRef.current = true;
      console.log('🚀 Starting session refresh...');
      logger.info('Refreshing session automatically');
      
      const response = await apiClient.post('/auth/refresh', { 
        refreshToken: refreshTokenRef.current 
      });
      
      console.log('📡 Refresh response:', response);
      
      if (response.success && response.data && 
          typeof response.data === 'object' && 
          'token' in response.data && 
          'refreshToken' in response.data && 
          'expiresAt' in response.data) {
        const { token, refreshToken, expiresAt } = response.data as {
          token: string;
          refreshToken: string;
          expiresAt: string;
        };
        
        // Update stored tokens
        localStorage.setItem('trokky_auth_token', token);
        localStorage.setItem('trokky_refresh_token', refreshToken);
        
        // Update auth client
        apiClient.setAuthToken(token);
        
        const newExpiresAt = new Date(expiresAt);
        
        setAuthState(prev => ({
          ...prev,
          token,
          refreshToken,
          sessionExpiresAt: newExpiresAt,
          showTimeoutWarning: false // This should hide the warning
        }));
        
        logger.info('Session refreshed successfully');
      } else {
        logger.error('Invalid refresh response:', response);
        throw new Error('Failed to refresh session');
      }
    } catch (error) {
      logger.error('Session refresh failed', error);
      // Force logout on refresh failure - clear state directly
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
    } finally {
      isRefreshingRef.current = false;
    }
  }, []); // Remove all dependencies to avoid hoisting issues, use refs for stable access

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
      const response = await apiClient.post('/auth/validate', { token: storedToken });
      
      logger.info('Token validation response', { 
        success: response.success, 
        hasData: !!response.data,
        dataKeys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : [],
        error: response.error
      });
      
      if (response.success && 
          response.data && 
          typeof response.data === 'object' && 
          'valid' in response.data && 
          response.data.valid && 
          'session' in response.data && 
          response.data.session) {
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
            const refreshResponse = await apiClient.post('/auth/refresh', { 
              refreshToken: storedRefreshToken 
            });
            
            if (refreshResponse.success && 
                refreshResponse.data && 
                typeof refreshResponse.data === 'object' && 
                'token' in refreshResponse.data && 
                'refreshToken' in refreshResponse.data && 
                'user' in refreshResponse.data && 
                'expiresAt' in refreshResponse.data) {
              const { token, refreshToken, user, expiresAt } = refreshResponse.data as {
                token: string;
                refreshToken: string;
                user: any;
                expiresAt: string;
              };
              
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
      const response = await apiClient.post('/auth/login', { 
        username, 
        password, 
        rememberMe 
      });
      
      console.log('📥 Login response:', response);
      
      if (response.success && response.data && 
          typeof response.data === 'object' && 
          'user' in response.data && 
          'token' in response.data && 
          'expiresAt' in response.data) {
        const { user, token, refreshToken, expiresAt } = response.data as {
          user: any;
          token: string;
          refreshToken?: string;
          expiresAt: string;
        };
        
        console.log('🔑 Extracted tokens:', {
          hasToken: !!token,
          hasRefreshToken: !!refreshToken,
          refreshTokenLength: refreshToken?.length || 0
        });
        
        logger.info('User login successful', { username, rememberMe });
        
        // Store tokens
        localStorage.setItem('trokky_auth_token', token);
        if (refreshToken) {
          localStorage.setItem('trokky_refresh_token', refreshToken);
        }
        
        // Update API client
        apiClient.setAuthToken(token);
        
        const sessionExpiresAt = new Date(expiresAt);
        
        setAuthState({
          isAuthenticated: true,
          user,
          token,
          refreshToken: refreshToken || null,
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
        await apiClient.post('/auth/logout', { refreshToken: authState.refreshToken });
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

  const updateUser = useCallback((user: any) => {
    setAuthState(prev => ({ ...prev, user }));
  }, []);

  // Session monitoring functions
  const startSessionMonitoring = useCallback((expiresAt: Date | null) => {
    if (!expiresAt) return;
    
    stopSessionMonitoring();
    
    const sessionConfig = getSessionConfig();
    
    // Set up periodic session checks
    sessionCheckRef.current = setInterval(() => {
      const now = new Date();
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();
      const currentAuthState = authStateRef.current;
      
      // Skip warning - let auto-refresh handle expiry silently
      // Warning disabled to prevent user disruption
      
      // Auto-refresh if within refresh buffer
      if (timeUntilExpiry <= sessionConfig.REFRESH_BUFFER_MS && timeUntilExpiry > 0) {
        refreshSession();
      }
      
      // Force logout if expired
      if (timeUntilExpiry <= 0) {
        logger.warn('Session expired, forcing logout');
        // Clear state directly to avoid hoisting issues
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
    }, sessionConfig.CHECK_INTERVAL_MS);
    
    // Set up inactivity monitoring
    inactivityCheckRef.current = setInterval(() => {
      const now = new Date();
      const currentAuthState = authStateRef.current;
      const timeSinceActivity = now.getTime() - currentAuthState.lastActivity.getTime();
      
      if (timeSinceActivity >= sessionConfig.INACTIVITY_TIMEOUT_MS) {
        logger.warn('User inactive for too long, forcing logout');
        // Clear state directly to avoid hoisting issues
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
    }, sessionConfig.CHECK_INTERVAL_MS);
  }, [refreshSession]); // Remove logout dependency

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
  }, [authState.isAuthenticated]); // Remove updateActivity dependency since it's now stable

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

  // Restart session monitoring when sessionExpiresAt changes (after refresh)
  useEffect(() => {
    if (authState.isAuthenticated && authState.sessionExpiresAt) {
      startSessionMonitoring(authState.sessionExpiresAt);
    }
  }, [authState.sessionExpiresAt, authState.isAuthenticated, startSessionMonitoring]);

  const contextValue = {
    ...authState,
    login,
    logout,
    checkAuth,
    refreshSession,
    dismissTimeoutWarning,
    updateActivity,
    updateUser
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