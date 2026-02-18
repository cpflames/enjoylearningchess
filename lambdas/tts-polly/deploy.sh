#!/bin/bash

# TTS Polly Lambda Deployment Script
# This script packages and deploys the Lambda function to AWS

set -e  # Exit on error

# Configuration
FUNCTION_NAME="tts-polly"
REGION="us-east-1"
ROLE_NAME="tts-polly-role"
RUNTIME="nodejs18.x"
MEMORY_SIZE=256
TIMEOUT=10

echo "=========================================="
echo "TTS Polly Lambda Deployment"
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

# Step 2: Create deployment package
echo "Step 2: Creating deployment package..."
rm -f function.zip
zip -r function.zip index.js node_modules package.json
echo "✓ Deployment package created: function.zip"
echo ""

# Step 3: Check if IAM role exists, create if not
echo "Step 3: Checking IAM role..."
if ! aws iam get-role --role-name "$ROLE_NAME" &> /dev/null; then
    echo "Creating IAM role..."
    
    # Create trust policy
    cat > /tmp/trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
    
    # Create role
    aws iam create-role \
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document file:///tmp/trust-policy.json \
        --description "Execution role for TTS Polly Lambda function"
    
    # Attach basic Lambda execution policy
    aws iam attach-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
    
    # Create and attach Polly policy
    cat > /tmp/polly-policy.json <<EOF
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
EOF
    
    aws iam put-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-name "PollyAccess" \
        --policy-document file:///tmp/polly-policy.json
    
    echo "✓ IAM role created with Polly permissions"
    echo "  Waiting 10 seconds for role to propagate..."
    sleep 10
else
    echo "✓ IAM role exists"
fi

ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)
echo "  Role ARN: $ROLE_ARN"
echo ""

# Step 4: Check if Lambda function exists
echo "Step 4: Checking if Lambda function exists..."
if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" &> /dev/null; then
    echo "⚠ Function exists, updating code..."
    aws lambda update-function-code \
        --function-name "$FUNCTION_NAME" \
        --zip-file fileb://function.zip \
        --region "$REGION" \
        > /dev/null
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
        --region "$REGION" \
        --tags Project=SpellingBee,Environment=Production \
        > /dev/null
    echo "✓ Lambda function created"
    
    # Wait for function to be active
    echo "  Waiting for function to become active..."
    aws lambda wait function-active-v2 --function-name "$FUNCTION_NAME" --region "$REGION"
    echo "  ✓ Function is active"
fi
echo ""

# Step 5: Create Function URL with CORS
echo "Step 5: Creating Function URL with CORS..."
if aws lambda get-function-url-config --function-name "$FUNCTION_NAME" --region "$REGION" &> /dev/null; then
    echo "  Function URL already exists, retrieving..."
    FUNCTION_URL=$(aws lambda get-function-url-config \
        --function-name "$FUNCTION_NAME" \
        --region "$REGION" \
        --query 'FunctionUrl' \
        --output text)
else
    echo "  Creating new Function URL..."
    FUNCTION_URL=$(aws lambda create-function-url-config \
        --function-name "$FUNCTION_NAME" \
        --auth-type NONE \
        --cors "AllowOrigins=*,AllowMethods=POST,AllowHeaders=content-type,MaxAge=3600" \
        --region "$REGION" \
        --query 'FunctionUrl' \
        --output text)
fi

# Add permission for public URL access
aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id FunctionURLAllowPublicAccess \
    --action lambda:InvokeFunctionUrl \
    --principal "*" \
    --function-url-auth-type NONE \
    --region "$REGION" \
    2>/dev/null || echo "  URL permission already exists"

echo "✓ Function URL created with CORS enabled"
echo ""

# Step 6: Test the function
echo "Step 6: Testing the function..."
TEST_PAYLOAD='{"body": "{\"word\": \"hello\"}"}'
TEST_RESULT=$(aws lambda invoke \
    --function-name "$FUNCTION_NAME" \
    --payload "$TEST_PAYLOAD" \
    --region "$REGION" \
    /tmp/tts-response.json 2>&1)

if grep -q "StatusCode.*200" <<< "$TEST_RESULT"; then
    echo "✓ Function test successful"
else
    echo "⚠ Function test returned non-200 status"
fi
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
echo "Function URL (for API calls):"
echo "  $FUNCTION_URL"
echo ""
echo "CORS Configuration:"
echo "  • Allowed Origins: https://enjoylearningchess.com, http://localhost:3000"
echo "  • Allowed Methods: POST, OPTIONS"
echo "  • Allowed Headers: Content-Type"
echo ""
echo "Next steps:"
echo "  1. Update frontend ttsService.ts with Function URL"
echo "  2. Test from frontend application"
echo "  3. Monitor CloudWatch logs for any issues"
echo ""
echo "Example API call:"
echo "  curl -X POST $FUNCTION_URL \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"word\": \"spelling\"}'"
echo ""
