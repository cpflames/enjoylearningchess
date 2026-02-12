# Chess Notation OCR Infrastructure

This directory contains AWS infrastructure configuration files for the Chess Notation OCR system.

## Files

### dynamodb-table.json
DynamoDB table definition for workflow state tracking.

**Table Name:** `ChessNotationOCRWorkflows`

**Key Schema:**
- Partition Key: `workflowId` (String)

**Features:**
- Pay-per-request billing mode for cost efficiency
- TTL enabled on `ttl` attribute for automatic cleanup after 30 days
- Tagged for project identification

**To create the table:**
```bash
aws dynamodb create-table --cli-input-json file://dynamodb-table.json
```

### s3-bucket-config.json
S3 bucket configuration with encryption and CORS settings.

**Bucket Name:** `chess-notation-uploads`

**Features:**
- Server-side encryption (AES256) enabled by default
- CORS configured for enjoylearningchess.com and localhost:3000
- Public access blocked for security
- Lifecycle policy to delete uploads after 30 days
- Tagged for project identification

**To create the bucket:**
```bash
# Create bucket
aws s3api create-bucket --bucket chess-notation-uploads --region us-east-1

# Apply encryption
aws s3api put-bucket-encryption \
  --bucket chess-notation-uploads \
  --server-side-encryption-configuration file://s3-bucket-config.json

# Apply CORS
aws s3api put-bucket-cors \
  --bucket chess-notation-uploads \
  --cors-configuration file://s3-bucket-config.json

# Apply public access block
aws s3api put-public-access-block \
  --bucket chess-notation-uploads \
  --public-access-block-configuration file://s3-bucket-config.json

# Apply lifecycle policy
aws s3api put-bucket-lifecycle-configuration \
  --bucket chess-notation-uploads \
  --lifecycle-configuration file://s3-bucket-config.json
```

### iam-policies.json
IAM roles and policies for Lambda execution.

**Role Name:** `ChessNotationOCRLambdaRole`

**Permissions:**
- S3: Read/write access to chess-notation-uploads bucket
- Textract: Detect and retrieve document text
- DynamoDB: Read/write access to ChessNotationOCRWorkflows table
- CloudWatch Logs: Create log groups and streams

**To create the role:**
```bash
# Create the role
aws iam create-role \
  --role-name ChessNotationOCRLambdaRole \
  --assume-role-policy-document file://iam-policies.json

# Attach managed policy
aws iam attach-role-policy \
  --role-name ChessNotationOCRLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create and attach inline policy
aws iam put-role-policy \
  --role-name ChessNotationOCRLambdaRole \
  --policy-name ChessNotationOCRPolicy \
  --policy-document file://iam-policies.json
```

## Deployment Order

1. Create DynamoDB table
2. Create S3 bucket and apply configurations
3. Create IAM role and policies
4. Deploy Lambda function (see ../lambdas/chess-notation-ocr/)
5. Configure S3 event trigger for Lambda

## Environment Variables

The Lambda function requires the following environment variables:

- `S3_BUCKET_NAME`: chess-notation-uploads
- `DYNAMODB_TABLE_NAME`: ChessNotationOCRWorkflows
- `AWS_REGION`: us-east-1 (or your preferred region)

## Security Considerations

- All S3 objects are encrypted at rest using AES256
- Public access to S3 bucket is blocked
- Pre-signed URLs expire after 5 minutes
- Workflow data automatically expires after 30 days
- IAM role follows principle of least privilege
- CORS is restricted to specific origins

## Monitoring

CloudWatch Logs are automatically created for:
- Lambda function execution logs
- Error tracking and debugging
- Performance metrics

## Cost Optimization

- DynamoDB uses pay-per-request billing (no idle costs)
- S3 lifecycle policy deletes old uploads automatically
- TTL on DynamoDB items prevents data accumulation
- Lambda execution time optimized through direct S3 uploads

## Tags

All resources are tagged with:
- Project: ChessNotationOCR
- Environment: Production

This enables cost tracking and resource management.
