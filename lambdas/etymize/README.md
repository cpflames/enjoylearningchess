# Etymize Lambda Function

This Lambda function now supports multiple request types:

1. **OpenAI requests** (`type: "openai"`) - Original etymology functionality
2. **S3 pre-signed URL generation** (`type: "s3-presigned-url"`) - For image uploads

## Deployment Steps

### 1. Install Dependencies
```bash
cd lambdas/etymize
npm install
```

### 2. Update Lambda Code
- The `index.js` file has been updated to handle multiple request types
- `package.json` now includes `aws-sdk` dependency

### 3. Update Environment Variables
Add this environment variable to your Lambda:
- `S3_BUCKET_NAME`: The name of your S3 bucket for image uploads

### 4. Update IAM Role
Your Lambda's IAM role needs these additional permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/uploads/*"
    }
  ]
}
```

### 5. Deploy
```bash
# Create deployment package
zip -r function.zip index.js node_modules package.json

# Upload to AWS Lambda (via console or CLI)
```

## API Usage

### OpenAI Request
```json
{
  "type": "openai",
  "messages": [
    {"role": "user", "content": "What is the etymology of 'chess'?"}
  ]
}
```

### S3 Pre-signed URL Request
```json
{
  "type": "s3-presigned-url",
  "fileName": "chess-notation.jpg",
  "fileType": "image/jpeg"
}
```

## Response Format

### OpenAI Response
```json
{
  "reply": "The etymology of 'chess'..."
}
```

### S3 Pre-signed URL Response
```json
{
  "presignedUrl": "https://...",
  "key": "uploads/1234567890-chess-notation.jpg",
  "bucket": "your-bucket-name"
}
```

## Next Steps

1. **OCR Integration**: Add a third request type for processing uploaded images
2. **Image Processing**: Implement chess notation extraction from uploaded images
3. **Error Handling**: Add more robust error handling and validation
