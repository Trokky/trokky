/**
 * Helper to get Studio API client when available
 */

let cachedApiClient: any = null;

export function getStudioApiClient(): any {
  if (cachedApiClient) {
    return cachedApiClient;
  }
  
  console.log('API client helper: Attempting to get Studio API client...');
  
  try {
    // Try to access window globals that Studio might set
    if (typeof window !== 'undefined') {
      const windowObj = window as any;
      
      // Check for API client instances that might be globally available
      const possibleClients = [
        windowObj.TROKKY_API_CLIENT,
        windowObj.trokkyApiClient,
        windowObj.apiClient,
        windowObj.studioApiClient
      ];
      
      for (const client of possibleClients) {
        if (client && typeof client.getMedia === 'function') {
          console.log('API client helper: Found working API client on window');
          cachedApiClient = client;
          return cachedApiClient;
        }
      }
      
      // Try to find it in React context or other global state
      // Check if Studio has exposed any API through global state
      if (windowObj.__STUDIO_CONTEXT__ && windowObj.__STUDIO_CONTEXT__.apiClient) {
        console.log('API client helper: Found API client in Studio context');
        cachedApiClient = windowObj.__STUDIO_CONTEXT__.apiClient;
        return cachedApiClient;
      }
    }
  } catch (error) {
    console.log('API client helper: Window search failed:', error instanceof Error ? error.message : String(error));
  }
  
  try {
    // Try dynamic import as last resort
    console.log('API client helper: Attempting dynamic import...');
    const module = require('@trokky/studio/services/api-client');
    if (module && module.apiClient && typeof module.apiClient.getMedia === 'function') {
      console.log('API client helper: Successfully imported Studio API client');
      cachedApiClient = module.apiClient;
      return cachedApiClient;
    }
    
    // Try legacy apiService
    const legacyModule = require('@trokky/studio/services/apiService');
    if (legacyModule && legacyModule.apiService && typeof legacyModule.apiService.getMedia === 'function') {
      console.log('API client helper: Successfully imported legacy API service');
      cachedApiClient = legacyModule.apiService;
      return cachedApiClient;
    }
  } catch (error) {
    console.log('API client helper: Dynamic import failed:', error instanceof Error ? error.message : String(error));
  }
  
  console.log('API client helper: No API client found');
  return null;
}