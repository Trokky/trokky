#!/usr/bin/env node

/**
 * Webhook Test Server for Trokky v2
 * 
 * A simple HTTP server to receive and test webhooks from Trokky CMS.
 * This server will log all incoming webhook requests and verify signatures.
 * 
 * Usage:
 *   npm run webhook-test [port]        # From project root
 *   node scripts/webhook-test-server.js [port]  # Direct execution
 * 
 * Default port: 3001
 */

const http = require('http');
const crypto = require('crypto');
const url = require('url');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  
  // Handle help flags
  if (args.includes('-h') || args.includes('--help')) {
    console.log(`${colors.bright}${colors.green}🎣 Trokky Webhook Test Server${colors.reset}\n`);
    console.log('A simple HTTP server to receive and test webhooks from Trokky CMS.\n');
    console.log(`${colors.bright}Usage:${colors.reset}`);
    console.log('  npm run webhook-test [port]');
    console.log('  node scripts/webhook-test-server.js [port]\n');
    console.log(`${colors.bright}Options:${colors.reset}`);
    console.log('  -h, --help     Show this help message');
    console.log('  [port]         Port number (default: 3001)\n');
    console.log(`${colors.bright}Examples:${colors.reset}`);
    console.log('  npm run webhook-test           # Start on port 3001');
    console.log('  npm run webhook-test 3002      # Start on port 3002');
    console.log('  npm run webhook-test -- 3003   # Start on port 3003 (note the --)');
    process.exit(0);
  }
  
  // Parse port number
  let port = 3001;
  const portArg = args.find(arg => !arg.startsWith('-'));
  if (portArg) {
    const parsedPort = parseInt(portArg, 10);
    if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      console.error(`${colors.red}❌ Invalid port number: ${portArg}${colors.reset}`);
      console.error('Port must be a number between 1 and 65535');
      process.exit(1);
    }
    port = parsedPort;
  }
  
  return { port };
}

// Configuration
const { port: PORT } = parseArgs();
const HOST = '0.0.0.0';

// Statistics tracking
const stats = {
  totalRequests: 0,
  validSignatures: 0,
  invalidSignatures: 0,
  eventTypes: {},
  startTime: new Date()
};

/**
 * Verify webhook signature using HMAC-SHA256
 */
