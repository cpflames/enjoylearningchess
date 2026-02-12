# Lambda Function Configuration

This document details the configuration settings for the Chess Notation OCR Lambda function.

## Function Settings

### Basic Configuration

| Setting | Value | Rationale |
|---------|-------|-----------|
| **Function Name** | `ChessNotationOCR` | Descriptive name identifying the function purpose |
| **Runtime** | Node.js 18.x | Latest LTS version with modern JavaScript features |
| **Handler** | `index.handler` | Entry point for Lambda execution |
| **Memory** | 512 MB | Sufficient for image processing and Textract API calls |
| **Timeout** | 30 seconds | Allows time for S3 operations, Textract job initiation, and DynamoDB updates |

### Memory Allocation (512 MB)

**Rationale:**
- Image file handling (up to 10MB files)
- AWS SDK operations (S3, Textract, DynamoDB)
- JSON parsing and response formatting
- Concurrent request handling

**Performance Considerations:**
- More memory = more CPU allocation in Lambda
- 512MB provides good balance between cost and performance
- Typical execution time: 2-5 seconds for pre-signed URL generation
- S3 trigger processing: 3-8 seconds including Textract job initiation

### Timeout (30 seconds)

**Rationale:**
- Pre-signed URL generation: < 1 second
- S3 event processing: 2-5 seconds
- Textract job initiation: 1-3 seconds
- DynamoDB operations: < 1 second each
- Network latency buffer: 5-10 seconds
- Retry logic with exponential backoff: up to 10 seconds

**Workflow Timing:**
- Generate pre-signed URL: ~500ms
- S3 upload (client-side): Variable (depends on file size and network)
- S3 trigger → Lambda invocation: ~1-2 seconds
- Textract job start: ~2-3 seconds
- Total Lambda execution: Typically 5-10 seconds

## Environment Variables

### Required Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `S3_BUCKET_NAME` | `chess-notation-uploads` | Target bucket for image uploads |
| `DYNAMODB_TABLE_NAME` | `ChessNotationOCRWorkflows` | Workflow state tracking table |
| `AWS_REGION` | `us-east-1` | AWS region for all resources |

### Variable Usage

**S3_BUCKET_NAME:**
- Used by `presignedUrlGenerator.js` to create upload URLs
- Used by `s3EventHandler.js` to process upload events
- Used by `textractOrchestrator.js` to specify image location

**DYNAMODB_TABLE_NAME:**
- Used by `workflowStateManager.js` for all state operations
- Stores workflow records with 30-day TTL
- Tracks status transitions and results

**AWS_REGION:**
- Ensures all AWS SDK clients use consistent region
- Required for cross-service operations (S3 → Lambda → Textract)

## S3 Trigger Configuration

### Event Configuration

| Setting | Value |
|---------|-------|
| **Event Type** | `s3:ObjectCreated:*` |
| **Prefix Filter** | `notation-uploads/` |
| **Trigger ID** | `ChessNotationOCRTrigger` |

### Trigger Behavior

**When Triggered:**
1. User uploads image to S3 via pre-signed URL
2. S3 emits ObjectCreated event
3. Lambda receives event with bucket and key information
4. Lambda extracts workflow ID from key
5. Lambda updates workflow status to "stored"
6. Lambda initiates Textract job
7. Lambda stores Textract job ID in DynamoDB

**Event Filtering:**
- Only triggers for objects in `notation-uploads/` prefix
- Prevents triggering on other bucket operations
- Ensures only user uploads are processed

**Key Format:**
```
notation-uploads/{workflowId}/{timestamp}-{originalFileName}
```

Example:
```
notation-uploads/a1b2c3d4-e5f6-7890-abcd-ef1234567890/1704067200000-chess-game.jpg
```

## IAM Permissions

The Lambda execution role (`ChessNotationOCRLambdaRole`) has the following permissions:

### S3 Permissions
- `s3:GetObject` - Read uploaded images
- `s3:PutObject` - Generate pre-signed URLs for uploads
- `s3:PutObjectAcl` - Set object permissions
- `s3:GetObjectMetadata` - Read object metadata
- `s3:ListBucket` - List bucket contents (for validation)

### Textract Permissions
- `textract:DetectDocumentText` - Start OCR jobs
- `textract:GetDocumentTextDetection` - Retrieve OCR results

### DynamoDB Permissions
- `dynamodb:PutItem` - Create workflow records
- `dynamodb:GetItem` - Retrieve workflow state
- `dynamodb:UpdateItem` - Update workflow status
- `dynamodb:Query` - Query workflows (if needed)

### CloudWatch Logs Permissions
- `logs:CreateLogGroup` - Create log groups
- `logs:CreateLogStream` - Create log streams
- `logs:PutLogEvents` - Write log events

## Function URL Configuration

### CORS Settings

| Setting | Value |
|---------|-------|
| **Allowed Origins** | `https://enjoylearningchess.com`, `http://localhost:3000` |
| **Allowed Methods** | `POST`, `GET` |
| **Allowed Headers** | `*` |
| **Max Age** | 3000 seconds |

### Authentication
- **Auth Type:** NONE (public access)
- **Rationale:** Frontend needs direct access without AWS credentials
- **Security:** Input validation and rate limiting at application level

