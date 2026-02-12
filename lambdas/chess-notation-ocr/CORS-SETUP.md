# CORS Configuration

## How It Works

The Lambda function now uses **origin-based CORS** instead of allowing all origins (`*`). This means:

1. The function checks the `Origin` header from incoming requests
2. If the origin is in the allowed list, it returns that origin in the `Access-Control-Allow-Origin` header
3. If the origin is NOT in the allowed list, it defaults to the production domain

## Allowed Origins

Currently configured to allow:
- ✅ `https://enjoylearningchess.com` (production)
- ✅ `http://localhost:8080` (your development environment)
- ✅ `http://localhost:3000` (alternate React development port)

## Benefits

1. **Works from localhost**: You can develop and test locally without changing code
2. **Works in production**: Your live site can access the API
3. **Secure**: Random websites cannot access your API
4. **No switching needed**: Same code works in both environments

## Adding More Origins

To add staging, preview, or other environments, edit `index.js`:

```javascript
function getCorsHeaders(event) {
  const allowedOrigins = [
    'https://enjoylearningchess.com',
    'http://localhost:8080',
    'http://localhost:3000',
    'https://staging.enjoylearningchess.com',  // Add this
    'https://preview.enjoylearningchess.com'   // Or this
  ];
  // ... rest of function
}
```

## Testing

To verify CORS is working:

1. **From localhost:8080**: Should work immediately
2. **From production**: Should work after deployment
3. **From random site**: Should be blocked (origin not in list)

You can test by opening browser DevTools Console and running:
```javascript
fetch('https://52y22iuzx7.execute-api.us-east-1.amazonaws.com/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'get-status', workflowId: 'test' })
})
```

## Deployment

The CORS configuration is already in the code. Just deploy:

```bash
cd onetris/lambdas/chess-notation-ocr
./deploy.sh
```

No environment variables or AWS configuration needed - it's all in the Lambda code!