function verifySignature(payload, signature, secret) {
  if (!secret || !signature) {
    return false;
  }

  // Remove 'sha256=' prefix if present
  const cleanSignature = signature.startsWith('sha256=') 
    ? signature.slice(7) 
    : signature;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(cleanSignature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Format timestamp for logging
 */
function formatTimestamp() {
  return new Date().toISOString();
}

/**
 * Log colored message
 */
function log(color, prefix, message, data = null) {
  const timestamp = colors.dim + formatTimestamp() + colors.reset;
  console.log(`${timestamp} ${color}${prefix}${colors.reset} ${message}`);
  if (data) {
    console.log(colors.dim + JSON.stringify(data, null, 2) + colors.reset);
  }
}

/**
 * Pretty print table headers
 */
function logTable(title, data) {
  console.log(`\n${colors.bright}${colors.cyan}📋 ${title}${colors.reset}`);
  console.log(colors.cyan + '─'.repeat(60) + colors.reset);
  
  if (Array.isArray(data) || typeof data === 'object') {
    if (Array.isArray(data)) {
      data.forEach((item, index) => {
        console.log(`${colors.blue}[${index}]${colors.reset} ${colors.white}${item}${colors.reset}`);
      });
    } else {
      Object.entries(data).forEach(([key, value]) => {
        const displayValue = typeof value === 'object' && value !== null 
          ? JSON.stringify(value).substring(0, 80) + (JSON.stringify(value).length > 80 ? '...' : '')
          : String(value).substring(0, 80) + (String(value).length > 80 ? '...' : '');
        console.log(`${colors.blue}${key.padEnd(20)}${colors.reset} ${colors.white}${displayValue}${colors.reset}`);
      });
    }
  }
  console.log(colors.cyan + '─'.repeat(60) + colors.reset + '\n');
}

/**
 * Log full webhook payload details
 */
function logFullPayload(payload) {
  console.log(`\n${colors.bright}${colors.green}📦 COMPLETE WEBHOOK PAYLOAD${colors.reset}`);
  console.log(colors.green + '═'.repeat(80) + colors.reset);
  console.log(colors.dim + JSON.stringify(payload, null, 2) + colors.reset);
  console.log(colors.green + '═'.repeat(80) + colors.reset + '\n');
}

/**
 * Handle incoming webhook requests
 */
function handleWebhook(req, res) {
  const startTime = Date.now();
  stats.totalRequests++;

  // Parse URL and method
  const parsedUrl = url.parse(req.url, true);
  const method = req.method.toUpperCase();

  // Log incoming request with better formatting
  console.log(`\n${colors.bright}${colors.magenta}🎯 INCOMING WEBHOOK REQUEST${colors.reset}`);
  console.log(colors.magenta + '═'.repeat(80) + colors.reset);
  console.log(`${colors.bright}${method} ${req.url}${colors.reset} ${colors.dim}(${formatTimestamp()})${colors.reset}`);
  
  // Log headers in table format
  logTable('HTTP Headers', req.headers);
  
  // Log query parameters if any
  if (Object.keys(parsedUrl.query).length > 0) {
    logTable('Query Parameters', parsedUrl.query);
  }

  // Handle different HTTP methods
  if (method === 'GET') {
    // Health check endpoint
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      message: 'Webhook test server is running',
      stats: {
        ...stats,
        uptime: Date.now() - stats.startTime.getTime()
      }
    }));
    return;
  }

  if (method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed. Use POST for webhooks.' }));
    return;
  }

  // Collect request body
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    const responseTime = Date.now() - startTime;
    
    try {
      // Show raw payload first
      console.log(`${colors.bright}${colors.yellow}📄 RAW PAYLOAD${colors.reset} ${colors.dim}(${body.length} bytes)${colors.reset}`);
      console.log(colors.yellow + '─'.repeat(80) + colors.reset);
      console.log(colors.dim + (body.length > 1000 ? body.substring(0, 1000) + '\n... (truncated)' : body) + colors.reset);
      console.log(colors.yellow + '─'.repeat(80) + colors.reset + '\n');

      // Parse webhook payload
      const payload = JSON.parse(body);
      const signature = req.headers['x-trokky-signature'];
      const eventType = req.headers['x-trokky-event'] || payload.event?.type;
      const deliveryId = req.headers['x-trokky-delivery'];

      // Show complete parsed payload
      logFullPayload(payload);

      // Track event types
      if (eventType) {
        stats.eventTypes[eventType] = (stats.eventTypes[eventType] || 0) + 1;
      }

      // Verify signature if secret is provided via query parameter
      const secret = parsedUrl.query.secret;
      let signatureValid = null;

      console.log(`${colors.bright}${colors.blue}🔐 SIGNATURE VERIFICATION${colors.reset}`);
      console.log(colors.blue + '─'.repeat(60) + colors.reset);

      if (secret && signature) {
        signatureValid = verifySignature(body, signature, secret);
        if (signatureValid) {
          stats.validSignatures++;
          console.log(`${colors.green}✓ Signature verified successfully${colors.reset}`);
        } else {
          stats.invalidSignatures++;
          console.log(`${colors.red}✗ Invalid signature!${colors.reset}`);
          console.log(`${colors.red}  Provided:${colors.reset} ${signature}`);
          console.log(`${colors.red}  Expected:${colors.reset} sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`);
        }
      } else if (signature) {
        console.log(`${colors.yellow}⚠ Signature provided but no secret to verify against${colors.reset}`);
        console.log(`${colors.dim}  Add ?secret=your-secret to URL to verify signatures${colors.reset}`);
      } else {
        console.log(`${colors.dim}ℹ No signature in request${colors.reset}`);
      }
      console.log(colors.blue + '─'.repeat(60) + colors.reset + '\n');

      // Log event summary
      console.log(`${colors.bright}${colors.green}✅ WEBHOOK PROCESSED SUCCESSFULLY${colors.reset} ${colors.dim}(${responseTime}ms)${colors.reset}`);
      console.log(colors.green + '─'.repeat(80) + colors.reset);
      
      logTable('Event Summary', {
        'Event Type': eventType || 'Unknown',
        'Delivery ID': deliveryId || 'None',
        'Event ID': payload.event?.id || 'None',
        'Source': payload.event?.source || 'Unknown',
        'Timestamp': payload.event?.timestamp || 'None',
        'Webhook ID': payload.webhook?.id || 'None',
        'Webhook Name': payload.webhook?.name || 'None',
        'Actor': payload.event?.actor ? `${payload.event.actor.type}:${payload.event.actor.id}` : 'None',
        'Signature Valid': signatureValid === null ? 'Not verified' : (signatureValid ? 'Yes' : 'No')
      });

      // Show document-specific details for document events
      if (eventType && eventType.startsWith('document.') && payload.event?.data) {
        const eventData = payload.event.data;
        
        console.log(`${colors.bright}${colors.cyan}📄 DOCUMENT EVENT DETAILS${colors.reset}`);
        console.log(colors.cyan + '─'.repeat(80) + colors.reset);
        
        logTable('Document Info', {
          'Collection': eventData.collection || 'Unknown',
          'Document ID': eventData.id || 'Unknown',
          'Changes': Array.isArray(eventData.changes) ? eventData.changes.join(', ') : 'None listed'
        });
        
        if (eventData.document) {
          logTable('Current Document', {
            'ID': eventData.document.id || eventData.document._id || 'Unknown',
            'Title': eventData.document.title || 'Untitled',
            'Slug': eventData.document.slug || 'No slug',
            'Status': eventData.document._status || eventData.document.status || 'Unknown',
            'Created': eventData.document._createdAt || eventData.document.createdAt || 'Unknown',
            'Updated': eventData.document._updatedAt || eventData.document.updatedAt || 'Unknown',
            'Published': eventData.document.published !== undefined ? String(eventData.document.published) : 'Unknown'
          });
        }
        
        if (eventData.previousDocument) {
          logTable('Previous Document', {
            'ID': eventData.previousDocument.id || eventData.previousDocument._id || 'Unknown',
            'Title': eventData.previousDocument.title || 'Untitled',
            'Status': eventData.previousDocument._status || eventData.previousDocument.status || 'Unknown',
            'Published': eventData.previousDocument.published !== undefined ? String(eventData.previousDocument.published) : 'Unknown'
          });
        }
      }
      
      // Show system test event details
      if (eventType === 'system.test' && payload.event?.data) {
        console.log(`${colors.bright}${colors.magenta}🧪 TEST EVENT DETAILS${colors.reset}`);
        console.log(colors.magenta + '─'.repeat(80) + colors.reset);
        logTable('Test Data', payload.event.data);
      }

      // Simulate different response scenarios based on query parameters
      const scenario = parsedUrl.query.scenario;
      
      switch (scenario) {
        case 'delay':
          // Simulate slow response (useful for testing timeouts)
          const delay = parseInt(parsedUrl.query.delay) || 2000;
          setTimeout(() => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              status: 'success', 
              message: `Delayed response after ${delay}ms`,
              deliveryId 
            }));
          }, delay);
          return;

        case 'error':
          // Simulate server error (useful for testing retries)
          const statusCode = parseInt(parsedUrl.query.code) || 500;
          res.writeHead(statusCode, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: `Simulated ${statusCode} error`,
            deliveryId 
          }));
          log(colors.red, '[SIMULATE]', `Returned ${statusCode} error as requested`);
          return;

        case 'timeout':
          // Simulate timeout (don't respond)
          log(colors.yellow, '[SIMULATE]', 'Simulating timeout - not responding');
          return;

        default:
          // Normal successful response
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'success',
            message: 'Webhook received and processed successfully',
            deliveryId,
            eventType,
            responseTime
          }));
      }

    } catch (error) {
      log(colors.red, '[ERROR]', 'Failed to parse webhook payload', {
        error: error.message,
        body: body.substring(0, 500) + (body.length > 500 ? '...' : '')
      });

      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Invalid JSON payload',
        message: error.message
      }));
    }
  });

  req.on('error', (error) => {
    log(colors.red, '[ERROR]', 'Request error', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });
}

