# Security Checklist for Chess Notation OCR

## ✅ Currently Implemented

### Infrastructure Security
- [x] S3 bucket is private (no public access)
- [x] S3 server-side encryption enabled (AES256)
- [x] S3 lifecycle policy (30-day expiration for uploads)
- [x] IAM least-privilege permissions (Lambda can only access specific resources)
- [x] CloudWatch logging enabled for audit trail

### Application Security
- [x] Input validation (file type: JPEG/PNG/HEIC/WebP only)
- [x] Input validation (file size: max 10MB)
- [x] Pre-signed URLs with 5-minute expiration
- [x] No sensitive data in error messages
- [x] Structured error logging with context
- [x] DynamoDB TTL (30-day automatic cleanup)

### API Security
- [x] CORS headers configured
- [x] Request type validation
- [x] Workflow ID validation (UUID format)
- [x] 404 responses for non-existent workflows

## ⚠️ Before Production Deployment

### 1. CORS Configuration (✅ DONE)
**Current**: Allows production domain and localhost for development
**Implementation**: The `getCorsHeaders()` function checks the request origin and allows:
- `https://enjoylearningchess.com` (production)
- `http://localhost:8080` (development)
- `http://localhost:3000` (alternate development port)

**To add more allowed origins**, update the `allowedOrigins` array in `index.js`:
```javascript
const allowedOrigins = [
  'https://enjoylearningchess.com',
  'http://localhost:8080',
  'http://localhost:3000',
  'https://staging.enjoylearningchess.com'  // Add staging if needed
];
```

### 2. Rate Limiting (HIGHLY RECOMMENDED)
**Current**: No rate limiting on API Gateway
**Risk**: Potential abuse, high AWS costs
**Action Required**: 

Option A - Add API Gateway throttling:
```bash
aws apigatewayv2 update-stage \
  --api-id 52y22iuzx7 \
  --stage-name '$default' \
  --throttle-settings BurstLimit=10,RateLimit=100
```

Option B - Add Lambda reserved concurrency:
```bash
aws lambda put-function-concurrency \
  --function-name ChessNotationOCR \
  --reserved-concurrent-executions 10
```

### 3. Monitoring & Alerts (RECOMMENDED)
**Action Required**: Set up CloudWatch alarms for:
- Lambda errors (threshold: > 5 errors in 5 minutes)
- Lambda duration (threshold: > 25 seconds)
- DynamoDB throttling
- S3 bucket size (cost monitoring)

```bash
# Example: Create error alarm
aws cloudwatch put-metric-alarm \
  --alarm-name ChessOCR-Lambda-Errors \
  --alarm-description "Alert on Lambda errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=ChessNotationOCR \
  --evaluation-periods 1
```

### 4. Cost Protection (RECOMMENDED)
**Risk**: Unexpected AWS bills from abuse
**Action Required**: Set up AWS Budgets:

```bash
aws budgets create-budget \
  --account-id YOUR_ACCOUNT_ID \
  --budget file://budget.json
```

Example budget.json:
```json
{
  "BudgetName": "ChessOCR-Monthly",
  "BudgetLimit": {
    "Amount": "10",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
```

### 5. Content Security (OPTIONAL)
**Current**: No content scanning
**Risk**: Users could upload inappropriate images
**Action Required** (if needed):
- Add AWS Rekognition moderation check before Textract
- Reject images with inappropriate content

## 🔒 Additional Security Considerations

### File Upload Security
- ✅ File type validation (MIME type check)
- ✅ File size limit (10MB)
- ⚠️ Consider: Add virus scanning (AWS GuardDuty or ClamAV)
- ⚠️ Consider: Add image dimension limits (prevent memory exhaustion)

### Data Privacy
- ✅ Automatic data deletion (30-day TTL)
- ⚠️ Consider: Add user authentication (if storing personal data)
- ⚠️ Consider: Add GDPR compliance features (data export, deletion on request)

### API Security
- ✅ Input validation
- ⚠️ Consider: Add API key authentication
- ⚠️ Consider: Add request signing (AWS Signature V4)
- ⚠️ Consider: Add WAF rules (SQL injection, XSS protection)

### Monitoring
- ✅ CloudWatch logs enabled
- ⚠️ Consider: Add X-Ray tracing for performance monitoring
- ⚠️ Consider: Add custom metrics (upload count, processing time)

## 📋 Pre-Launch Checklist

Before making the feature public:

1. [x] Update CORS to restrict to your domain (allows production + localhost)
2. [ ] Add rate limiting (API Gateway or Lambda concurrency)
3. [ ] Set up CloudWatch alarms for errors
4. [ ] Set up AWS Budget alerts
5. [ ] Test with various file types and sizes
6. [ ] Test error scenarios (invalid files, network errors)
7. [ ] Review CloudWatch logs for any sensitive data leakage
8. [ ] Document the feature for users (what formats work best, size limits)
9. [ ] Have a rollback plan (can disable Lambda trigger or API Gateway)

## 🚨 Incident Response

If you detect abuse:

1. **Immediate**: Disable Lambda function
   ```bash
   aws lambda update-function-configuration \
     --function-name ChessNotationOCR \
     --environment Variables={}
   ```

2. **Review**: Check CloudWatch logs for patterns
   ```bash
   aws logs filter-log-events \
     --log-group-name /aws/lambda/ChessNotationOCR \
     --start-time $(date -u -d '1 hour ago' +%s)000
   ```

3. **Block**: Add IP-based blocking via WAF or API Gateway

4. **Clean up**: Delete any malicious uploads from S3

## 📞 Support

For security issues:
- Check CloudWatch logs: `/aws/lambda/ChessNotationOCR`
- Check DynamoDB table: `ChessNotationOCRWorkflows`
- Check S3 bucket: `chess-notation-uploads`

## 🔄 Regular Maintenance

Monthly:
- [ ] Review CloudWatch logs for errors
- [ ] Check AWS costs
- [ ] Review S3 bucket size
- [ ] Update dependencies (npm audit)

Quarterly:
- [ ] Review IAM permissions
- [ ] Test disaster recovery
- [ ] Review and update this security checklist
