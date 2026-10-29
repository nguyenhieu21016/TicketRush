#!/bin/bash
# ==============================================================================
# Script đóng gói mã nguồn Lambda Function thành file `lambda.zip` để tải lên AWS.
#
# Cách chạy:
#   bash backend/lambda/build.sh
#
# Lưu ý:
#   Thư viện `segno` là pure Python (không có C-extension) nên có thể đóng gói
#   trực tiếp trên bất kỳ hệ điều hành nào (Windows Git Bash / Mac / Linux)
#   mà vẫn chạy tương thích 100% trên môi trường AWS Lambda runtime Python 3.12.
# ==============================================================================
set -e

# Chuyển vào thư mục chứa script
cd "$(dirname "$0")"

echo "-> Dọn dẹp bản build cũ..."
rm -rf pkg lambda.zip && mkdir pkg

echo "-> Đang tải và cài đặt thư viện 'segno' vào thư mục đóng gói..."
pip install segno -t pkg -q

echo "-> Sao chép code lambda_function.py vào gói..."
cp lambda_function.py pkg/

echo "-> Nén thành file lambda.zip..."
(cd pkg && zip -qr ../lambda.zip .)

echo "-> Xóa thư mục tạm..."
rm -rf pkg

echo "Hoàn thành! File triển khai: backend/lambda/lambda.zip"
