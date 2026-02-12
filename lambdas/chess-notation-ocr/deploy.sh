#!/bin/bash

# Chess Notation OCR Lambda Deployment Script
# This script packages and deploys the Lambda function to AWS

set -e  # Exit on error

# Configuration
FUNCTION_NAME="ChessNotationOCR"
REGION="us-east-1"
ROLE_NAME="ChessNotationOCRLambdaRole"
RUNTIME="nodejs18.x"
MEMORY_SIZE=512
TIMEOUT=30
S3_BUCKET_NAME="chess-notation-uploads"
DYNAMODB_TABLE_NAME="ChessNotationOCRWorkflows"

echo "=========================================="
echo "Chess Notation OCR Lambda Deployment"
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

# Step 1: Install dependencies
echo "Step 1: Installing dependencies..."
npm install --production
echo "✓ Dependencies installed"
echo ""

# Step 2: Run tests
echo "Step 2: Running tests..."
npm test
echo "✓ Tests passed"
echo ""

# Step 3: Create deployment package
echo "Step 3: Creating deployment package..."
rm -f function.zip
npm run package
echo "✓ Deployment package created: function.zip"
echo ""

# Step 4: Get IAM role ARN
echo "Step 4: Getting IAM role ARN..."
ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)
if [ -z "$ROLE_ARN" ]; then
    echo "Error: IAM role $ROLE_NAME not found. Run infrastructure deployment first."
    exit 1
fi
echo "✓ IAM role found: $ROLE_ARN"
echo ""

# Step 5: Check if Lambda function exists
echo "Step 5: Checking if Lambda function exists..."
if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" &> /dev/null; then
    echo "⚠ Function exists, updating code..."
    aws lambda update-function-code \
        --function-name "$FUNCTION_NAME" \
        --zip-file fileb://function.zip \
        --region "$REGION"
    echo "✓ Function code updated"
    
    # Wait for code update to complete
    echo "  Waiting for update to complete..."
    aws lambda wait function-updated-v2 --function-name "$FUNCTION_NAME" --region "$REGION"
    echo "  ✓ Update complete"
    
    # Update configuration
    echo "  Updating function configuration..."
    aws lambda update-function-configuration \
        --function-name "$FUNCTION_NAME" \
        --runtime "$RUNTIME" \
        --memory-size "$MEMORY_SIZE" \
        --timeout "$TIMEOUT" \
        --environment "Variables={S3_BUCKET_NAME=$S3_BUCKET_NAME,DYNAMODB_TABLE_NAME=$DYNAMODB_TABLE_NAME}" \
        --region "$REGION" \
        > /dev/null
    echo "  ✓ Configuration updated"
    
    # Wait for configuration update to complete
    echo "  Waiting for configuration update to complete..."
    aws lambda wait function-updated-v2 --function-name "$FUNCTION_NAME" --region "$REGION"
    echo "  ✓ Configuration update complete"
else
    echo "Creating new Lambda function..."
    aws lambda create-function \
        --function-name "$FUNCTION_NAME" \
        --runtime "$RUNTIME" \
        --role "$ROLE_ARN" \
        --handler index.handler \
        --zip-file fileb://function.zip \
        --memory-size "$MEMORY_SIZE" \
        --timeout "$TIMEOUT" \
        --environment "Variables={S3_BUCKET_NAME=$S3_BUCKET_NAME,DYNAMODB_TABLE_NAME=$DYNAMODB_TABLE_NAME}" \
        --region "$REGION" \
        --tags Project=ChessNotationOCR,Environment=Production
    echo "✓ Lambda function created"
    
    # Wait for function to be active
    echo "  Waiting for function to become active..."
    aws lambda wait function-active-v2 --function-name "$FUNCTION_NAME" --region "$REGION"
    echo "  ✓ Function is active"
fi
echo ""

# Step 6: Configure S3 trigger
echo "Step 6: Configuring S3 trigger..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
LAMBDA_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}"

# Add Lambda permission for S3 to invoke
aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id S3InvokePermission \
    --action lambda:InvokeFunction \
    --principal s3.amazonaws.com \
    --source-arn "arn:aws:s3:::${S3_BUCKET_NAME}" \
    --region "$REGION" \
    2>/dev/null || echo "  Permission already exists"

# Configure S3 notification
aws s3api put-bucket-notification-configuration \
    --bucket "$S3_BUCKET_NAME" \
    --notification-configuration "{
        \"LambdaFunctionConfigurations\": [{
            \"Id\": \"ChessNotationOCRTrigger\",
            \"LambdaFunctionArn\": \"${LAMBDA_ARN}\",
            \"Events\": [\"s3:ObjectCreated:*\"],
            \"Filter\": {
                \"Key\": {
                    \"FilterRules\": [{
                        \"Name\": \"prefix\",
                        \"Value\": \"notation-uploads/\"
                    }]
                }
            }
        }]
    }"
echo "✓ S3 trigger configured"
echo ""

# Step 7: Create Function URL (optional, for direct API access)
echo "Step 7: Creating Function URL..."
FUNCTION_URL=$(aws lambda create-function-url-config \
    --function-name "$FUNCTION_NAME" \
    --auth-type NONE \
    --cors "AllowOrigins=https://enjoylearningchess.com,http://localhost:3000,AllowMethods=POST,GET,AllowHeaders=*,MaxAge=3000" \
    --region "$REGION" \
    --query 'FunctionUrl' \
    --output text 2>/dev/null || aws lambda get-function-url-config \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --query 'FunctionUrl' \
    --output text)

# Add permission for public URL access
aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id FunctionURLAllowPublicAccess \
    --action lambda:InvokeFunctionUrl \
    --principal "*" \
    --function-url-auth-type NONE \
    --region "$REGION" \
    2>/dev/null || echo "  URL permission already exists"

echo "✓ Function URL created: $FUNCTION_URL"
echo ""

# Summary
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Lambda Function Details:"
echo "  • Name: $FUNCTION_NAME"
echo "  • Runtime: $RUNTIME"
echo "  • Memory: ${MEMORY_SIZE}MB"
echo "  • Timeout: ${TIMEOUT}s"
echo "  • Region: $REGION"
echo ""
echo "Environment Variables:"
echo "  • S3_BUCKET_NAME: $S3_BUCKET_NAME"
echo "  • DYNAMODB_TABLE_NAME: $DYNAMODB_TABLE_NAME"
echo "  • AWS_REGION: $REGION"
echo ""
echo "Function URL (for API calls):"
echo "  $FUNCTION_URL"
echo ""
echo "Next steps:"
echo "  1. Update frontend API client with Function URL"
echo "  2. Test the complete workflow"
echo "  3. Monitor CloudWatch logs for any issues"
echo ""

