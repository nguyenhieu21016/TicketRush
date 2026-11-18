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

## Kiểm tra VPC đã đủ chưa (Checklist)

### 1. Subnets (Cần 6 subnets)
**VPC → Subnets** → Filter by VPC: `vpc-0f8b9f335902973a1`

| Subnet Name | CIDR | Availability Zone | Subnet ID |
|-------------|------|-------------------|-----------|
| tr-public-a | 10.0.1.0/24 | ap-southeast-1a | subnet-0d5f93470fae1e2d6 |
| tr-public-b | 10.0.2.0/24 | ap-southeast-1b | subnet-0e3497950c04f0aaa |
| tr-app-a | 10.0.11.0/24 | ap-southeast-1a | subnet-038b7e417625dd956 |
| tr-app-b | 10.0.12.0/24 | ap-southeast-1b | subnet-068b4b32ac80ee674 |
| tr-data-a | 10.0.21.0/24 | ap-southeast-1a | subnet-03add7b2cc1fb9716 |
| tr-data-b | 10.0.22.0/24 | ap-southeast-1b | subnet-06e3ce3e210bb288c |

### 2. Internet Gateway & NAT Gateway
**VPC → Internet Gateways** → Filter by VPC
- ✅ Internet Gateway: `ticketrush-igw` (igw-0dbee7e8a410b865e)
- ✅ Attached to VPC: `vpc-0f8b9f335902973a1`

**VPC → NAT Gateways** → Filter by VPC
- ✅ NAT Gateway: `tr-nat-a` (nat-03fbfd33470aecce2)
- ✅ Subnet: tr-public-a
- ✅ Elastic IP: 47.130.89.104

### 3. Route Tables
**VPC → Route Tables** → Filter by VPC

**Public Route Table** (`tr-public-rt`):
- Routes: 
  - 10.0.0.0/16 → local
  - 0.0.0.0/0 → Internet Gateway
- Associated subnets: tr-public-a, tr-public-b

**App Route Table** (`tr-app-rt`):
- Routes:
  - 10.0.0.0/16 → local
  - 0.0.0.0/0 → NAT Gateway
- Associated subnets: tr-app-a, tr-app-b

**Data Route Table** (`tr-data-rt`):
- Routes:
  - 10.0.0.0/16 → local (không có default route ra Internet)
- Associated subnets: tr-data-a, tr-data-b

### 4. Security Groups
**VPC → Security Groups** → Filter by VPC

**tr-alb-sg** (sg-0272a045c483f8804):
- Inbound: HTTP (80) từ 0.0.0.0/0
- Outbound: All traffic

**tr-app-sg** (sg-0b3bf9766c1b23c5f):
- Inbound: Port **80** từ tr-alb-sg ⚠️ **Cần sửa thành port 8000**
- Outbound: All traffic

**tr-data-sg** (sg-092acf8aefc513aec):
- Inbound: 
  - Port 3306 (MySQL) từ tr-app-sg
  - Port 6379 (Redis) từ tr-app-sg
- Outbound: All traffic

### 5. VPC Configuration
**VPC → Your VPCs** → vpc-0f8b9f335902973a1
- ✅ CIDR: 10.0.0.0/16
- ✅ DNS resolution: Enabled
- ✅ DNS hostnames: Enabled (quan trọng cho RDS endpoint)

---

## Phase 2: AWS Infrastructure Setup

### 2.1 VPC & Network (Bình) ✅
VPC, Subnets, Security Groups đã được tạo theo file `Mạng, ALB, Security group.pdf`:
- VPC: vpc-0f8b9f335902973a1 (10.0.0.0/16)
- 6 subnets: tr-public-a/b, tr-app-a/b, tr-data-a/b
- Security groups: tr-alb-sg, tr-ec2-sg, tr-rds-sg, tr-redis-sg

**⚠️ Lưu ý**: Cần kiểm tra tr-ec2-sg có cho phép port **8000** từ tr-alb-sg chưa (hiện tại document chỉ ghi port 80)

### 2.2 RDS MySQL Multi-AZ (Hiếu) - Console

#### Bước 1: Tạo DB Subnet Group
1. **RDS → Subnet groups → Create DB subnet group**
2. **Name**: `ticketrush-db-subnet`
3. **VPC**: `vpc-0f8b9f335902973a1`
4. **Add subnets**:
   - Chọn AZ: ap-southeast-1a → Subnet: `tr-data-a` (10.0.5.0/24)
   - Chọn AZ: ap-southeast-1b → Subnet: `tr-data-b` (10.0.6.0/24)
