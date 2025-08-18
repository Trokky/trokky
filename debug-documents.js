#!/usr/bin/env node

/**
 * Debug script to test specific document endpoints
 */

const token = 'd0d0877d06d4839a523ecf942d6f6be67a072ecdf84eb24c445067d36c86f284';

console.log('🔍 Document Access Debug');
console.log('========================');

// Test specific document endpoints
async function testDocumentEndpoints() {
  console.log('\n1️⃣ Testing specific document endpoints...');
  
  const endpoints = [
    {
      url: 'http://localhost:3000/cms-api/collections/homePage/home',
      description: 'Get homePage document (singleton)'
    },
    {
      url: 'http://localhost:3000/cms-api/collections/article/article-mdwey3fq-1fc4a299-05ceca',
      description: 'Get specific article document'
    },
    {
      url: 'http://localhost:3000/cms-api/collections/settings/main',
      description: 'Get settings document (singleton)'
    }
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n📍 ${endpoint.description}`);
      console.log(`   URL: ${endpoint.url}`);
      
      const response = await fetch(endpoint.url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('   ✅ Success');
        if (data.data && data.data.document) {
          console.log(`   📄 Document ID: ${data.data.document.id || data.data.document._id}`);
          console.log(`   📄 Document Type: ${data.data.document._type}`);
          if (data.data.document.title) {
            console.log(`   📄 Title: ${data.data.document.title}`);
          }
        }
      } else {
        const errorText = await response.text();
        try {
          const errorData = JSON.parse(errorText);
          console.log('   ❌ Error:', errorData.error?.message || errorData.message);
          if (errorData.error?.code) {
            console.log('   🏷️  Code:', errorData.error.code);
          }
        } catch {
          console.log('   ❌ Error:', errorText.substring(0, 200));
        }
      }
    } catch (error) {
      console.log(`   ❌ Request Error: ${error.message}`);
    }
  }
}

// Test collection listing to find actual document IDs
async function testCollectionListing() {
  console.log('\n2️⃣ Testing collection listing to find actual document IDs...');
  
  const collections = ['homePage', 'article', 'settings', 'author', 'category'];
  
  for (const collection of collections) {
    try {
      console.log(`\n📚 Listing ${collection} documents...`);
      
      const response = await fetch(`http://localhost:3000/cms-api/collections/${collection}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('   ✅ Success');
        
        if (data.data && data.data.documents && Array.isArray(data.data.documents)) {
          console.log(`   📄 Found ${data.data.documents.length} documents`);
          
          // Show first few document IDs
          data.data.documents.slice(0, 3).forEach((doc, index) => {
            const docId = doc.id || doc._id;
            const docTitle = doc.title || doc.name || 'No title';
            console.log(`   ${index + 1}. ID: ${docId} - Title: ${docTitle}`);
            
            // Test accessing this specific document
            if (index === 0) {
              console.log(`   🔗 Test URL: http://localhost:3000/cms-api/collections/${collection}/${docId}`);
            }
          });
        } else {
          console.log('   📄 No documents found or unexpected response format');
        }
      } else {
        const errorText = await response.text();
        try {
          const errorData = JSON.parse(errorText);
          console.log('   ❌ Error:', errorData.error?.message || errorData.message);
        } catch {
          console.log('   ❌ Error:', errorText.substring(0, 100));
        }
      }
    } catch (error) {
      console.log(`   ❌ Request Error: ${error.message}`);
    }
  }
}

// Test creating a new document to see if write permissions work
async function testDocumentCreation() {
  console.log('\n3️⃣ Testing document creation (write permissions)...');
  
  try {
    console.log('📝 Creating a test article...');
    
    const testArticle = {
      title: 'Test Article from API Token',
      content: 'This is a test article created using the API token.',
      publishedAt: new Date().toISOString()
    };
    
    const response = await fetch('http://localhost:3000/cms-api/collections/article', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(testArticle)
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ Document creation successful');
      if (data.data && data.data.document) {
        const docId = data.data.document.id || data.data.document._id;
        console.log(`   📄 Created document ID: ${docId}`);
        console.log(`   🔗 Access URL: http://localhost:3000/cms-api/collections/article/${docId}`);
      }
    } else {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        console.log('   ❌ Creation Error:', errorData.error?.message || errorData.message);
        if (errorData.error?.code) {
          console.log('   🏷️  Code:', errorData.error.code);
        }
      } catch {
        console.log('   ❌ Error:', errorText.substring(0, 200));
      }
    }
  } catch (error) {
    console.log(`   ❌ Request Error: ${error.message}`);
  }
}

async function runAllTests() {
  await testDocumentEndpoints();
  await testCollectionListing();
  await testDocumentCreation();
  
  console.log('\n🎯 Summary:');
  console.log('- Check if the API token has the correct permissions for document access');
  console.log('- Verify the document IDs are correct');
  console.log('- Test both read and write operations to understand permission scope');
}

runAllTests();
