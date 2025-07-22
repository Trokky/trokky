// Demo configuration for Trokky Studio
// This file is loaded when developing with the blog demo
window.TROKKY_CONFIG = {
  // Backend API URL for demo
  backendUrl: 'http://localhost:3001/api',
  
  // Branding for demo
  branding: {
    title: 'Trokky Blog Demo',
    logo: null
  },
  
  // Demo user credentials (for easy testing)
  demo: {
    email: 'admin@blog-demo.com',
    password: 'demo123'
  },
  
  // Features enabled for demo
  features: {
    mediaUpload: true,
    userManagement: true,
    realTimeEditing: false,
    collaboration: false
  }
};