5. Click **Create**

#### Bước 2: Tạo RDS MySQL Instance
1. **RDS → Databases → Create database**
2. **Engine options**:
   - Engine type: MySQL
   - Engine Version: MySQL 8.0.35 (hoặc mới nhất)
3. **Templates**: Free tier (hoặc Dev/Test)
4. **Settings**:
   - DB instance identifier: `ticketrush-db`
   - Master username: `admin`
   - Master password: Tạo password mạnh (lưu lại!)
5. **Instance configuration**:
   - DB instance class: **Burstable classes** → db.t3.micro
6. **Storage**:
   - Storage type: General Purpose SSD (gp3)
   - Allocated storage: 20 GiB
   - Disable storage autoscaling (để tiết kiệm)
7. **Availability & durability**:
   - **Multi-AZ deployment**: ✅ Chọn **Create a standby instance** (quan trọng cho high availability)
8. **Connectivity**:
   - VPC: `vpc-0f8b9f335902973a1`
   - DB Subnet group: `ticketrush-db-subnet`
   - Public access: **No**
   - VPC security group: Chọn `tr-rds-sg` (cho phép port 3306 từ tr-ec2-sg)
   - Availability Zone: No preference
9. **Database authentication**: Password authentication
10. **Additional configuration**:
    - Initial database name: `ticketrush_db`
    - Backup retention period: 7 days
    - Enable automatic backups: ✅
    - Disable Enhanced monitoring (để tiết kiệm)
11. Click **Create database**

#### Bước 3: Đợi RDS khởi tạo (10-15 phút)
- Đợi Status: **Available**
- Copy **Endpoint** (dạng `ticketrush-db.xxxxx.ap-southeast-1.rds.amazonaws.com`)

#### Bước 4: Import schema và data
```bash
# Từ máy có kết nối tới VPC (EC2 bastion hoặc VPN)
mysql -h ticketrush-db.xxxxx.ap-southeast-1.rds.amazonaws.com -u admin -p ticketrush_db < database/schema.sql
mysql -h ticketrush-db.xxxxx.ap-southeast-1.rds.amazonaws.com -u admin -p ticketrush_db < database/seed.sql
```

### 2.3 ElastiCache Redis (Hiếu) - Console

#### Bước 1: Tạo Cache Subnet Group
1. **ElastiCache → Subnet groups → Create subnet group**
2. **Name**: `ticketrush-cache-subnet`
3. **VPC**: `vpc-0f8b9f335902973a1`
4. **Add subnets**:
   - Chọn AZ: ap-southeast-1a → Subnet: `tr-data-a` (10.0.5.0/24)
   - Chọn AZ: ap-southeast-1b → Subnet: `tr-data-b` (10.0.6.0/24)
5. Click **Create**

#### Bước 2: Tạo Redis Cluster
1. **ElastiCache → Redis clusters → Create Redis cluster**
2. **Cluster mode**: Disabled (đơn giản hơn, đủ cho demo)
3. **Cluster info**:
   - Name: `ticketrush-redis`
   - Description: Redis for seat reservation
4. **Location**:
   - AWS Cloud
   - Multi-AZ: Disabled (để tiết kiệm, có thể enable sau)
5. **Cluster settings**:
   - Engine version: Redis 7.x (mới nhất)
   - Port: 6379
   - Parameter group: default.redis7
   - Node type: **cache.t3.micro** (đủ cho demo)
   - Number of replicas: 0 (để tiết kiệm)
6. **Connectivity**:
   - Network type: IPv4
   - VPC: `vpc-0f8b9f335902973a1`
   - Subnet group: `ticketrush-cache-subnet`
7. **Security**:
   - Security groups: Chọn `tr-redis-sg` (cho phép port 6379 từ tr-ec2-sg)
   - Encryption at rest: Disabled (optional)
   - Encryption in-transit: Disabled (optional, enable nếu cần bảo mật cao)
8. **Backup**: Disable automatic backups (để tiết kiệm)
9. Click **Create**

#### Bước 3: Đợi Redis khởi tạo (5-10 phút)
- Đợi Status: **Available**
- Copy **Primary endpoint** (dạng `ticketrush-redis.xxxxx.cache.amazonaws.com:6379`)

