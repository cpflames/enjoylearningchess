# Rate Limiting & Cost Protection Guide

## Quick Setup (Recommended)

Run this one command:
```bash
cd onetris/lambdas/chess-notation-ocr
./setup-rate-limiting.sh
```

It will:
1. Set API Gateway to 1 request/second (with burst of 5)
2. Limit Lambda to 2 concurrent executions
3. Create $10/month budget alert (you'll enter your email)

**Time:** 2 minutes  
**Cost:** Free

---

## Manual Setup (If You Prefer)

### 1. API Gateway Throttling (1 TPS)

```bash
aws apigatewayv2 update-stage \
  --api-id 52y22iuzx7 \
  --stage-name '$default' \
  --throttle-settings BurstLimit=5,RateLimit=1
```

**What this does:**
- Limits to 1 request per second sustained
- Allows bursts of up to 5 requests
- Returns HTTP 429 "Too Many Requests" when exceeded

### 2. Lambda Concurrency Limit

```bash
aws lambda put-function-concurrency \
  --function-name ChessNotationOCR \
  --reserved-concurrent-executions 2
```

**What this does:**
- Max 2 Lambda instances can run at once
- Prevents runaway costs if someone spams requests
- Additional requests get queued or rejected

### 3. AWS Budget Alert ($10/month)

```bash
# Get your account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create budget (replace YOUR_EMAIL)
aws budgets create-budget \
  --account-id $ACCOUNT_ID \
  --budget '{
    "BudgetName": "ChessOCR-Monthly",
    "BudgetType": "COST",
    "TimeUnit": "MONTHLY",
    "BudgetLimit": {"Amount": "10", "Unit": "USD"}
  }' \
  --notifications-with-subscribers '[{
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [{
      "SubscriptionType": "EMAIL",
      "Address": "YOUR_EMAIL@example.com"
    }]
  }]'
```

**What this does:**
- Sends email when you hit 80% of $10 ($8)
- Sends email when forecasted to exceed $10
- You must confirm the email subscription

---

## Cost Breakdown (Estimated)

For friends-and-family usage (assume 100 uploads/month):

| Service | Usage | Cost |
|---------|-------|------|
| API Gateway | 100 requests | $0.00 (free tier: 1M/month) |
| Lambda | 100 invocations × 10s | $0.00 (free tier: 1M/month) |
| Textract | 100 pages | $1.50 ($0.015/page) |
| S3 Storage | 100 images × 30 days | $0.01 |
| DynamoDB | 100 writes + reads | $0.00 (free tier: 25GB) |
| **Total** | | **~$1.51/month** |

Even with heavy usage (1000 uploads/month), you'd be around $15/month. The budget alert at $10 gives you warning.

---

## Testing Rate Limiting

After setup, test it works:

```bash
# This should succeed (1 request)
curl -X POST https://52y22iuzx7.execute-api.us-east-1.amazonaws.com/ \
  -H "Content-Type: application/json" \
  -d '{"type":"get-status","workflowId":"test"}'

# Run this 10 times quickly - some should fail with 429
for i in {1..10}; do
  curl -X POST https://52y22iuzx7.execute-api.us-east-1.amazonaws.com/ \
    -H "Content-Type: application/json" \
    -d '{"type":"get-status","workflowId":"test"}' &
done
wait
```

You should see some `429 Too Many Requests` responses.

---

## Adjusting Limits Later

### Increase to 5 TPS:
```bash
aws apigatewayv2 update-stage \
  --api-id 52y22iuzx7 \
  --stage-name '$default' \
  --throttle-settings BurstLimit=10,RateLimit=5
```

### Remove rate limiting:
```bash
aws apigatewayv2 update-stage \
  --api-id 52y22iuzx7 \
  --stage-name '$default' \
  --throttle-settings BurstLimit=5000,RateLimit=10000
```

### Remove concurrency limit:
```bash
aws lambda delete-function-concurrency \
  --function-name ChessNotationOCR
```

---

## Monitoring Costs

Check current month's costs:
```bash
aws ce get-cost-and-usage \
  --time-period Start=$(date -u +%Y-%m-01),End=$(date -u +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=SERVICE
```

Or just check the AWS Console:
https://console.aws.amazon.com/billing/home#/bills

---

## What Happens When Limits Are Hit?

### API Gateway Rate Limit (1 TPS)
- **User sees:** "Too many requests, please try again"
- **HTTP Status:** 429 Too Many Requests
- **Your cost:** $0 (request rejected before Lambda runs)

### Lambda Concurrency Limit (2 concurrent)
- **User sees:** "Service temporarily unavailable"
- **HTTP Status:** 503 Service Unavailable
- **Your cost:** $0 (request rejected before Lambda runs)

### Budget Alert ($10/month)
- **You receive:** Email warning at $8 spent
- **User sees:** Nothing (system keeps working)
- **Your action:** Review usage, adjust limits, or increase budget

---

## Recommended Settings by Usage

### Friends & Family (current)
- Rate: 1 TPS
- Concurrency: 2
- Budget: $10/month

### Small Team (10-20 people)
- Rate: 5 TPS
- Concurrency: 5
- Budget: $25/month

### Public Beta (100+ users)
- Rate: 20 TPS
- Concurrency: 10
- Budget: $100/month
- Consider: Add authentication, per-user rate limiting

---

## Emergency: Disable Everything

If costs are spiraling:

```bash
# Stop all new requests
aws lambda put-function-concurrency \
  --function-name ChessNotationOCR \
  --reserved-concurrent-executions 0

# Or delete the API Gateway stage
aws apigatewayv2 delete-stage \
  --api-id 52y22iuzx7 \
  --stage-name '$default'
```

Then investigate what happened in CloudWatch Logs.
