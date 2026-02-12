#!/bin/bash

# Chess Notation OCR - Rate Limiting & Budget Setup
# Run this once to set up rate limiting and cost protection

set -e

echo "=========================================="
echo "Chess Notation OCR - Rate Limiting Setup"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
API_ID="52y22iuzx7"
FUNCTION_NAME="ChessNotationOCR"
RATE_LIMIT=1  # 1 request per second
BURST_LIMIT=5  # Allow small bursts
CONCURRENCY_LIMIT=2  # Max 2 concurrent Lambda executions
BUDGET_AMOUNT=10  # $10/month

echo "Configuration:"
echo "  • Rate Limit: ${RATE_LIMIT} requests/second"
echo "  • Burst Limit: ${BURST_LIMIT} requests"
echo "  • Lambda Concurrency: ${CONCURRENCY_LIMIT} concurrent executions"
echo "  • Monthly Budget: \$${BUDGET_AMOUNT}"
echo ""

# Step 1: API Gateway Throttling
echo "Step 1: Setting up API Gateway throttling..."
aws apigatewayv2 update-stage \
  --api-id ${API_ID} \
  --stage-name '$default' \
  --default-route-settings ThrottlingBurstLimit=${BURST_LIMIT},ThrottlingRateLimit=${RATE_LIMIT} \
  2>&1 | grep -q "ThrottlingRateLimit" && echo -e "${GREEN}✓ API Gateway throttling configured${NC}" || echo -e "${RED}✗ Failed to configure API Gateway${NC}"

# Step 2: Lambda Concurrency Limit
echo ""
echo "Step 2: Setting Lambda concurrency limit..."
aws lambda put-function-concurrency \
  --function-name ${FUNCTION_NAME} \
  --reserved-concurrent-executions ${CONCURRENCY_LIMIT} \
  > /dev/null 2>&1 && echo -e "${GREEN}✓ Lambda concurrency limit set to ${CONCURRENCY_LIMIT}${NC}" || echo -e "${RED}✗ Failed to set concurrency limit${NC}"

# Step 3: AWS Budget Alert
echo ""
echo "Step 3: Setting up AWS Budget alert..."
echo -e "${YELLOW}⚠ Budget setup requires your email address${NC}"
echo ""
read -p "Enter your email for budget alerts: " USER_EMAIL

if [ -z "$USER_EMAIL" ]; then
  echo -e "${RED}✗ Email required for budget alerts. Skipping budget setup.${NC}"
else
  # Get AWS Account ID
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  
  # Create budget configuration with user's email
  cat > /tmp/budget-config.json <<EOF
{
  "BudgetName": "ChessOCR-Monthly-Budget",
  "BudgetType": "COST",
  "TimeUnit": "MONTHLY",
  "BudgetLimit": {
    "Amount": "${BUDGET_AMOUNT}",
    "Unit": "USD"
  },
  "CostTypes": {
    "IncludeTax": true,
    "IncludeSubscription": true,
    "UseBlended": false
  },
  "TimePeriod": {
    "Start": "$(date -u +%Y-%m-01T00:00:00Z)",
    "End": "2087-06-15T00:00:00Z"
  }
}
EOF

  cat > /tmp/budget-notifications.json <<EOF
[
  {
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80,
      "ThresholdType": "PERCENTAGE",
      "NotificationState": "ALARM"
    },
    "Subscribers": [
      {
        "SubscriptionType": "EMAIL",
        "Address": "${USER_EMAIL}"
      }
    ]
  },
  {
    "Notification": {
      "NotificationType": "FORECASTED",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 100,
      "ThresholdType": "PERCENTAGE",
      "NotificationState": "ALARM"
    },
    "Subscribers": [
      {
        "SubscriptionType": "EMAIL",
        "Address": "${USER_EMAIL}"
      }
    ]
  }
]
EOF

  # Create budget
  aws budgets create-budget \
    --account-id ${ACCOUNT_ID} \
    --budget file:///tmp/budget-config.json \
    --notifications-with-subscribers file:///tmp/budget-notifications.json \
    > /dev/null 2>&1 && echo -e "${GREEN}✓ Budget alert configured (check ${USER_EMAIL} for confirmation)${NC}" || echo -e "${YELLOW}⚠ Budget may already exist or failed to create${NC}"
  
  # Cleanup
  rm /tmp/budget-config.json /tmp/budget-notifications.json
fi

# Step 4: Verify Configuration
echo ""
echo "Step 4: Verifying configuration..."
echo ""

# Check API Gateway
THROTTLE_INFO=$(aws apigatewayv2 get-stage --api-id ${API_ID} --stage-name '$default' --query 'DefaultRouteSettings' 2>/dev/null)
if [ ! -z "$THROTTLE_INFO" ]; then
  echo -e "${GREEN}✓ API Gateway Throttling:${NC}"
  echo "  Rate Limit: $(echo $THROTTLE_INFO | grep -o 'ThrottlingRateLimit": [0-9.]*' | cut -d' ' -f2) req/sec"
  echo "  Burst Limit: $(echo $THROTTLE_INFO | grep -o 'ThrottlingBurstLimit": [0-9]*' | cut -d' ' -f2) requests"
fi

# Check Lambda Concurrency
CONCURRENCY=$(aws lambda get-function-concurrency --function-name ${FUNCTION_NAME} --query 'ReservedConcurrentExecutions' --output text 2>/dev/null)
if [ ! -z "$CONCURRENCY" ] && [ "$CONCURRENCY" != "None" ]; then
  echo -e "${GREEN}✓ Lambda Concurrency:${NC} ${CONCURRENCY} concurrent executions"
fi

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Your Chess Notation OCR is now protected:"
echo "  • Rate limited to ${RATE_LIMIT} request/second"
echo "  • Max ${CONCURRENCY_LIMIT} concurrent Lambda executions"
if [ ! -z "$USER_EMAIL" ]; then
  echo "  • Budget alerts sent to ${USER_EMAIL}"
fi
echo ""
echo "To test rate limiting, try uploading multiple images quickly."
echo "You should see 'Too Many Requests' errors after ${RATE_LIMIT} req/sec."
echo ""
