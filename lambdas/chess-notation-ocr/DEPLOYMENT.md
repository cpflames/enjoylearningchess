# Chess Notation OCR Lambda - Deployment Guide

This guide provides step-by-step instructions for deploying the Chess Notation OCR Lambda function.

## Prerequisites

Before deploying, ensure you have:

- [x] AWS CLI installed (`aws --version`)
- [x] AWS credentials configured (`aws configure`)
- [x] Node.js 18.x or later (`node --version`)
- [x] Infrastructure deployed (see `../../infrastructure/deploy-infrastructure.sh`)

## Deployment Steps

### 1. Deploy Infrastructure (First Time Only)

If you haven't deployed the infrastructure yet:

```bash
cd ../../infrastructure
./deploy-infrastructure.sh
cd ../lambdas/chess-notation-ocr
```

This creates:
- DynamoDB table: `ChessNotationOCRWorkflows`
- S3 bucket: `chess-notation-uploads`
- IAM role: `ChessNotationOCRLambdaRole`

### 2. Deploy Lambda Function

Run the automated deployment script:

```bash
./deploy.sh
```

The script will:
1. ✓ Verify AWS credentials
2. ✓ Install production dependencies
3. ✓ Run tests
4. ✓ Create deployment package
5. ✓ Deploy/update Lambda function
6. ✓ Configure S3 trigger
7. ✓ Create Function URL
8. ✓ Display deployment summary

### 3. Note the Function URL

At the end of deployment, you'll see output like:

```
Function URL (for API calls):
  https://abc123xyz.lambda-url.us-east-1.on.aws/
```

**Important**: Copy this URL - you'll need it for the frontend configuration.

### 4. Update Frontend Configuration

Update the frontend API client with the Function URL:

```typescript
// In onetris/src/api/chessNotationOcrClient.ts
const API_ENDPOINT = 'https://YOUR-FUNCTION-URL.lambda-url.us-east-1.on.aws/';
```

## Verification

### Automated Configuration Verification

Run the automated verification script to check all configuration settings:

```bash
./verify-config.sh
```

This script verifies:
- ✓ Lambda function exists
- ✓ Memory size (512MB)
- ✓ Timeout (30 seconds)
- ✓ Environment variables (S3_BUCKET_NAME, DYNAMODB_TABLE_NAME, AWS_REGION)
- ✓ S3 trigger configuration
- ✓ IAM role assignment

### Manual Verification

1. **Check Lambda function exists:**
   ```bash
   aws lambda get-function --function-name ChessNotationOCR
   ```

2. **Check environment variables:**
   ```bash
   aws lambda get-function-configuration --function-name ChessNotationOCR --query 'Environment'
   ```

3. **Check S3 trigger:**
   ```bash
   aws s3api get-bucket-notification-configuration --bucket chess-notation-uploads
   ```

4. **Test the Function URL:**
   ```bash
   curl -X POST https://YOUR-FUNCTION-URL/ \
     -H "Content-Type: application/json" \
     -d '{"type":"generate-presigned-url","fileName":"test.jpg","fileType":"image/jpeg"}'
   ```

### Monitor Logs

View Lambda execution logs:

```bash
aws logs tail /aws/lambda/ChessNotationOCR --follow
```

## Updating the Function

To deploy code changes:

```bash
./deploy.sh
```

The script automatically detects if the function exists and updates it.

## Configuration Reference

For detailed information about Lambda configuration settings, see [LAMBDA_CONFIG.md](./LAMBDA_CONFIG.md).

### Lambda Configuration

| Setting | Value |
|---------|-------|
| Function Name | `ChessNotationOCR` |
| Runtime | Node.js 18.x |
| Memory | 512 MB |
| Timeout | 30 seconds |
| Handler | `index.handler` |

### Environment Variables

| Variable | Value |
|----------|-------|
| `S3_BUCKET_NAME` | `chess-notation-uploads` |
| `DYNAMODB_TABLE_NAME` | `ChessNotationOCRWorkflows` |
| `AWS_REGION` | `us-east-1` |

### IAM Permissions

The Lambda execution role has permissions for:
- S3: Read/write objects in the chess-notation-uploads bucket
- Textract: Detect and retrieve document text
- DynamoDB: Read/write workflow state
- CloudWatch Logs: Write execution logs

## Troubleshooting

### Deployment Fails

**Error: "Role not found"**
- Solution: Run infrastructure deployment first: `../../infrastructure/deploy-infrastructure.sh`

**Error: "AWS credentials not configured"**
- Solution: Run `aws configure` and enter your credentials

**Error: "Tests failed"**
- Solution: Fix failing tests before deploying: `npm test`

### Function Not Working

**Check CloudWatch Logs:**
```bash
aws logs tail /aws/lambda/ChessNotationOCR --follow
```

**Verify Environment Variables:**
```bash
aws lambda get-function-configuration --function-name ChessNotationOCR
```

**Test S3 Trigger:**
Upload a test file to S3 and check if Lambda is invoked:
```bash
aws s3 cp test.jpg s3://chess-notation-uploads/notation-uploads/test.jpg
```

### Permission Issues

**Error: "Access Denied" in logs**
- Check IAM role has correct permissions
- Verify S3 bucket policy allows Lambda access
- Ensure DynamoDB table exists and is accessible

## Rollback

To rollback to a previous version:

```bash
# List function versions
aws lambda list-versions-by-function --function-name ChessNotationOCR

# Update alias to point to previous version
aws lambda update-alias \
  --function-name ChessNotationOCR \
  --name PROD \
  --function-version <previous-version-number>
```

## Clean Up

To remove all resources:

```bash
# Delete Lambda function
aws lambda delete-function --function-name ChessNotationOCR

# Delete infrastructure (S3, DynamoDB, IAM)
# Note: This will delete all uploaded images and workflow data
cd ../../infrastructure
./cleanup-infrastructure.sh  # (if available)
```

## Support

For issues or questions:
1. Check CloudWatch logs for error details
2. Review the README.md for architecture details
3. Verify all prerequisites are met
4. Ensure infrastructure is properly deployed

