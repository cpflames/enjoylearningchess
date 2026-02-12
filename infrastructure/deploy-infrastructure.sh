#!/bin/bash

# Chess Notation OCR Infrastructure Deployment Script
# This script automates the deployment of AWS infrastructure components

set -e  # Exit on error

# Configuration
REGION="us-east-1"
BUCKET_NAME="chess-notation-uploads"
TABLE_NAME="ChessNotationOCRWorkflows"
ROLE_NAME="ChessNotationOCRLambdaRole"

echo "=========================================="
echo "Chess Notation OCR Infrastructure Setup"
echo "=========================================="
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check AWS credentials
echo "Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo "Error: AWS credentials not configured. Run 'aws configure' first."
    exit 1
fi
echo "✓ AWS credentials verified"
echo ""

# Step 1: Create DynamoDB Table
echo "Step 1: Creating DynamoDB table..."
if aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" &> /dev/null; then
    echo "⚠ Table $TABLE_NAME already exists, skipping..."
else
    aws dynamodb create-table \
        --cli-input-json file://dynamodb-table.json \
        --region "$REGION"
    echo "✓ DynamoDB table created: $TABLE_NAME"
    
    # Wait for table to be active
    echo "  Waiting for table to become active..."
    aws dynamodb wait table-exists --table-name "$TABLE_NAME" --region "$REGION"
    echo "  ✓ Table is active"
    
    # Enable TTL
    echo "  Enabling Time-To-Live..."
    aws dynamodb update-time-to-live \
        --table-name "$TABLE_NAME" \
        --time-to-live-specification "Enabled=true,AttributeName=ttl" \
        --region "$REGION"
    echo "  ✓ TTL enabled"
fi
echo ""

# Step 2: Create S3 Bucket
echo "Step 2: Creating S3 bucket..."
if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
    echo "⚠ Bucket $BUCKET_NAME already exists, skipping creation..."
else
    aws s3api create-bucket \
        --bucket "$BUCKET_NAME" \
        --region "$REGION"
    echo "✓ S3 bucket created: $BUCKET_NAME"
fi
echo ""

# Step 3: Configure S3 Encryption
echo "Step 3: Configuring S3 encryption..."
aws s3api put-bucket-encryption \
    --bucket "$BUCKET_NAME" \
    --server-side-encryption-configuration '{
        "Rules": [{
            "ApplyServerSideEncryptionByDefault": {
                "SSEAlgorithm": "AES256"
            },
            "BucketKeyEnabled": true
        }]
    }'
echo "✓ S3 encryption configured"
echo ""

# Step 4: Configure S3 CORS
echo "Step 4: Configuring S3 CORS..."
aws s3api put-bucket-cors \
    --bucket "$BUCKET_NAME" \
    --cors-configuration '{
        "CORSRules": [{
            "AllowedOrigins": ["https://enjoylearningchess.com", "http://localhost:3000"],
            "AllowedMethods": ["PUT", "POST", "GET"],
            "AllowedHeaders": ["*"],
            "ExposeHeaders": ["ETag"],
            "MaxAgeSeconds": 3000
        }]
    }'
echo "✓ S3 CORS configured"
echo ""

# Step 5: Block S3 Public Access
echo "Step 5: Blocking S3 public access..."
aws s3api put-public-access-block \
    --bucket "$BUCKET_NAME" \
    --public-access-block-configuration \
        "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
echo "✓ S3 public access blocked"
echo ""

# Step 6: Configure S3 Lifecycle Policy
echo "Step 6: Configuring S3 lifecycle policy..."
aws s3api put-bucket-lifecycle-configuration \
    --bucket "$BUCKET_NAME" \
    --lifecycle-configuration '{
        "Rules": [{
            "ID": "DeleteOldUploads",
            "Status": "Enabled",
            "Prefix": "notation-uploads/",
            "Expiration": {
                "Days": 30
            }
        }]
    }'
echo "✓ S3 lifecycle policy configured"
echo ""

# Step 7: Create IAM Role
echo "Step 7: Creating IAM role..."
if aws iam get-role --role-name "$ROLE_NAME" &> /dev/null; then
    echo "⚠ Role $ROLE_NAME already exists, skipping..."
else
    aws iam create-role \
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document '{
            "Version": "2012-10-17",
            "Statement": [{
                "Effect": "Allow",
                "Principal": {"Service": "lambda.amazonaws.com"},
                "Action": "sts:AssumeRole"
            }]
        }' \
        --tags Key=Project,Value=ChessNotationOCR Key=Environment,Value=Production
    echo "✓ IAM role created: $ROLE_NAME"
fi
echo ""

# Step 8: Attach Managed Policy
echo "Step 8: Attaching managed policies..."
aws iam attach-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" \
    2>/dev/null || echo "  Policy already attached"
echo "✓ Managed policies attached"
echo ""

# Step 9: Create and Attach Inline Policy
echo "Step 9: Creating inline policy..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws iam put-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-name ChessNotationOCRPolicy \
    --policy-document "{
        \"Version\": \"2012-10-17\",
        \"Statement\": [
            {
                \"Sid\": \"S3Access\",
                \"Effect\": \"Allow\",
                \"Action\": [
                    \"s3:GetObject\",
                    \"s3:PutObject\",
                    \"s3:PutObjectAcl\",
                    \"s3:GetObjectMetadata\"
                ],
                \"Resource\": \"arn:aws:s3:::${BUCKET_NAME}/*\"
            },
            {
                \"Sid\": \"S3BucketAccess\",
                \"Effect\": \"Allow\",
                \"Action\": [\"s3:ListBucket\"],
                \"Resource\": \"arn:aws:s3:::${BUCKET_NAME}\"
            },
            {
                \"Sid\": \"TextractAccess\",
                \"Effect\": \"Allow\",
                \"Action\": [
                    \"textract:DetectDocumentText\",
                    \"textract:GetDocumentTextDetection\"
                ],
                \"Resource\": \"*\"
            },
            {
                \"Sid\": \"DynamoDBAccess\",
                \"Effect\": \"Allow\",
                \"Action\": [
                    \"dynamodb:PutItem\",
                    \"dynamodb:GetItem\",
                    \"dynamodb:UpdateItem\",
                    \"dynamodb:Query\"
                ],
                \"Resource\": \"arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${TABLE_NAME}\"
            },
            {
                \"Sid\": \"CloudWatchLogs\",
                \"Effect\": \"Allow\",
                \"Action\": [
                    \"logs:CreateLogGroup\",
                    \"logs:CreateLogStream\",
                    \"logs:PutLogEvents\"
                ],
                \"Resource\": \"arn:aws:logs:${REGION}:${ACCOUNT_ID}:*\"
            }
        ]
    }"
echo "✓ Inline policy created"
echo ""

# Summary
echo "=========================================="
echo "Infrastructure Setup Complete!"
echo "=========================================="
echo ""
echo "Resources created:"
echo "  • DynamoDB Table: $TABLE_NAME"
echo "  • S3 Bucket: $BUCKET_NAME"
echo "  • IAM Role: $ROLE_NAME"
echo ""
echo "Next steps:"
echo "  1. Deploy Lambda function (see ../lambdas/chess-notation-ocr/)"
echo "  2. Configure S3 event trigger for Lambda"
echo "  3. Update frontend with API endpoint"
echo ""
echo "Environment variables for Lambda:"
echo "  S3_BUCKET_NAME=$BUCKET_NAME"
echo "  DYNAMODB_TABLE_NAME=$TABLE_NAME"
echo "  AWS_REGION=$REGION"
echo ""
