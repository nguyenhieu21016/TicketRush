#!/bin/bash
# Tạo lambda.zip (segno là thư viện thuần Python nên build trên máy nào cũng được)
set -e
cd "$(dirname "$0")"
rm -rf pkg lambda.zip && mkdir pkg
pip install segno -t pkg -q
cp lambda_function.py pkg/
(cd pkg && zip -qr ../lambda.zip .)
rm -rf pkg
echo "Xong: lambda/lambda.zip"
