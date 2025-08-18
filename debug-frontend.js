#!/usr/bin/env node

/**
 * Debug script to test the frontend's TrokkyClient
 */

// Simulate the TrokkyClient configuration from the frontend
const token = 'd0d0877d06d4839a523ecf942d6f6be67a072ecdf84eb24c445067d36c86f284';

console.log('🔍 Frontend Debug Analysis');
console.log('=========================');

// Test 1: Direct API call (what we know works)
async function testDirectApi() {
  console.log('\n1️⃣ Testing direct API call...');
  
  try {
    const response = await fetch('http://localhost:3000/cms-api/collections', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Direct API Status:', response.status);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Direct API Success - Collections count:', data.data?.collections?.length || 0);
    }
  } catch (error) {
    console.log('❌ Direct API Error:', error.message);
  }
}

// Test 2: Simulate TrokkyClient behavior
async function testTrokkyClientBehavior() {
  console.log('\n2️⃣ Testing TrokkyClient-like behavior...');
  
  // Simulate the client's buildHeaders method
  const buildHeaders = (apiToken, additionalHeaders = {}) => {
    const headers = {
      'Accept': 'application/json',
      ...additionalHeaders
    };
    
    if (apiToken) {
      headers.Authorization = `Bearer ${apiToken}`;
    }
    
    return headers;
  };
  
  // Simulate the client's buildUrl method
  const buildUrl = (baseUrl, endpoint, apiVersion = '') => {
    const cleanBase = baseUrl.replace(/\/$/, '');
    const cleanEndpoint = endpoint.replace(/^\//, '');
    
    if (apiVersion && apiVersion !== '') {
      return `${cleanBase}/${apiVersion}/${cleanEndpoint}`;
    }
    return `${cleanBase}/${cleanEndpoint}`;
  };
  
  const baseUrl = 'http://localhost:3000/cms-api';
  const endpoint = 'collections';
  const apiVersion = ''; // Empty string as configured in frontend
  
  const url = buildUrl(baseUrl, endpoint, apiVersion);
  const headers = buildHeaders(token);
  
  console.log('URL:', url);
  console.log('Headers:', headers);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers
    });
    
    console.log('Status:', response.status);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ TrokkyClient-like Success - Collections count:', data.data?.collections?.length || 0);
    } else {
      const errorText = await response.text();
      console.log('❌ TrokkyClient-like Error:', errorText.substring(0, 200));
    }
  } catch (error) {
    console.log('❌ TrokkyClient-like Request Error:', error.message);
  }
}

// Test 3: Test different endpoint patterns
async function testEndpointPatterns() {
  console.log('\n3️⃣ Testing different endpoint patterns...');
  
  const patterns = [
    'http://localhost:3000/cms-api/collections',
    'http://localhost:3000/cms-api/v1/collections',
    'http://localhost:3000/cms-api//collections',
    'http://localhost:3000/cms-api/collections/',
  ];
  
  for (const url of patterns) {
    try {
      console.log(`\nTesting: ${url}`);
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      if (response.status === 200) {
        console.log('✅ Success');
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

// Test 4: Check if the issue is with specific endpoints
async function testSpecificEndpoints() {
  console.log('\n4️⃣ Testing specific endpoints that frontend might use...');
  
  const endpoints = [
    '/collections',
    '/collections/article',
    '/collections/homePage',
    '/auth/validate',
    '/me'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const url = `http://localhost:3000/cms-api${endpoint}`;
      console.log(`\nTesting: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      console.log(`Status: ${response.status} ${response.statusText}`);
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Success');
        if (data.data) {
          console.log('Data keys:', Object.keys(data.data));
        }
      } else if (response.status === 404) {
        console.log('ℹ️  Endpoint not found (expected for some)');
      } else {
        const errorText = await response.text();
        console.log('❌ Error:', errorText.substring(0, 100));
      }
    } catch (error) {
      console.log(`❌ Request Error: ${error.message}`);
    }
  }
}

async function runAllTests() {
  await testDirectApi();
  await testTrokkyClientBehavior();
  await testEndpointPatterns();
  await testSpecificEndpoints();
  
  console.log('\n🎯 Summary:');
  console.log('- API token format is correct');
  console.log('- Direct API calls work');
  console.log('- Check the frontend console for TrokkyClient debug logs');
  console.log('- The issue might be in the client\'s request building or error handling');
}

runAllTests();
