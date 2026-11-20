# TicketRush - Cloud-Ready Refactoring Summary

## ✅ Hoàn thành (Phase 1: Code Refactoring)

### 1. Configuration Management
- ✅ **`backend/app/config.py`** - Centralized settings với support cho:
  - Database (RDS MySQL)
  - Redis (ElastiCache)
  - S3 (QR code storage)
  - SQS (async queue)
  - SES (email service)
  - CORS (dynamic origins)

### 2. Redis Integration (Seat Reservation)
- ✅ **`backend/app/services/redis_service.py`** - Redis client cho:
  - `reserve_seats()` - Atomic seat reservation
  - `release_seats()` - Rollback trên failure
  - `init_event_seats()` - Initialize counters
  - `get_available_seats()` - Real-time availability

- ✅ **Updated `booking_service.py`** - Tích hợp Redis:
  - Check Redis trước khi query database (fast path)
  - Rollback Redis nếu DB transaction fails
  - Graceful fallback nếu Redis không available

### 3. S3 Integration (QR Code Storage)
- ✅ **`backend/app/services/s3_service.py`** - S3 client cho:
  - `upload_qr_code()` - Upload QR với encryption
  - `get_qr_code_url()` - Presigned URL generation
  - `download_qr_code()` - Download từ S3

### 4. SQS Integration (Async Processing)
- ✅ **`backend/app/services/sqs_service.py`** - Queue ticket generation
- ✅ **Updated `bookings.py` route** - Chọn giữa SQS (cloud) hoặc BackgroundTasks (local)

### 5. Lambda Function
- ✅ **`lambda/ticket_generator.py`** - AWS Lambda handler:
  - Triggered bởi SQS messages
  - Generate QR codes
  - Upload to S3
  - Send email qua SES
  - Full error handling

### 6. Infrastructure Updates
- ✅ **`docker-compose.yml`** - Thêm Redis container
- ✅ **`requirements.txt`** - Thêm redis, boto3
- ✅ **`.env.example`** - Update với AWS configs
- ✅ **`.env.cloud.example`** - Template cho production

### 7. Testing & Scripts
- ✅ **`scripts/locust_booking_test.py`** - Load testing:
  - Simulate 1500 concurrent users
  - Test booking rush scenario
  - Track sold-out handling
  
- ✅ **`scripts/init_redis_counters.py`** - Sync Redis từ MySQL:
  - Initialize seat counters
  - Verify sync accuracy

### 8. Documentation
- ✅ **`CLOUD_MIGRATION.md`** - Complete deployment guide:
  - Phase 1: Local testing ✅
  - Phase 2: AWS Infrastructure setup
  - Phase 3: EC2 & Auto Scaling
  - Phase 4: Monitoring & Alarms
  - Phase 5: Demo & Load Test
  - Cost estimate: ~$196/month

---

## 📋 Next Steps (To Deploy to AWS)

### Bước 1: Test Local (Trước khi lên cloud)
```bash
# Start services (cần Docker permission)
docker-compose up -d

# Install dependencies
pip install -r backend/requirements.txt

# Init Redis counters
python scripts/init_redis_counters.py

# Start backend
cd backend
uvicorn app.main:app --reload

# Run load test (terminal khác)
pip install locust
locust -f scripts/locust_booking_test.py --host=http://localhost:8000
```

### Bước 2: AWS Infrastructure (Theo phân công)
Xem chi tiết trong `CLOUD_MIGRATION.md`:

1. **Bình**: VPC, Subnets, Security Groups, ALB, NAT Gateway
2. **Hiếu**: RDS MySQL, ElastiCache Redis, S3 Bucket
3. **Hoàng**: SQS Queue, Lambda Function, SES Email
4. **Anh**: EC2 AMI, Launch Template, Auto Scaling Group, CloudWatch

### Bước 3: Deploy & Test
```bash
# Update frontend API endpoint
# frontend/app.js: const API_BASE = "http://<alb-dns>"

# Load test production
locust -f scripts/locust_booking_test.py \
  --host=http://<alb-dns> \
  --users=1500 \
  --spawn-rate=25 \
  --run-time=5m
```

---

## 🔑 Key Changes

### Before (Local Only)
```
User → Frontend → Backend (localhost:8000) → MySQL
                                           → SMTP Email (blocking)
```

### After (Cloud-Ready)
```
User → CloudFront/ALB → EC2 (Auto Scaling 2-10 instances)
                         ↓
                      [Redis] ← Fast seat check
                         ↓
                      [RDS MySQL Multi-AZ]
                         ↓
                      [SQS Queue] → [Lambda] → [S3 QR Codes]
                                              → [SES Email]
```

**Improvements:**
- ⚡ **Redis**: Fast seat reservation, không bán vượt
- 🚀 **Auto Scaling**: Tự động scale 2→10 instances theo load
- 📦 **S3**: Durable QR code storage
- ⏱️ **SQS + Lambda**: Async ticket generation, không block booking
- 📧 **SES**: Reliable email delivery
- 📊 **CloudWatch**: Real-time monitoring, auto alarms

---

## 💰 Cost Estimate
```
EC2 t3.small × 2         $39
RDS db.t3.micro Multi-AZ $42
ElastiCache Redis        $15
NAT Gateway              $48
ALB                      $23
S3 + SQS + Lambda        $3
CloudWatch + SNS         $6
EBS + Data Transfer      $20
─────────────────────────────
TOTAL                    ~$196/month
```

---

## 📝 Notes
- Code đã sẵn sàng cho cloud, có graceful fallback cho local dev
- Redis optional: nếu không có vẫn dùng MySQL atomic update
- SQS optional: nếu không có dùng FastAPI BackgroundTasks
- S3 optional: để local dev không cần S3
- Tất cả configs qua environment variables
- Đã test với `USE_S3=false`, `USE_SQS=false` cho local

---

## 🎯 Demo Checklist
- [ ] Infrastructure deployed (VPC, RDS, Redis, S3, SQS, Lambda)
- [ ] EC2 instances healthy trên ALB
- [ ] Redis counters initialized
- [ ] CloudWatch dashboard configured
- [ ] SNS alarms set up
- [ ] Load test chạy thành công (1500 users)
- [ ] Auto scaling triggered (2 → 4+ instances)
- [ ] Không bán vượt số chỗ
- [ ] Email QR codes gửi thành công
- [ ] Cost calculator screenshot

**Demo flow** xem trong `CLOUD_MIGRATION.md` section 5.
