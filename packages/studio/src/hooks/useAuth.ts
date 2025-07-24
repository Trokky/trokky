import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { apiClient } from '@/services/api-client';
import { createStudioLogger } from '@/utils/logger';
import type { User } from '@/types';

const logger = createStudioLogger('useAuth');

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null,
    isLoading: true
  });

  const checkAuth = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      // Check for stored token
      const storedToken = localStorage.getItem('trokky_auth_token');
      logger.info('Checking auth', { hasStoredToken: !!storedToken });
      
      if (!storedToken) {
        logger.info('No stored token, showing login page');
        setAuthState({
          isAuthenticated: false,
          user: null,
          token: null,
          isLoading: false
        });
        return;
      }

      // Validate token with server
      const response = await apiClient.post('/auth/validate', { token: storedToken });
      
      if (response.success && response.data && 'valid' in response.data && response.data.valid && 'session' in response.data && response.data.session) {
        logger.info('Authentication validated successfully');
        setAuthState({
          isAuthenticated: true,
          user: (response.data.session as any)?.user || response.data.session,
          token: storedToken,
          isLoading: false
        });
      } else {
        // Token invalid, clear it
        logger.warn('Stored token is invalid, clearing auth state');
        localStorage.removeItem('trokky_auth_token');
        apiClient.clearAuthToken();
        setAuthState({
          isAuthenticated: false,
          user: null,
          token: null,
          isLoading: false
        });
      }
    } catch (error) {
      logger.error('Auth check failed', error);
      // Clear invalid token
      localStorage.removeItem('trokky_auth_token');
      apiClient.clearAuthToken();
      setAuthState({
        isAuthenticated: false,
        user: null,
        token: null,
        isLoading: false
      });
    }
  };

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await apiClient.login(username, password);
      
      if (response.success && response.data) {
        logger.info('User login successful', { username });
        setAuthState({
          isAuthenticated: true,
          user: response.data.user,
          token: response.data.token,
          isLoading: false
        });
        
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
      await apiClient.logout();
      logger.info('User logout successful');
    } catch (error) {
      logger.error('Logout failed', error);
    } finally {
      // Always clear local state
      localStorage.removeItem('trokky_auth_token');
      apiClient.clearAuthToken();
      setAuthState({
        isAuthenticated: false,
        user: null,
        token: null,
        isLoading: false
      });
    }
  };

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const contextValue = {
    ...authState,
    login,
    logout,
    checkAuth
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