/**
 * Create and start the server
 */
const server = http.createServer(handleWebhook);

server.listen(PORT, HOST, () => {
  console.log(`${colors.bright}${colors.green}🎣 Webhook Test Server Started${colors.reset}`);
  console.log(`${colors.cyan}📡 Listening on: ${colors.bright}http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}${colors.reset}`);
  console.log('');
  console.log(`${colors.bright}Usage Examples:${colors.reset}`);
  console.log(`${colors.blue}• Basic webhook:${colors.reset} http://localhost:${PORT}/webhook`);
  console.log(`${colors.blue}• With secret:${colors.reset} http://localhost:${PORT}/webhook?secret=your-secret-key`);
  console.log(`${colors.blue}• Simulate delay:${colors.reset} http://localhost:${PORT}/webhook?scenario=delay&delay=3000`);
  console.log(`${colors.blue}• Simulate error:${colors.reset} http://localhost:${PORT}/webhook?scenario=error&code=500`);
  console.log(`${colors.blue}• Simulate timeout:${colors.reset} http://localhost:${PORT}/webhook?scenario=timeout`);
  console.log(`${colors.blue}• Health check:${colors.reset} GET http://localhost:${PORT}/health`);
  console.log('');
  console.log(`${colors.dim}Press Ctrl+C to stop the server${colors.reset}`);
  console.log('');
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`${colors.red}❌ Port ${PORT} is already in use.${colors.reset}`);
    console.error('');
    console.error(`${colors.bright}Solutions:${colors.reset}`);
    console.error(`${colors.blue}• Try a different port:${colors.reset} npm run webhook-test ${PORT + 1}`);
    console.error(`${colors.blue}• Find what's using port ${PORT}:${colors.reset}`);
    if (process.platform === 'darwin' || process.platform === 'linux') {
      console.error(`  lsof -i :${PORT}`);
      console.error(`  sudo kill -9 $(lsof -t -i:${PORT})`);
    } else {
      console.error(`  netstat -ano | findstr :${PORT}`);
    }
    console.error(`${colors.blue}• Check if Trokky demo is running on port ${PORT}${colors.reset}`);
  } else {
    console.error(`${colors.red}❌ Server error:${colors.reset}`, error);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}🛑 Shutting down webhook test server...${colors.reset}`);
  
  // Display final statistics
  const uptime = Date.now() - stats.startTime.getTime();
  console.log(`\n${colors.bright}📊 Final Statistics:${colors.reset}`);
  console.log(`${colors.green}✓ Total requests: ${stats.totalRequests}${colors.reset}`);
  console.log(`${colors.green}✓ Valid signatures: ${stats.validSignatures}${colors.reset}`);
  if (stats.invalidSignatures > 0) {
    console.log(`${colors.red}✗ Invalid signatures: ${stats.invalidSignatures}${colors.reset}`);
  }
  console.log(`${colors.blue}⏱  Uptime: ${Math.round(uptime / 1000)}s${colors.reset}`);
  
  if (Object.keys(stats.eventTypes).length > 0) {
    console.log(`\n${colors.bright}📈 Event Types Received:${colors.reset}`);
    Object.entries(stats.eventTypes)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`  ${colors.cyan}${type}${colors.reset}: ${count}`);
      });
  }
  
  server.close(() => {
    console.log(`${colors.green}✨ Server stopped gracefully${colors.reset}`);
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(`${colors.red}💥 Uncaught Exception:${colors.reset}`, error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`${colors.red}💥 Unhandled Rejection at:${colors.reset}`, promise);
  console.error(`${colors.red}Reason:${colors.reset}`, reason);
  process.exit(1);
});