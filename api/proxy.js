/**
 * CORS Proxy for CPEE API
 * Serverless function that proxies requests to cpee.org and adds CORS headers
 * Deploy to Vercel for free hosting
 */

module.exports = async function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get the target URL from query parameter
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    // Validate that the URL is from cpee.org (security measure)
    try {
        const url = new URL(targetUrl);
        if (!url.hostname.endsWith('cpee.org')) {
            return res.status(403).json({ error: 'Only cpee.org URLs are allowed' });
        }
    } catch (error) {
        return res.status(400).json({ error: 'Invalid URL' });
    }

    try {
        // Fetch from the target URL
        const response = await fetch(targetUrl, {
            headers: {
                'Accept': 'text/plain, application/x-yaml, text/yaml, application/json, */*',
                'User-Agent': 'CPEE-Log-Error-Console/1.0'
            }
        });

        // Get the response body
        const data = await response.arrayBuffer();

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

        // Set content type from original response
        const contentType = response.headers.get('content-type') || 'text/plain';
        res.setHeader('Content-Type', contentType);

        // Return the response with the same status code
        res.status(response.status).send(Buffer.from(data));
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({
            error: 'Failed to fetch from target URL',
            message: error.message
        });
    }
};
