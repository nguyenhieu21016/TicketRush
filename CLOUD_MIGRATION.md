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
export REDIS_SSL=true
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

### 2.5 SQS Queue (Hoàng) - Console

#### Bước 1: Tạo SQS Queue
1. **SQS → Queues → Create queue**
2. **Type**: Standard (không cần FIFO cho ticket generation)
3. **Name**: `ticketrush-ticket-generation`
4. **Configuration**:
   - Visibility timeout: 60 seconds
   - Message retention period: 1 hour (3600 seconds)
   - Delivery delay: 0 seconds
   - Maximum message size: 256 KB
   - Receive message wait time: 0 seconds (short polling)
5. **Access policy**: Keep default (only queue owner)
6. **Encryption**: Disabled (optional, có thể enable để bảo mật)
7. **Dead-letter queue**: Không cấu hình (optional, dùng cho retry failed messages)
8. Click **Create queue**

#### Bước 2: Copy Queue URL
- Sau khi tạo xong, copy **URL** (dạng `https://sqs.ap-southeast-1.amazonaws.com/<account-id>/ticketrush-ticket-generation`)
- Lưu lại để dùng trong environment variables

### 2.6 Lambda Function (Hoàng) - Console

#### Bước 1: Tạo IAM Role cho Lambda
1. **IAM → Roles → Create role**
2. **Trusted entity type**: AWS service
3. **Use case**: Lambda → Click **Next**
4. **Add permissions** (search và attach các policies sau):
   - `AWSLambdaBasicExecutionRole` (CloudWatch Logs)
   - `AWSLambdaSQSQueueExecutionRole` (đọc SQS messages)
   - `AmazonS3FullAccess` (upload QR codes)
   - `AmazonSESFullAccess` (send emails)
   - `AmazonRDSDataFullAccess` (query database)
5. **Role name**: `ticketrush-lambda-execution-role`
6. Click **Create role**

#### Bước 2: Package Lambda code
```bash
cd lambda
pip install -r requirements.txt -t package/
cp ticket_generator.py package/
cd package
zip -r ../lambda-function.zip .
cd ..
```

#### Bước 3: Tạo Lambda Function
1. **Lambda → Functions → Create function**
2. **Function name**: `ticketrush-ticket-generator`
3. **Runtime**: Python 3.11
4. **Architecture**: x86_64
5. **Permissions**: Use an existing role → Chọn `ticketrush-lambda-execution-role`
6. Click **Create function**

#### Bước 4: Upload code
1. Trong function vừa tạo → Tab **Code**
2. Click **Upload from** → **.zip file**
3. Chọn file `lambda-function.zip` vừa tạo → Click **Save**

#### Bước 5: Configure
1. Tab **Configuration** → **General configuration** → Click **Edit**:
   - Memory: 512 MB
   - Timeout: 60 seconds
   - Click **Save**

2. Tab **Configuration** → **Environment variables** → Click **Edit** → Add:
   ```
   DB_HOST=<rds-endpoint>
   DB_USER=admin
   DB_PASSWORD=<rds-password>
   DB_NAME=ticketrush_db
   S3_BUCKET_NAME=ticketrush-qr-codes-<random>
   AWS_REGION=ap-southeast-1
   SES_FROM_EMAIL=noreply@yourdomain.com
   ```
   - Click **Save**

#### Bước 6: Add SQS Trigger
1. Tab **Configuration** → **Triggers** → Click **Add trigger**
2. **Select a source**: SQS
3. **SQS queue**: Chọn `ticketrush-ticket-generation`
4. **Batch size**: 10
5. **Batch window**: 0 seconds
6. Click **Add**

#### Bước 7: Test (optional)
1. Tab **Test** → Create test event:
```json
{
  "Records": [
    {
      "body": "{\"booking_id\": 1, \"action\": \"generate_tickets\"}"
    }
  ]
}
```
2. Click **Test** → Check logs để verify

### 2.7 SES Email (Hoàng) - Console

#### Bước 1: Verify Email Address
1. **SES → Verified identities → Create identity**
2. **Identity type**: Email address
3. **Email address**: `noreply@yourdomain.com` (hoặc email bạn muốn dùng)
4. Click **Create identity**
5. **Check email**: AWS sẽ gửi verification email → Click link trong email để verify

#### Bước 2: Test Email Sending (trong sandbox mode)
1. Vào identity vừa verify → Tab **Send test email**
2. **From address**: `noreply@yourdomain.com`
3. **Scenario**: Custom
4. **Subject**: Test TicketRush Email
5. **Body**: Test message
6. **To addresses**: Email của bạn (phải verify trước trong sandbox mode)
7. Click **Send test email**

#### Bước 3: Request Production Access (nếu cần gửi đến email chưa verify)
1. **SES → Account dashboard** (sidebar trái)
2. Nếu thấy banner **"Your account is in the sandbox"** → Click **Request production access**
3. **Mail type**: Transactional
4. **Website URL**: URL website của bạn (hoặc GitHub repo)
5. **Use case description**: 
   ```
   Sending booking confirmation emails and QR code tickets 
   for TicketRush event booking platform. Emails are only 
   sent to users who successfully book tickets.
   ```
