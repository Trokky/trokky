// Decode JWT token
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyLW1lcm93YXMzLWE5ZTNmMDQ2LTAxYjEyYSIsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJwZXJtaXNzaW9ucyI6WyJjb250ZW50OnJlYWQiLCJjb250ZW50OndyaXRlIiwiY29udGVudDpkZWxldGUiLCJ1c2VyczpyZWFkIiwidXNlcnM6d3JpdGUiLCJzZXR0aW5nczpyZWFkIiwic2V0dGluZ3M6d3JpdGUiLCJtZWRpYTp1cGxvYWQiLCJtZWRpYTpkZWxldGUiLCJzdHVkaW86YWNjZXNzIiwiY29udGVudDoqIiwibWVkaWE6cmVhZCIsIm1lZGlhOmVkaXQiLCJ1c2VyczpkZWxldGUiLCJ1c2VyczppbnZpdGUiLCJ0b2tlbnM6cmVhZCIsInRva2Vuczp3cml0ZSIsInRva2VuczpkZWxldGUiLCJ3ZWJob29rczpyZWFkIiwid2ViaG9va3M6d3JpdGUiLCJ3ZWJob29rczpkZWxldGUiLCJ3ZWJob29rczp0ZXN0Il0sImlhdCI6MTc1NzU2MzUyMCwiZXhwIjoxNzU3NTcwNzIwfQ.xH0Cmy0iEuaKS2wVdoe6RE5_--rIuQ5MTDmz1-BH6rA";

// Decode the payload (middle part)
const payload = token.split('.')[1];
const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());

console.log('Decoded JWT Token:');
console.log(JSON.stringify(decoded, null, 2));

// Convert timestamps to readable dates
console.log('\nTimestamps:');
console.log('Issued at:', new Date(decoded.iat * 1000).toISOString());
console.log('Expires at:', new Date(decoded.exp * 1000).toISOString());

// Analyze permissions
console.log('\nPermissions Analysis:');
console.log('Total permissions:', decoded.permissions.length);
console.log('Has content:write:', decoded.permissions.includes('content:write'));
console.log('Has content:*:', decoded.permissions.includes('content:*'));
console.log('Role:', decoded.role);
