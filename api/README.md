# CPEE CORS Proxy

This directory contains a serverless CORS proxy for the CPEE API.

## What It Does

- Proxies requests to `cpee.org` and adds CORS headers
- Prevents rate limiting from public CORS proxies
- More reliable than third-party proxies
- Free to host on Vercel

## Deployment Instructions

### Option 1: Deploy to Vercel (Recommended)

1. **Install Vercel CLI** (if you haven't already):
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy from the project root**:
   ```bash
   cd cpee-log-error-console
   vercel
   ```

4. **Follow the prompts**:
   - Set up and deploy? Yes
   - Which scope? Your account
   - Link to existing project? No
   - Project name? cpee-cors-proxy (or your choice)
   - Directory? ./ (current directory)
   - Override settings? No

5. **Your proxy will be deployed!** You'll get a URL like:
   ```
   https://cpee-cors-proxy.vercel.app
   ```

6. **Update ConfigManager.js**:
   ```javascript
   proxy: 'https://cpee-cors-proxy.vercel.app/api/proxy?url=',
   logProxy: 'https://cpee-cors-proxy.vercel.app/api/proxy?url=',
   ```

### Option 2: Deploy via Vercel Dashboard

1. Go to https://vercel.com
2. Sign up/Login with GitHub
3. Click "Add New" → "Project"
4. Import your GitHub repository
5. Vercel will auto-detect the configuration
6. Click "Deploy"

### Option 3: Deploy to Netlify

1. Create `netlify/functions/proxy.js`:
   ```javascript
   exports.handler = async (event) => {
       // Same logic as api/proxy.js
   };
   ```

2. Deploy to Netlify

## Usage

Once deployed, use your proxy URL:

```
https://your-proxy.vercel.app/api/proxy?url=https://cpee.org/logs/UUID.xes.yaml
```

## Security

- Only allows requests to `cpee.org` domains
- Only allows GET requests
- Validates URLs before proxying

## Rate Limits

Vercel Free Tier:
- 100GB bandwidth/month
- Unlimited requests
- No rate limits per IP

This should be more than enough for your use case!