6. **Additional contacts**: Email của bạn
7. Acknowledge compliance: ✅
8. Click **Submit request**
9. Đợi AWS approval (thường 1-2 ngày)

**⚠️ Lưu ý:**
- Trong **sandbox mode**: Chỉ gửi được đến email đã verify
- Sau khi có **production access**: Gửi được đến bất kỳ email nào
- Để demo/test: Verify thêm vài email test accounts là đủ

---

## Phase 3: EC2 Setup & Auto Scaling (Anh)

### 3.1 Create AMI - Console

#### Bước 1: Launch temporary EC2 instance
1. **EC2 → Instances → Launch instances**
2. **Name**: `ticketrush-setup-temp`
3. **AMI**: Amazon Linux 2023 (hoặc Amazon Linux 2)
4. **Instance type**: t3.micro (đủ cho setup)
5. **Key pair**: Chọn hoặc tạo key pair mới (để SSH)
6. **Network settings**:
   - VPC: `vpc-0f8b9f335902973a1`
   - Subnet: Chọn `tr-app-a` (private subnet)
   - Auto-assign public IP: **Disable** (vì ở private subnet)
7. **Security group**: Chọn `tr-app-sg`
8. Click **Launch instance**

#### Bước 2: SSH vào instance và setup
**⚠️ Lưu ý**: Instance ở private subnet, cần SSH qua bastion host hoặc Session Manager

**Option A: Dùng AWS Systems Manager Session Manager (khuyên dùng, không cần bastion)**
1. **IAM → Roles → Create role**
   - Trusted entity: AWS service → EC2
   - Add permission: `AmazonSSMManagedInstanceCore`
   - Role name: `ticketrush-ec2-ssm-role`
2. **EC2 → Instance → Actions → Security → Modify IAM role**
   - Chọn `ticketrush-ec2-ssm-role` → Update
3. **EC2 → Instance → Connect → Session Manager → Connect**

**Setup commands:**
```bash
# Update system
sudo yum update -y
sudo yum install -y python3.11 python3.11-pip git

# Clone repo (thay <your-repo-url> bằng repo thực)
cd /opt
sudo git clone <your-repo-url> ticketrush
cd ticketrush/backend
sudo pip3.11 install -r requirements.txt

# Create .env file (sẽ update sau khi có RDS/Redis endpoints)
sudo tee /opt/ticketrush/backend/.env <<EOF
DB_HOST=<will-update-later>
DB_USER=admin
DB_PASSWORD=<will-update-later>
DB_NAME=ticketrush_db
REDIS_HOST=<will-update-later>
REDIS_PORT=6379
S3_BUCKET_NAME=<will-update-later>
SQS_QUEUE_URL=<will-update-later>
SES_FROM_EMAIL=noreply@yourdomain.com
AWS_REGION=ap-southeast-1
USE_S3=true
USE_SQS=true
USE_SES=true
APP_ENV=production
DEBUG=false
EOF

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

# Enable service (sẽ tự động start khi boot)
sudo systemctl enable ticketrush

# Test (optional - cần có database endpoints trước)
# sudo systemctl start ticketrush
# sudo systemctl status ticketrush
```

#### Bước 3: Create AMI từ instance
1. **EC2 → Instances → Chọn instance `ticketrush-setup-temp`**
2. **Actions → Image and templates → Create image**
3. **Image name**: `ticketrush-api-v1`
4. **Image description**: `TicketRush FastAPI backend with Python 3.11`
5. **No reboot**: Bỏ chọn (để đảm bảo filesystem consistency)
6. Click **Create image**
7. Đợi AMI status: **Available** (5-10 phút)
8. Copy **AMI ID** (dạng `ami-xxxxx`)

#### Bước 4: Terminate temporary instance
1. **EC2 → Instances → Chọn instance `ticketrush-setup-temp`**
2. **Instance state → Terminate instance**

### 3.2 Create Launch Template - Console

#### Bước 1: Create IAM Instance Profile (nếu chưa có)
1. **IAM → Roles → Create role**
2. **Trusted entity type**: AWS service
3. **Use case**: EC2 → Click **Next**
4. **Add permissions** (attach các policies sau):
   - `AmazonSSMManagedInstanceCore` (Session Manager access)
   - `AmazonS3FullAccess` (upload QR codes)
   - `AmazonSQSFullAccess` (send messages to queue)
   - `AmazonSESFullAccess` (send emails - nếu backend gửi email)
   - `CloudWatchAgentServerPolicy` (metrics và logs)
5. **Role name**: `ticketrush-ec2-role`
6. Click **Create role**

#### Bước 2: Create Launch Template
1. **EC2 → Launch Templates → Create launch template**
2. **Launch template name**: `ticketrush-lt`
3. **Template version description**: `v1 - Initial version`
4. **Application and OS Images (AMI)**:
   - Click **My AMIs** tab
   - Chọn AMI vừa tạo: `ticketrush-api-v1`
