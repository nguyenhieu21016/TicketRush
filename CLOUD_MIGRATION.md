# TicketRush - Cloud Migration Guide

## Phase 1: Local Testing with Redis ✅

### 1.1 Start services
```bash
docker-compose up -d
pip install -r backend/requirements.txt
python scripts/init_redis_counters.py
```

### 1.2 Test Redis integration
```bash
# Start backend
cd backend
uvicorn app.main:app --reload

# In another terminal, run load test
pip install locust
locust -f scripts/locust_booking_test.py --host=http://localhost:8000 --users=100 --spawn-rate=10 --run-time=1m
```

---

## Phase 2: AWS Infrastructure Setup

### 2.1 VPC & Network (Bình)
```bash
# Create VPC with 2 AZ
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=ticketrush-vpc}]'

# Create subnets:
# - Public subnets (1a, 1b) for ALB, NAT
# - Private subnets (1a, 1b) for EC2
# - Database subnets (1a, 1b) for RDS, ElastiCache

# Create Internet Gateway, NAT Gateway, Route Tables
# Security Groups:
#   - ALB-SG: allow 80, 443 from 0.0.0.0/0
#   - EC2-SG: allow 8000 from ALB-SG
#   - RDS-SG: allow 3306 from EC2-SG
#   - Redis-SG: allow 6379 from EC2-SG
```

### 2.2 RDS MySQL Multi-AZ (Hiếu)
```bash
aws rds create-db-instance \
  --db-instance-identifier ticketrush-db \
  --db-instance-class db.t3.micro \
  --engine mysql \
  --engine-version 8.0 \
  --master-username admin \
  --master-user-password <secure-password> \
  --allocated-storage 20 \
  --multi-az \
  --db-subnet-group-name ticketrush-db-subnet \
  --vpc-security-group-ids sg-xxxxx

# After RDS is ready, restore schema
mysql -h <rds-endpoint> -u admin -p < database/schema.sql
```

### 2.3 ElastiCache Redis (Hiếu)
```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id ticketrush-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1 \
  --cache-subnet-group-name ticketrush-cache-subnet \
  --security-group-ids sg-xxxxx

# Initialize counters
export REDIS_HOST=<elasticache-endpoint>
python scripts/init_redis_counters.py
```

### 2.4 S3 Bucket (Hiếu)
```bash
aws s3 mb s3://ticketrush-qr-codes-<random>
aws s3api put-bucket-encryption \
  --bucket ticketrush-qr-codes-<random> \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# Block public access
aws s3api put-public-access-block \
  --bucket ticketrush-qr-codes-<random> \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### 2.5 SQS Queue (Hoàng)
```bash
aws sqs create-queue \
  --queue-name ticketrush-ticket-generation \
  --attributes VisibilityTimeout=60,MessageRetentionPeriod=3600
```

### 2.6 Lambda Function (Hoàng)
```bash
# Package Lambda
cd lambda
pip install -r requirements.txt -t package/
cp ticket_generator.py package/
cd package && zip -r ../lambda.zip . && cd ..

# Create Lambda
aws lambda create-function \
  --function-name ticketrush-ticket-generator \
  --runtime python3.11 \
  --role arn:aws:iam::<account>:role/lambda-execution-role \
  --handler ticket_generator.lambda_handler \
  --zip-file fileb://lambda.zip \
  --timeout 60 \
  --memory-size 512 \
  --environment Variables="{DB_HOST=<rds-endpoint>,S3_BUCKET_NAME=ticketrush-qr-codes-<random>,AWS_REGION=us-east-1,...}"

# Add SQS trigger
aws lambda create-event-source-mapping \
  --function-name ticketrush-ticket-generator \
  --event-source-arn arn:aws:sqs:<region>:<account>:ticketrush-ticket-generation \
  --batch-size 10
```

### 2.7 SES Email (Hoàng)
```bash
# Verify sender email
aws ses verify-email-identity --email-address noreply@yourdomain.com

# Request production access (if needed)
# https://console.aws.amazon.com/ses/home#/account
```

---

## Phase 3: EC2 Setup & Auto Scaling (Anh)

### 3.1 Create AMI
```bash
# Launch temporary EC2 instance
# SSH into instance and setup:
sudo yum update -y
sudo yum install -y python3.11 git

# Clone repo and install
cd /opt
sudo git clone <your-repo-url> ticketrush
cd ticketrush/backend
sudo pip3.11 install -r requirements.txt

# Create systemd service
sudo tee /etc/systemd/system/ticketrush.service <<EOF
[Unit]
Description=TicketRush API
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/ticketrush/backend
Environment="PATH=/usr/local/bin:/usr/bin"
EnvironmentFile=/opt/ticketrush/backend/.env
ExecStart=/usr/local/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable ticketrush

# Create AMI from this instance
aws ec2 create-image \
  --instance-id i-xxxxx \
  --name ticketrush-api-v1 \
  --description "TicketRush FastAPI backend"
```

### 3.2 Create Launch Template
```bash
aws ec2 create-launch-template \
  --launch-template-name ticketrush-lt \
  --version-description "v1" \
  --launch-template-data '{
    "ImageId":"ami-xxxxx",
    "InstanceType":"t3.small",
    "IamInstanceProfile":{"Arn":"arn:aws:iam::<account>:instance-profile/ticketrush-ec2-role"},
    "SecurityGroupIds":["sg-xxxxx"],
    "UserData":"<base64-encoded-startup-script>",
    "TagSpecifications":[{
      "ResourceType":"instance",
      "Tags":[{"Key":"Name","Value":"ticketrush-api"}]
    }]
  }'
