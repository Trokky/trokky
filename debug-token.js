#!/usr/bin/env node

/**
 * Debug script to test API token validation
 */

const token = 'd0d0877d06d4839a523ecf942d6f6be67a072ecdf84eb24c445067d36c86f284';

console.log('🔍 Token Analysis:');
console.log('Token:', token);
console.log('Length:', token.length);
console.log('Is 64 chars:', token.length === 64);
console.log('Is hex:', /^[a-f0-9]{64}$/.test(token));

// Test the validation logic from Express integration
const parts = token.split('.');
console.log('JWT parts:', parts.length);

if (token.length === 64 && /^[a-f0-9]{64}$/.test(token)) {
  console.log('✅ Token matches expected API token format');
} else {
  console.log('❌ Token does not match expected format');
}

// Test making requests to different API paths
async function testApiRequest(path, description) {
  try {
    console.log(`\n🌐 Testing ${description}...`);
    console.log(`URL: ${path}`);
    
    const response = await fetch(path, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Request successful');
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.log('❌ Request failed');
      console.log('Error:', errorText.substring(0, 200) + (errorText.length > 200 ? '...' : ''));
    }
  } catch (error) {
    console.log('❌ Request error:', error.message);
  }
}

async function runTests() {
  // Test different possible API paths
  await testApiRequest('http://localhost:3000/api/collections', '/api/collections');
  await testApiRequest('http://localhost:3000/cms-api/collections', '/cms-api/collections');
  await testApiRequest('http://localhost:3000/collections', '/collections');
  
  // Test a simple endpoint first
  await testApiRequest('http://localhost:3000/cms-api/auth/validate', '/cms-api/auth/validate (POST)');
}

runTests();