#### Bước 4: Initialize Redis counters
```bash
# Set environment variables
export REDIS_HOST=ticketrush-redis.xxxxx.cache.amazonaws.com
export REDIS_PORT=6379
export REDIS_SSL=false
export DB_HOST=ticketrush-db.xxxxx.ap-southeast-1.rds.amazonaws.com
export DB_USER=admin
export DB_PASSWORD=<rds-password>

# Run initialization script
python scripts/init_redis_counters.py

# Verify
python scripts/init_redis_counters.py --verify
```

### 2.4 S3 Bucket (Hiếu) - Console

#### Bước 1: Tạo S3 Bucket
1. **S3 → Buckets → Create bucket**
2. **Bucket name**: `ticketrush-qr-codes-<random>` (tên phải unique toàn cầu, VD: `ticketrush-qr-codes-2024-sg`)
3. **AWS Region**: Asia Pacific (Singapore) ap-southeast-1
4. **Object Ownership**: ACLs disabled (recommended)
5. **Block Public Access settings**: ✅ Chọn **Block all public access** (quan trọng!)
6. **Bucket Versioning**: Disable (để tiết kiệm)
7. **Default encryption**:
   - Encryption type: **Server-side encryption with Amazon S3 managed keys (SSE-S3)**
   - Bucket Key: Enable (để giảm chi phí)
8. Click **Create bucket**

#### Bước 2: Configure CORS (nếu frontend cần direct upload)
1. Vào bucket vừa tạo → Tab **Permissions**
2. Scroll xuống **Cross-origin resource sharing (CORS)**
3. Click **Edit** và paste:
```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": []
    }
]
```
4. Click **Save changes**

#### Bước 3: Test upload (optional)
```bash
# Install AWS CLI nếu chưa có
pip install awscli

# Configure credentials
aws configure

# Test upload
echo "test" > test.txt
aws s3 cp test.txt s3://ticketrush-qr-codes-<random>/test.txt
aws s3 ls s3://ticketrush-qr-codes-<random>/
```

**Lưu bucket name** để dùng trong environment variables sau này!

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

### 3.3 Application Load Balancer (Console)

#### Bước 1: Tạo Target Group trước
1. **EC2 → Target Groups → Create target group**
2. **Choose a target type**: Instances
3. **Target group name**: `tr-app-tg`
4. **Protocol**: HTTP, **Port**: `8000` ⚠️ (Quan trọng! Backend chạy port 8000)
5. **VPC**: Chọn `vpc-0f8b9f335902973a1` (ticketrush-vpc)
6. **Protocol version**: HTTP1
7. **Health check settings**:
   - Health check protocol: HTTP
   - Health check path: `/health`
   - Advanced health check settings:
     - Healthy threshold: 2
     - Unhealthy threshold: 2
     - Timeout: 5 seconds
     - Interval: 30 seconds
     - Success codes: 200
8. Click **Next**
9. **Register targets**: Bỏ qua (chưa có EC2), click **Create target group**

#### Bước 2: Tạo Application Load Balancer
1. **EC2 → Load Balancers → Create load balancer**
2. Chọn **Application Load Balancer**
3. **Basic Configuration**:
   - Load balancer name: `ticketrush-alb`
   - Scheme: **Internet-facing**
   - IP address type: IPv4
4. **Network mapping**:
   - VPC: `vpc-0f8b9f335902973a1`
   - Mappings: Chọn 2 Availability Zones:
     - **ap-southeast-1a**: Subnet `tr-public-a` (10.0.1.0/24)
     - **ap-southeast-1b**: Subnet `tr-public-b` (10.0.2.0/24)
5. **Security groups**:
   - Xóa default security group
   - Chọn `tr-alb-sg` (sg-0e1c85b1e95587b07)
6. **Listeners and routing**:
   - Protocol: HTTP
   - Port: 80
   - Default action: **Forward to** → Chọn `tr-app-tg`
7. Click **Create load balancer**

#### Bước 3: Verify
- Đợi vài phút để ALB provisioning (State: Provisioning → Active)
- Copy **DNS name** (dạng `ticketrush-alb-xxxxx.ap-southeast-1.elb.amazonaws.com`)
- Kiểm tra Target Group → Tab **Targets**: Sẽ trống (chưa có EC2), đây là bình thường

**⚠️ Lưu ý quan trọng:**
- Target Group dùng port **8000** (FastAPI backend)
- ALB listener nghe port **80** (public) → forward đến port 8000
- Nếu `tr-app-tg` cũ đang dùng port 80, cần xóa và tạo lại với port 8000

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
