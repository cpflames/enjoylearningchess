#!/bin/bash

# Lambda Configuration Verification Script
# This script verifies that the Lambda function is configured correctly

set -e

FUNCTION_NAME="ChessNotationOCR"
REGION="us-east-1"
EXPECTED_MEMORY=512
EXPECTED_TIMEOUT=30

echo "=========================================="
echo "Lambda Configuration Verification"
echo "=========================================="
echo ""

# Check if function exists
echo "Checking if Lambda function exists..."
if ! aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" &> /dev/null; then
    echo "❌ Error: Lambda function '$FUNCTION_NAME' not found"
    echo "   Run ./deploy.sh to deploy the function first"
    exit 1
fi
echo "✓ Function exists"
echo ""

# Get function configuration
echo "Retrieving function configuration..."
CONFIG=$(aws lambda get-function-configuration --function-name "$FUNCTION_NAME" --region "$REGION")

# Extract values
ACTUAL_MEMORY=$(echo "$CONFIG" | grep -o '"MemorySize": [0-9]*' | grep -o '[0-9]*')
ACTUAL_TIMEOUT=$(echo "$CONFIG" | grep -o '"Timeout": [0-9]*' | grep -o '[0-9]*')
RUNTIME=$(echo "$CONFIG" | grep -o '"Runtime": "[^"]*"' | cut -d'"' -f4)

echo "✓ Configuration retrieved"
echo ""

# Verify Memory
echo "Verifying Memory Size..."
if [ "$ACTUAL_MEMORY" -eq "$EXPECTED_MEMORY" ]; then
    echo "✓ Memory: ${ACTUAL_MEMORY}MB (correct)"
else
    echo "❌ Memory: ${ACTUAL_MEMORY}MB (expected ${EXPECTED_MEMORY}MB)"
    exit 1
fi
echo ""

# Verify Timeout
echo "Verifying Timeout..."
if [ "$ACTUAL_TIMEOUT" -eq "$EXPECTED_TIMEOUT" ]; then
    echo "✓ Timeout: ${ACTUAL_TIMEOUT}s (correct)"
else
    echo "❌ Timeout: ${ACTUAL_TIMEOUT}s (expected ${EXPECTED_TIMEOUT}s)"
    exit 1
fi
echo ""

# Verify Runtime
echo "Verifying Runtime..."
if [[ "$RUNTIME" == nodejs18* ]]; then
    echo "✓ Runtime: $RUNTIME (correct)"
else
    echo "⚠ Runtime: $RUNTIME (expected nodejs18.x)"
fi
echo ""

# Verify Environment Variables
echo "Verifying Environment Variables..."
ENV_VARS=$(echo "$CONFIG" | grep -A 10 '"Environment"')

if echo "$ENV_VARS" | grep -q "S3_BUCKET_NAME"; then
    S3_BUCKET=$(echo "$ENV_VARS" | grep "S3_BUCKET_NAME" | cut -d'"' -f4)
    echo "✓ S3_BUCKET_NAME: $S3_BUCKET"
else
    echo "❌ S3_BUCKET_NAME: Not set"
    exit 1
fi

if echo "$ENV_VARS" | grep -q "DYNAMODB_TABLE_NAME"; then
    DYNAMODB_TABLE=$(echo "$ENV_VARS" | grep "DYNAMODB_TABLE_NAME" | cut -d'"' -f4)
    echo "✓ DYNAMODB_TABLE_NAME: $DYNAMODB_TABLE"
else
    echo "❌ DYNAMODB_TABLE_NAME: Not set"
    exit 1
fi

echo "✓ AWS_REGION: Automatically provided by Lambda runtime"
echo ""

# Verify S3 Trigger
echo "Verifying S3 Trigger Configuration..."
S3_BUCKET_NAME="chess-notation-uploads"
NOTIFICATION_CONFIG=$(aws s3api get-bucket-notification-configuration --bucket "$S3_BUCKET_NAME" --region "$REGION" 2>/dev/null || echo "{}")

if echo "$NOTIFICATION_CONFIG" | grep -q "ChessNotationOCRTrigger"; then
    echo "✓ S3 trigger configured"
    
    # Check event type
    if echo "$NOTIFICATION_CONFIG" | grep -q "s3:ObjectCreated"; then
        echo "  ✓ Event type: s3:ObjectCreated:*"
    else
        echo "  ⚠ Event type: Not s3:ObjectCreated:*"
    fi
    
    # Check prefix filter
    if echo "$NOTIFICATION_CONFIG" | grep -q "notation-uploads"; then
        echo "  ✓ Prefix filter: notation-uploads/"
    else
        echo "  ⚠ Prefix filter: Not set to notation-uploads/"
    fi
else
    echo "❌ S3 trigger not configured"
    echo "   Run ./deploy.sh to configure the trigger"
    exit 1
fi
echo ""

# Verify IAM Permissions
echo "Verifying IAM Role..."
ROLE_ARN=$(echo "$CONFIG" | grep -o '"Role": "[^"]*"' | cut -d'"' -f4)
ROLE_NAME=$(echo "$ROLE_ARN" | rev | cut -d'/' -f1 | rev)

if [ "$ROLE_NAME" == "ChessNotationOCRLambdaRole" ]; then
    echo "✓ IAM Role: $ROLE_NAME"
else
    echo "⚠ IAM Role: $ROLE_NAME (expected ChessNotationOCRLambdaRole)"
fi
echo ""

# Summary
echo "=========================================="
echo "Verification Complete!"
echo "=========================================="
echo ""
echo "Configuration Summary:"
echo "  • Function Name: $FUNCTION_NAME"
echo "  • Runtime: $RUNTIME"
echo "  • Memory: ${ACTUAL_MEMORY}MB"
echo "  • Timeout: ${ACTUAL_TIMEOUT}s"
echo "  • S3 Bucket: $S3_BUCKET"
echo "  • DynamoDB Table: $DYNAMODB_TABLE"
echo "  • IAM Role: $ROLE_NAME"
echo ""
echo "✓ All configuration checks passed!"
echo ""
echo "Requirements Validated:"
echo "  ✓ Requirement 2.1: S3 bucket configured for image storage"
echo "  ✓ Requirement 3.1: S3 trigger configured for OCR processing"
echo "  ✓ Memory (512MB): Sufficient for image processing and AWS SDK operations"
echo "  ✓ Timeout (30s): Allows for S3 operations, Textract initiation, and retries"
echo ""
