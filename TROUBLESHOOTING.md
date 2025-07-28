# Trokky v2 Troubleshooting Guide

## Structure Configuration Issues

### Problem: Structure changes in trokky.config.ts not taking effect in Studio

**Symptoms:**
- You comment out or change `structure: blogStructure` in `trokky.config.ts`
- Studio still shows the old structure configuration
- Navigation doesn't reflect the changes

**Root Cause:**
The Structure Service caches structure data in memory and browser storage to improve performance. When you change the configuration, the cache needs to be cleared.

**Solutions:**

#### Solution 1: Hard Browser Refresh (Quickest)
1. In your browser, open Developer Tools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"
4. Or use Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)

#### Solution 2: Clear Browser Cache
1. Open browser Developer Tools (F12)
2. Go to Application tab (Chrome) or Storage tab (Firefox)
3. Find Local Storage → your domain
4. Delete any keys starting with `trokky_`
5. Refresh the page

#### Solution 3: Force Structure Refresh via Console
1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Run this command:
```javascript
// Clear structure cache and force refresh
if (window.TrokkyDebug) {
  window.TrokkyDebug.clearStructureCache();
  window.location.reload();
} else {
  // Manual cache clear
  localStorage.removeItem('trokky_structure_cache');
  sessionStorage.clear();
  window.location.reload();
}
```

#### Solution 4: Restart Development Server
1. Stop the server (Ctrl+C)
2. Start it again with `npm run dev`
3. This ensures any server-side caching is cleared

#### Solution 5: Add Cache-Busting to Structure Endpoint
Add a timestamp parameter to force fresh structure loading:
```javascript
// In browser console
fetch('/api/config/structure?_refresh=' + Date.now(), {
  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('trokky_auth_token') }
})
.then(r => r.json())
.then(data => {
  console.log('Fresh structure:', data);
  window.location.reload();
});
```

### Understanding the Structure Loading Priority

The Structure Service loads structure in this order:

1. **Dynamic API Endpoint**: `GET /api/config/structure` (highest priority)
2. **Static Window Config**: `window.TROKKY_CONFIG.structure`
3. **Auto-generated Fallback**: Generated from schemas (lowest priority)

When you comment out structure in `trokky.config.ts`:
- The API endpoint falls back to auto-generated structure
- But the browser cache might still hold the old structure
- Clearing cache forces a fresh API call

### Development Tips

1. **During Development**: Keep browser dev tools open and disable cache:
   - F12 → Network tab → Check "Disable cache"

2. **Structure Changes**: Always test with a hard refresh after config changes

3. **Debug Structure Loading**: Check the browser console for structure service logs:
   ```
   [StructureService] Loaded dynamic structure from endpoint
   [StructureService] Cache cleared, next request will fetch fresh structure
   ```

## Common Configuration Issues

### CORS Errors in Development
If you see CORS errors when the Studio tries to connect to the API:

**Check trokky.config.ts CORS configuration:**
```typescript
server: {
  cors: {
    origin: 'http://localhost:5173', // Studio dev server
    credentials: true
  }
}
```

### Studio Assets Not Loading
If Studio assets (CSS, JS) fail to load:

**Check static file configuration in server.ts:**
```typescript
static: {
  assets: {
    path: '/assets',
    directory: path.join(__dirname, '../../packages/studio/dist/assets'),
    maxAge: 86400
  }
}
```

### Authentication Issues
If login fails or tokens are rejected:

1. Check JWT secret is set consistently
2. Verify admin user credentials in config
3. Check browser network tab for 401/403 errors
4. Clear browser storage and retry login

## Debug Commands

### Check Structure via API
```bash
# Test structure endpoint (replace with your auth token)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/config/structure | jq '.data.structure.title'
```

### Check Studio Config
```bash
# Test studio config endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/config/studio | jq '.data.studioConfig.branding.title'
```

### Server Logs
Enable debug logging in your development environment:
```bash
DEBUG=trokky:* npm run dev
```

This will show detailed logs for structure loading, API calls, and authentication.