# Chess Notation OCR Infrastructure Setup Guide

## Overview

This guide walks you through setting up the AWS infrastructure for the Chess Notation OCR system.

## Prerequisites

- AWS CLI installed and configured (`aws configure`)
- AWS account with appropriate permissions
- Bash shell (Linux, macOS, or WSL on Windows)

## Quick Start

### Automated Deployment

The easiest way to set up the infrastructure is using the automated deployment script:

```bash
cd onetris/infrastructure
./deploy-infrastructure.sh
```

This script will:
1. Create the DynamoDB table for workflow state tracking
2. Create the S3 bucket with encryption and CORS
3. Configure S3 security settings
4. Create IAM roles and policies for Lambda execution

### Manual Deployment

If you prefer to deploy resources manually, follow the steps in [README.md](./README.md).

## Infrastructure Components

### 1. DynamoDB Table: ChessNotationOCRWorkflows

Stores workflow state for each OCR job.

**Schema:**
- `workflowId` (String, Partition Key): Unique identifier for each workflow
- `status` (String): Current workflow status
- `createdAt` (Number): Unix timestamp of creation
- `updatedAt` (Number): Unix timestamp of last update
- `s3Key` (String): S3 object key for uploaded image
- `s3Bucket` (String): S3 bucket name
- `textractJobId` (String): AWS Textract job identifier
- `extractedText` (String): OCR results
- `confidence` (Number): Average confidence score
- `errorMessage` (String): Error details if failed
- `ttl` (Number): Expiration timestamp (30 days)

### 2. S3 Bucket: chess-notation-uploads

Stores uploaded chess notation images.

**Configuration:**
- Server-side encryption (AES256)
- CORS enabled for web uploads
- Public access blocked
- 30-day lifecycle policy for automatic cleanup

### 3. IAM Role: ChessNotationOCRLambdaRole

Grants Lambda function permissions to:
- Read/write S3 objects
- Invoke AWS Textract
- Read/write DynamoDB items
- Write CloudWatch logs

## Verification

After deployment, verify the resources:

```bash
# Check DynamoDB table
aws dynamodb describe-table --table-name ChessNotationOCRWorkflows

# Check S3 bucket
aws s3api head-bucket --bucket chess-notation-uploads

# Check IAM role
aws iam get-role --role-name ChessNotationOCRLambdaRole
```

## Configuration

### Environment Variables

The Lambda function requires these environment variables:

```
S3_BUCKET_NAME=chess-notation-uploads
DYNAMODB_TABLE_NAME=ChessNotationOCRWorkflows
AWS_REGION=us-east-1
```

### CORS Configuration

The S3 bucket is configured to allow uploads from:
- `https://enjoylearningchess.com` (production)
- `http://localhost:3000` (development)

To add additional origins, update `s3-bucket-config.json` and reapply:

```bash
aws s3api put-bucket-cors \
  --bucket chess-notation-uploads \
  --cors-configuration file://s3-bucket-config.json
```

## Security

### Encryption
- All S3 objects are encrypted at rest using AES256
- Data in transit uses HTTPS

### Access Control
- S3 bucket blocks all public access
- Pre-signed URLs expire after 5 minutes
- IAM role follows principle of least privilege

### Data Retention
- Uploaded images are automatically deleted after 30 days
- DynamoDB items expire after 30 days via TTL

## Monitoring

### CloudWatch Logs

Lambda execution logs are automatically sent to CloudWatch:

```bash
# View recent logs
aws logs tail /aws/lambda/ChessNotationOCRProcessor --follow
```

### Metrics

Monitor key metrics in CloudWatch:
- Lambda invocations and errors
- DynamoDB read/write capacity
- S3 request metrics
- Textract API calls

## Troubleshooting

### Common Issues

**Issue: S3 bucket already exists**
- Bucket names are globally unique
- Choose a different name in the configuration files

**Issue: IAM permissions denied**
- Ensure your AWS user has permissions to create IAM roles
- May require administrator access

**Issue: CORS errors in browser**
- Verify CORS configuration includes your domain
- Check browser console for specific CORS error

**Issue: Lambda timeout**
- Increase Lambda timeout in function configuration
- Default is 30 seconds, may need more for large images

## Cleanup

To delete all infrastructure resources:

```bash
cd onetris/infrastructure
./cleanup-infrastructure.sh
```

**WARNING:** This will permanently delete all data and resources.

## Cost Estimation

Estimated monthly costs (assuming 1000 uploads/month):

- **DynamoDB**: ~$0.25 (pay-per-request)
- **S3**: ~$0.10 (storage + requests)
- **Lambda**: ~$0.20 (compute time)
- **Textract**: ~$1.50 (1000 pages at $0.0015/page)

**Total: ~$2.05/month**

Costs scale with usage. The pay-per-request model means no charges when idle.

## Next Steps

After infrastructure setup:

1. Deploy the Lambda function (see `../lambdas/chess-notation-ocr/`)
2. Configure S3 event trigger to invoke Lambda
3. Update frontend with API endpoint URL
4. Test the complete workflow

## Support

For issues or questions:
- Check CloudWatch logs for error details
- Review AWS service quotas and limits
- Consult AWS documentation for specific services

## References

- [AWS DynamoDB Documentation](https://docs.aws.amazon.com/dynamodb/)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [AWS Textract Documentation](https://docs.aws.amazon.com/textract/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