5. **Instance type**: `t3.small` (2 vCPU, 2 GB RAM - đủ cho production nhỏ)
6. **Key pair**: Chọn key pair (hoặc "Don't include in launch template" nếu chỉ dùng Session Manager)
7. **Network settings**:
   - Subnet: **Don't include in launch template** (Auto Scaling sẽ chọn)
   - Security groups: Chọn `tr-app-sg`
8. **Advanced details**:
   - IAM instance profile: Chọn `ticketrush-ec2-role`
   - **User data** (paste script sau):
   ```bash
   #!/bin/bash
   # Update environment file với actual endpoints
   cat > /opt/ticketrush/backend/.env <<EOF
   DB_HOST=YOUR_RDS_ENDPOINT
   DB_USER=admin
   DB_PASSWORD=YOUR_RDS_PASSWORD
   DB_NAME=ticketrush_db
   DB_PORT=3306
   REDIS_HOST=YOUR_ELASTICACHE_ENDPOINT
   REDIS_PORT=6379
   REDIS_SSL=true
   S3_BUCKET_NAME=YOUR_S3_BUCKET_NAME
   USE_S3=true
   SQS_QUEUE_URL=YOUR_SQS_QUEUE_URL
   USE_SQS=true
   SES_FROM_EMAIL=noreply@yourdomain.com
   USE_SES=true
   AWS_REGION=ap-southeast-1
   APP_ENV=production
   DEBUG=false
   CORS_ORIGINS=http://YOUR_ALB_DNS,https://yourdomain.com
   EOF
   
   # Start service
   systemctl start ticketrush
   systemctl status ticketrush
   EOF
   ```
9. **Resource tags**:
   - Add tag: Key = `Name`, Value = `ticketrush-api`
10. Click **Create launch template**

**⚠️ Lưu ý quan trọng:**
- Sau khi có RDS, Redis, S3, SQS endpoints → **Cần update User data** trong launch template
- Cách update: Launch Templates → Chọn template → **Actions → Modify template (Create new version)**
- Auto Scaling Group sẽ tự động dùng version mới nhất (hoặc chỉ định version cụ thể)

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

### 3.4 Auto Scaling Group - Console

#### Bước 1: Create Auto Scaling Group
1. **EC2 → Auto Scaling Groups → Create Auto Scaling group**
2. **Choose launch template**:
   - Auto Scaling group name: `ticketrush-asg`
   - Launch template: Chọn `ticketrush-lt`
   - Version: Latest
   - Click **Next**

3. **Network**:
   - VPC: `vpc-0f8b9f335902973a1`
   - Availability Zones and subnets: Chọn:
     - `tr-app-a` (ap-southeast-1a)
     - `tr-app-b` (ap-southeast-1b)
   - Click **Next**

4. **Load balancing**:
   - Load balancing: ✅ **Attach to an existing load balancer**
   - Choose from your load balancer target groups: Chọn `tr-app-tg`
   - Health checks:
     - ✅ Turn on Elastic Load Balancing health checks
     - Health check grace period: `300` seconds
   - Click **Next**

5. **Group size and scaling**:
   - **Desired capacity**: `2`
   - **Minimum capacity**: `2`
   - **Maximum capacity**: `10`
   - **Automatic scaling**: ✅ Target tracking scaling policy
     - Scaling policy name: `target-tracking-cpu`
     - Metric type: **Average CPU utilization**
     - Target value: `60` (scale khi CPU > 60%)
   - Click **Next**

6. **Add notifications** (Optional):
   - Skip → Click **Next**

7. **Add tags**:
   - Add tag: Key = `Name`, Value = `ticketrush-api`
   - Click **Next**

8. **Review** → Click **Create Auto Scaling group**

#### Bước 2: (Optional) Add ALB Request Count Scaling Policy
Nếu muốn scale dựa trên request count thay vì CPU:

1. **Auto Scaling Groups → Chọn `ticketrush-asg` → Tab Automatic scaling**
2. Click **Create dynamic scaling policy**
3. **Policy type**: Target tracking scaling
4. **Scaling policy name**: `target-tracking-alb-requests`
5. **Metric type**: **Application Load Balancer request count per target**
6. **Target group**: Chọn `tr-app-tg`
7. **Target value**: `1000` (1000 requests/target/minute)
8. Click **Create**

#### Bước 3: Verify
1. **Auto Scaling Groups → ticketrush-asg → Tab Activity**
   - Xem launch activities
2. **EC2 → Instances**
   - Sẽ thấy 2 instances mới với tag `ticketrush-api`
   - Status: Running
3. **Target Groups → tr-app-tg → Tab Targets**
   - Sẽ thấy 2 targets đang register
   - Đợi Health status: **healthy** (có thể mất 1-2 phút)
4. **Test ALB endpoint**: `http://<alb-dns-name>/health`
   - Nếu trả về 200 OK → Setup thành công!

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

AWS_REGION=ap-southeast-1
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