```

### 3.3 Application Load Balancer
```bash
aws elbv2 create-load-balancer \
  --name ticketrush-alb \
  --subnets subnet-xxxxx subnet-yyyyy \
  --security-groups sg-xxxxx \
  --scheme internet-facing

# Create target group
aws elbv2 create-target-group \
  --name ticketrush-tg \
  --protocol HTTP \
  --port 8000 \
  --vpc-id vpc-xxxxx \
  --health-check-path /health \
  --health-check-interval-seconds 30

# Create listener
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:...
```

### 3.4 Auto Scaling Group
```bash
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name ticketrush-asg \
  --launch-template LaunchTemplateName=ticketrush-lt,Version='$Latest' \
  --min-size 2 \
  --max-size 10 \
  --desired-capacity 2 \
  --target-group-arns arn:aws:elasticloadbalancing:... \
  --vpc-zone-identifier "subnet-xxxxx,subnet-yyyyy" \
  --health-check-type ELB \
  --health-check-grace-period 300

# Add scaling policy (target tracking)
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name ticketrush-asg \
  --policy-name target-tracking-alb-requests \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration file://scaling-policy.json
```

**scaling-policy.json:**
```json
{
  "TargetValue": 1000.0,
  "PredefinedMetricSpecification": {
    "PredefinedMetricType": "ALBRequestCountPerTarget",
    "ResourceLabel": "app/ticketrush-alb/xxx/targetgroup/ticketrush-tg/yyy"
  }
}
```

---

## Phase 4: Monitoring & Alarms (Anh)

### 4.1 CloudWatch Dashboard
```bash
aws cloudwatch put-dashboard \
  --dashboard-name TicketRush \
  --dashboard-body file://dashboard.json
```

### 4.2 SNS Topic & Alarms
```bash
# Create SNS topic
aws sns create-topic --name ticketrush-alerts
aws sns subscribe --topic-arn arn:aws:sns:...:ticketrush-alerts --protocol email --notification-endpoint your-email@example.com

# CPU Alarm
aws cloudwatch put-metric-alarm \
  --alarm-name ticketrush-high-cpu \
  --alarm-description "CPU > 60% for 2 minutes" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 60 \
  --threshold 60 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:...:ticketrush-alerts \
  --dimensions Name=AutoScalingGroupName,Value=ticketrush-asg

# HTTP 5xx Alarm
aws cloudwatch put-metric-alarm \
  --alarm-name ticketrush-http-errors \
  --metric-name HTTPCode_Target_5XX_Count \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 60 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:...:ticketrush-alerts
```

---

## Phase 5: Demo & Load Test

### 5.1 Update frontend
```javascript
// frontend/app.js - update API endpoint
const API_BASE = "http://<alb-dns-name>";
```

### 5.2 Run Locust test
```bash
locust -f scripts/locust_booking_test.py \
  --host=http://<alb-dns-name> \
  --users=1500 \
  --spawn-rate=25 \
  --run-time=5m \
  --headless
```

### 5.3 Monitor
- CloudWatch Dashboard: CPU, Request count, Response time
- ASG Activity: Watch instances scaling from 2 → 4+
- RDS Performance Insights
- Redis CloudWatch metrics
- SQS message count

---

## Environment Variables Checklist

### EC2 (.env)
```
DB_USER=admin
DB_PASSWORD=<rds-password>
DB_HOST=<rds-endpoint>
DB_PORT=3306
DB_NAME=ticketrush_db

REDIS_HOST=<elasticache-endpoint>
REDIS_PORT=6379
REDIS_SSL=true

S3_BUCKET_NAME=ticketrush-qr-codes-<random>
USE_S3=true

SQS_QUEUE_URL=https://sqs.<region>.amazonaws.com/<account>/ticketrush-ticket-generation
USE_SQS=true

SES_FROM_EMAIL=noreply@yourdomain.com
USE_SES=true

AWS_REGION=us-east-1
CORS_ORIGINS=http://<alb-dns-name>,https://<cloudfront-domain>
APP_ENV=production
DEBUG=false
```

### Lambda (same as above + AWS credentials via IAM role)

---

## Cost Estimate (Monthly)
- EC2 t3.small × 2: $39
- EBS gp3 2 × 20GB: $4
- NAT Gateway × 1: $48
- RDS db.t3.micro Multi-AZ: $42
- ElastiCache cache.t3.micro: $15
- S3 10GB + SQS + Lambda: $3
- CloudWatch + SNS: $6
- ALB: $23
- Data transfer + IPv4: $16
**Total: ~$196/month**

---

## Next Steps
1. ✅ Code refactored for cloud (Redis, S3, SQS)
2. ⬜ Test locally with docker-compose
3. ⬜ Deploy infrastructure (VPC → RDS → Redis → S3 → SQS → Lambda)
4. ⬜ Create AMI and setup Auto Scaling
5. ⬜ Configure monitoring and alarms
6. ⬜ Load test and validate auto-scaling
7. ⬜ Prepare demo presentation
