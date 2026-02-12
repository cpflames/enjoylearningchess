# Chess Notation OCR Lambda Function

This Lambda function handles the backend processing for the chess notation OCR system. It provides multiple endpoints for managing the upload-to-OCR workflow.

## Request Types

The Lambda function handles four types of requests:

1. **generate-presigned-url**: Generate a pre-signed S3 URL for direct browser uploads
2. **s3-trigger**: Automatically triggered when an image is uploaded to S3
3. **get-status**: Check the status of an OCR workflow
4. **get-results**: Retrieve the extracted text from a completed OCR job

## Environment Variables

- `S3_BUCKET_NAME`: Name of the S3 bucket for image storage
- `DYNAMODB_TABLE_NAME`: Name of the DynamoDB table for workflow state tracking

## Deployment

### Prerequisites

1. AWS CLI installed and configured with appropriate credentials
2. Node.js 18.x or later installed
3. Infrastructure resources deployed (S3 bucket, DynamoDB table, IAM role)

### Quick Deployment

The easiest way to deploy is using the automated deployment script:

```bash
# Make sure you're in the Lambda directory
cd onetris/lambdas/chess-notation-ocr

# Run the deployment script
./deploy.sh
```

This script will:
1. Install production dependencies
2. Run tests to ensure code quality
3. Create a deployment package (function.zip)
4. Deploy or update the Lambda function
5. Configure S3 trigger for automatic OCR processing
6. Create a Function URL for API access
7. Display the Function URL for frontend integration

### Manual Deployment

If you prefer manual deployment:

1. Install dependencies:
   ```bash
   npm install --production
   ```

2. Run tests:
   ```bash
   npm test
   ```

3. Create deployment package:
   ```bash
   npm run package
   ```

4. Upload to AWS Lambda:
   ```bash
   aws lambda update-function-code \
     --function-name ChessNotationOCR \
     --zip-file fileb://function.zip \
     --region us-east-1
   ```

### Environment Variables

The Lambda function requires the following environment variables:

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `S3_BUCKET_NAME` | S3 bucket for image storage | `chess-notation-uploads` |
| `DYNAMODB_TABLE_NAME` | DynamoDB table for workflow state | `ChessNotationOCRWorkflows` |
| `AWS_REGION` | AWS region for resources | `us-east-1` |

These are automatically configured by the deployment script. For manual configuration:

```bash
aws lambda update-function-configuration \
  --function-name ChessNotationOCR \
  --environment "Variables={S3_BUCKET_NAME=chess-notation-uploads,DYNAMODB_TABLE_NAME=ChessNotationOCRWorkflows,AWS_REGION=us-east-1}"
```

### Infrastructure Setup

Before deploying the Lambda function, ensure infrastructure is set up:

```bash
cd ../../infrastructure
./deploy-infrastructure.sh
```

This creates:
- DynamoDB table for workflow state
- S3 bucket with encryption and CORS
- IAM role with necessary permissions

## Configuration

- **Runtime**: Node.js 18.x or later
- **Memory**: 512 MB
- **Timeout**: 30 seconds
- **IAM Permissions Required**:
  - S3: GetObject, PutObject
  - Textract: DetectDocumentText, GetDocumentTextDetection
  - DynamoDB: PutItem, GetItem, UpdateItem
  - CloudWatch Logs: CreateLogGroup, CreateLogStream, PutLogEvents

## Deployment Package Contents

The `function.zip` deployment package includes:

- `index.js` - Main Lambda handler with request routing
- `presignedUrlGenerator.js` - Pre-signed URL generation logic
- `s3EventHandler.js` - S3 event processing
- `textractOrchestrator.js` - Textract job management
- `workflowStateManager.js` - DynamoDB state management
- `errorLogger.js` - Structured error logging
- `fileValidator.js` - File validation utilities
- `node_modules/` - Production dependencies (aws-sdk, uuid)

Test files (`*.test.js`) are excluded from the deployment package.

## S3 Trigger Configuration

Configure the Lambda to be triggered by S3 object creation events:
- **Event type**: ObjectCreated (All)
- **Prefix**: notation-uploads/
- **Suffix**: (leave empty to match all file types)

## Testing

Run unit tests:
```bash
npm test
```

## Architecture

The Lambda follows a request routing pattern where:
1. The main handler determines the request type
2. Routes to the appropriate handler function
3. Each handler implements specific business logic
4. All errors are caught and formatted consistently
5. All responses include CORS headers for browser access
