#!/bin/bash

# Chess Notation OCR Infrastructure Cleanup Script
# WARNING: This script will delete all infrastructure resources

set -e  # Exit on error

# Configuration
REGION="us-east-1"
BUCKET_NAME="chess-notation-uploads"
TABLE_NAME="ChessNotationOCRWorkflows"
ROLE_NAME="ChessNotationOCRLambdaRole"

echo "=========================================="
echo "Chess Notation OCR Infrastructure Cleanup"
echo "=========================================="
echo ""
echo "⚠️  WARNING: This will delete all infrastructure resources!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo "Starting cleanup..."
echo ""

# Step 1: Empty and Delete S3 Bucket
echo "Step 1: Emptying and deleting S3 bucket..."
if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
    echo "  Emptying bucket..."
    aws s3 rm "s3://$BUCKET_NAME" --recursive
    echo "  Deleting bucket..."
    aws s3api delete-bucket --bucket "$BUCKET_NAME" --region "$REGION"
    echo "✓ S3 bucket deleted: $BUCKET_NAME"
else
    echo "⚠ Bucket $BUCKET_NAME does not exist, skipping..."
fi
echo ""

# Step 2: Delete DynamoDB Table
echo "Step 2: Deleting DynamoDB table..."
if aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" &> /dev/null; then
    aws dynamodb delete-table --table-name "$TABLE_NAME" --region "$REGION"
    echo "✓ DynamoDB table deleted: $TABLE_NAME"
else
    echo "⚠ Table $TABLE_NAME does not exist, skipping..."
fi
echo ""

# Step 3: Delete IAM Role Policies
echo "Step 3: Deleting IAM role policies..."
if aws iam get-role --role-name "$ROLE_NAME" &> /dev/null; then
    # Delete inline policies
    echo "  Deleting inline policies..."
    aws iam delete-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-name ChessNotationOCRPolicy \
        2>/dev/null || echo "  No inline policy to delete"
    
    # Detach managed policies
    echo "  Detaching managed policies..."
    aws iam detach-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" \
        2>/dev/null || echo "  No managed policy to detach"
    
    # Delete role
    echo "  Deleting role..."
    aws iam delete-role --role-name "$ROLE_NAME"
    echo "✓ IAM role deleted: $ROLE_NAME"
else
    echo "⚠ Role $ROLE_NAME does not exist, skipping..."
fi
echo ""

# Summary
echo "=========================================="
echo "Cleanup Complete!"
echo "=========================================="
echo ""
echo "All infrastructure resources have been deleted."
echo ""