## Monitoring and Logging

### CloudWatch Logs

**Log Group:** `/aws/lambda/ChessNotationOCR`

**Log Retention:** 7 days (default)

**Logged Information:**
- Request type and parameters
- Workflow ID for tracing
- Error details with stack traces
- Execution duration and memory usage
- AWS SDK operation results

### Metrics to Monitor

**Invocations:**
- Total invocations per hour
- Success vs. error rate
- Concurrent executions

**Duration:**
- Average execution time
- P99 execution time
- Timeout occurrences

**Errors:**
- Error count by type
- Throttling events
- Cold start frequency

**Memory:**
- Maximum memory used
- Memory utilization percentage

## Cost Optimization

### Current Configuration Cost Estimate

**Assumptions:**
- 1000 uploads per month
- Average execution time: 5 seconds
- Memory: 512 MB

**Lambda Costs:**
- Requests: 1000 × $0.20/1M = $0.0002
- Duration: 1000 × 5s × 512MB = 2,500 GB-seconds
- Compute: 2,500 × $0.0000166667 = $0.042
- **Total Lambda:** ~$0.05/month

**Other AWS Costs:**
- S3 storage: ~$0.023/GB/month
- S3 requests: ~$0.005/1000 PUT requests
- Textract: $1.50/1000 pages
- DynamoDB: Free tier covers typical usage

**Total Estimated Cost:** ~$2-3/month for 1000 uploads

### Optimization Opportunities

1. **Reduce Memory:** Test with 256MB if performance is acceptable
2. **Optimize Code:** Minimize cold start time with smaller dependencies
3. **Batch Processing:** Process multiple images in single invocation (future)
4. **Reserved Capacity:** Consider for high-volume scenarios

## Deployment

The Lambda function is deployed using the automated script:

```bash
cd onetris/lambdas/chess-notation-ocr
./deploy.sh
```

The script handles:
- ✓ Dependency installation
- ✓ Test execution
- ✓ Package creation
- ✓ Function deployment/update
- ✓ Configuration updates
- ✓ S3 trigger setup
- ✓ Function URL creation

## Validation

### Configuration Verification

**Check function settings:**
```bash
aws lambda get-function-configuration --function-name ChessNotationOCR
```

**Expected output includes:**
```json
{
  "FunctionName": "ChessNotationOCR",
  "Runtime": "nodejs18.x",
  "MemorySize": 512,
  "Timeout": 30,
  "Environment": {
    "Variables": {
      "S3_BUCKET_NAME": "chess-notation-uploads",
      "DYNAMODB_TABLE_NAME": "ChessNotationOCRWorkflows",
      "AWS_REGION": "us-east-1"
    }
  }
}
```

**Check S3 trigger:**
```bash
aws s3api get-bucket-notification-configuration --bucket chess-notation-uploads
```

**Expected output includes:**
```json
{
  "LambdaFunctionConfigurations": [{
    "Id": "ChessNotationOCRTrigger",
    "LambdaFunctionArn": "arn:aws:lambda:us-east-1:ACCOUNT_ID:function:ChessNotationOCR",
    "Events": ["s3:ObjectCreated:*"],
    "Filter": {
      "Key": {
        "FilterRules": [{
          "Name": "prefix",
          "Value": "notation-uploads/"
        }]
      }
    }
  }]
}
```

## Requirements Validation

This configuration satisfies the following requirements:

**Requirement 2.1:** Image Storage
- ✓ S3_BUCKET_NAME environment variable configured
- ✓ Lambda has permissions to generate pre-signed URLs
- ✓ Timeout allows for S3 operations with retries

**Requirement 3.1:** OCR Processing Trigger
- ✓ S3 trigger configured for ObjectCreated events
- ✓ Prefix filter ensures only uploads are processed
- ✓ Lambda has permissions to invoke Textract
- ✓ Timeout allows for Textract job initiation

**Memory and Timeout Rationale:**
- 512MB: Handles image processing and AWS SDK operations efficiently
- 30 seconds: Accommodates all workflow steps including retries
- Both values provide buffer for peak load and network latency

## Troubleshooting

### Common Issues

**Timeout Errors:**
- Check CloudWatch logs for slow operations
- Verify network connectivity to AWS services
- Consider increasing timeout if consistently hitting limit

**Memory Errors:**
- Monitor memory usage in CloudWatch
- Check for memory leaks in code
- Consider increasing memory allocation

**Permission Errors:**
- Verify IAM role has all required permissions
- Check resource ARNs in policy statements
- Ensure trust relationship allows Lambda service

**S3 Trigger Not Working:**
- Verify trigger configuration exists
- Check Lambda permission for S3 invocation
- Ensure prefix filter matches upload path
- Review CloudWatch logs for invocation errors

## References

- [AWS Lambda Configuration Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Lambda Function Scaling](https://docs.aws.amazon.com/lambda/latest/dg/invocation-scaling.html)
- [S3 Event Notifications](https://docs.aws.amazon.com/AmazonS3/latest/userguide/NotificationHowTo.html)
- [Lambda Environment Variables](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html)
