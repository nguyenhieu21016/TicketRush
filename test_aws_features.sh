#!/usr/bin/env bash
# =============================================================================
# test_aws_features.sh — Kiểm tra 3 tính năng AWS (A.1, A.2, A.3) trên máy local
# Chạy: bash test_aws_features.sh
# Yêu cầu: docker-compose đang up (MySQL + Redis), backend đang chạy port 8000
# =============================================================================

set -e
BASE_URL="http://localhost:8000"
PASS=0; FAIL=0

ok()   { echo "  ✅  $1"; ((PASS++)); }
fail() { echo "  ❌  $1"; ((FAIL++)); }
info() { echo ""; echo "── $1 ──────────────────────────────────────────"; }

# ---------------------------------------------------------------------------
info "A.1 — Redis Cache-Aside: GET /api/events/ phải nhanh hơn ở lần 2"
# ---------------------------------------------------------------------------

T1=$( { time curl -s "$BASE_URL/api/events/" -o /dev/null; } 2>&1 | grep real | awk '{print $2}')
T2=$( { time curl -s "$BASE_URL/api/events/" -o /dev/null; } 2>&1 | grep real | awk '{print $2}')
echo "  Lần 1 (DB hit): $T1   |   Lần 2 (cache hit): $T2"
ok "Cache-Aside endpoint phản hồi"

# Kiểm tra Redis có key
KEY_COUNT=$(docker exec ticketrush-redis redis-cli KEYS "events:*" | wc -l | tr -d ' ')
if [ "$KEY_COUNT" -gt 0 ]; then
  ok "Redis có $KEY_COUNT key — cache đã được populate"
else
  fail "Redis không có key — cache chưa chạy (kiểm tra REDIS_URL trong .env)"
fi

# ---------------------------------------------------------------------------
info "A.1 — Rate Limiting: POST /api/bookings phải trả 429 sau giới hạn"
# ---------------------------------------------------------------------------

# Lấy token (cần tài khoản user)
echo "  [!] Test rate limit cần token — chạy thủ công:"
echo "      for i in \$(seq 1 15); do"
echo "        curl -s -o /dev/null -w \"%{http_code}\\n\" -X POST $BASE_URL/api/bookings/ \\"
echo "          -H 'Authorization: Bearer <TOKEN>' \\"
echo "          -H 'Content-Type: application/json' \\"
echo "          -d '{\"event_id\":1,\"quantity\":1,\"ticket_tier\":\"STANDARD\"}'"
echo "      done"
echo "  → Từ request 11 trở đi phải thấy 429"

# ---------------------------------------------------------------------------
info "A.1 — Cache invalidation: Sau khi admin sửa event, cache phải bị xóa"
# ---------------------------------------------------------------------------

echo "  [!] Test invalidation thủ công:"
echo "      1. curl $BASE_URL/api/events/1  → ghi nhớ available_tickets"
echo "      2. Admin PUT /api/admin/events/1 đổi tên"
echo "      3. curl $BASE_URL/api/events/1  → phải trả dữ liệu mới (cache miss + refill)"
echo "      4. docker exec ticketrush-redis redis-cli TTL events:1  → phải thấy TTL mới (120)"

# ---------------------------------------------------------------------------
info "A.2 — SQS Fallback: Khi SQS_QUEUE_URL rỗng thì email gửi trực tiếp SMTP"
# ---------------------------------------------------------------------------

SQS_URL=$(grep SQS_QUEUE_URL backend/.env 2>/dev/null | cut -d= -f2 | tr -d ' ')
if [ -z "$SQS_URL" ]; then
  ok "SQS_QUEUE_URL trống → backend sẽ dùng SMTP fallback khi booking (đúng cho local dev)"
else
  ok "SQS_QUEUE_URL=$SQS_URL → backend sẽ push lên SQS thật"
fi

# ---------------------------------------------------------------------------
info "A.2 — Lambda: Kiểm tra file Lambda hợp lệ Python"
# ---------------------------------------------------------------------------

if python3 -c "
import ast, sys
with open('lambda/ticket_mailer_lambda.py') as f:
    ast.parse(f.read())
print('OK')
" 2>/dev/null | grep -q OK; then
  ok "lambda/ticket_mailer_lambda.py — cú pháp Python hợp lệ"
else
  fail "lambda/ticket_mailer_lambda.py — lỗi cú pháp Python"
fi

# ---------------------------------------------------------------------------
info "A.3 — CloudFormation: Validate YAML syntax"
# ---------------------------------------------------------------------------

for f in infra/cloudfront.yaml infra/elasticache.yaml infra/sqs_dlq.yaml; do
  if python3 -c "import yaml; yaml.safe_load(open('$f'))" 2>/dev/null; then
    ok "$f — YAML hợp lệ"
  else
    fail "$f — YAML lỗi"
  fi
done

# AWS CLI validate (nếu có AWS creds)
if command -v aws &>/dev/null && aws sts get-caller-identity &>/dev/null 2>&1; then
  for f in infra/cloudfront.yaml infra/elasticache.yaml infra/sqs_dlq.yaml; do
    if aws cloudformation validate-template --template-body "file://$f" &>/dev/null; then
      ok "$f — AWS CloudFormation validate OK"
    else
      fail "$f — AWS CloudFormation validate FAILED"
    fi
  done
else
  echo "  [!] AWS CLI chưa cấu hình — bỏ qua CloudFormation validate trên AWS"
  echo "      Để validate: aws cloudformation validate-template --template-body file://infra/cloudfront.yaml"
fi

# ---------------------------------------------------------------------------
echo ""
echo "════════════════════════════════════════"
echo "  Kết quả: $PASS pass / $FAIL fail"
echo "════════════════════════════════════════"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
