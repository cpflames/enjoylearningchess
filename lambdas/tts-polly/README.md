# TTS Polly Lambda Function

This Lambda function provides text-to-speech functionality using Amazon Polly's neural engine with the Joanna voice.

## Features

- Converts text (words) to speech using AWS Polly
- Uses neural engine for natural-sounding pronunciation
- Returns base64-encoded MP3 audio data
- Includes comprehensive error handling for Polly API failures
- CORS-enabled for frontend access

## Deployment Steps

### 1. Install Dependencies
```bash
cd onetris/lambdas/tts-polly
npm install
```

### 2. Create Deployment Package
```bash
zip -r function.zip index.js node_modules package.json
```

### 3. Create Lambda Function in AWS Console
1. Go to AWS Lambda console
2. Click "Create function"
3. Choose "Author from scratch"
4. Function name: `tts-polly`
5. Runtime: Node.js 18.x (or latest)
6. Architecture: x86_64
7. Click "Create function"

### 4. Upload Code
1. In the Lambda function page, go to "Code" tab
2. Click "Upload from" → ".zip file"
3. Upload the `function.zip` file
4. Click "Save"

### 5. Configure IAM Role
Your Lambda's execution role needs Polly permissions. Add this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "polly:SynthesizeSpeech"
      ],
      "Resource": "*"
    }
  ]
}
```

To add the policy:
1. Go to IAM console
2. Find the Lambda execution role (usually named like `tts-polly-role-xxxxx`)
3. Click "Add permissions" → "Create inline policy"
4. Use JSON editor and paste the policy above
5. Name it `PollyAccess` and save

### 6. Configure Function Settings
1. **Timeout**: Set to 10 seconds (Configuration → General configuration → Edit)
2. **Memory**: 256 MB is sufficient

### 7. Create API Gateway Endpoint
1. Go to API Gateway console
2. Create new REST API or use existing one
3. Create new resource: `/tts`
4. Create POST method for `/tts`
5. Integration type: Lambda Function
6. Select your `tts-polly` function
7. Enable CORS:
   - Select the `/tts` resource
   - Actions → Enable CORS
   - Accept defaults and confirm
8. Deploy API to a stage (e.g., `prod`)
9. Note the Invoke URL (e.g., `https://xxxxx.execute-api.us-east-1.amazonaws.com/prod/tts`)

### 8. Test the Function
Use the AWS Lambda console test feature or curl:

```bash
curl -X POST https://your-api-gateway-url/tts \
  -H "Content-Type: application/json" \
  -d '{"word": "hello"}'
```

Expected response:
```json
{
  "audioContent": "base64-encoded-audio-data...",
  "contentType": "audio/mpeg"
}
```

## API Usage

### Request Format
```json
{
  "word": "spelling"
}
```

### Response Format (Success)
```json
{
  "audioContent": "//NExAAAAAANIAAAAAExBTUUzLjEwMC...",
  "contentType": "audio/mpeg"
}
```

### Response Format (Error)
```json
{
  "error": "Error message"
}
```

## Error Handling

The function handles various error scenarios:

- **400 Bad Request**: Invalid or missing word parameter
- **400 Bad Request**: Polly API validation errors (invalid SSML, text too long)
- **429 Too Many Requests**: Polly API throttling
- **500 Internal Server Error**: Other unexpected errors

## Frontend Integration

To use this Lambda from the frontend:

```javascript
async function getAudioForWord(word) {
  const response = await fetch('https://your-api-gateway-url/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ word }),
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error);
  }

  // Play the audio
  const audio = new Audio(`data:audio/mpeg;base64,${data.audioContent}`);
  await audio.play();
}
```

## Cost Considerations

- Amazon Polly Neural voices: $16 per 1 million characters
- First 1 million characters per month are free for the first 12 months
- Each word typically uses 5-15 characters
- Implement caching in the frontend to minimize API calls

## Troubleshooting

### "Missing Authentication Token" error
- Ensure API Gateway is properly configured
- Check that the endpoint URL is correct

### "User is not authorized to perform: polly:SynthesizeSpeech"
- Verify IAM role has Polly permissions
- Check the policy is attached to the Lambda execution role

### Timeout errors
- Increase Lambda timeout setting
- Check network connectivity to Polly service

### CORS errors
- Ensure CORS is enabled on API Gateway
- Verify Access-Control headers are present in responses
