#!/bin/bash
# EC2 초기 환경 구성 스크립트
# 사용법: EC2에 SSH 접속 후 아래 명령어 실행
#   chmod +x ec2-setup.sh && ./ec2-setup.sh

set -e

echo "=== [1/4] JDK 17 설치 ==="
sudo dnf install java-17-amazon-corretto -y
java -version

echo "=== [2/4] 앱 디렉토리 생성 ==="
sudo mkdir -p /opt/interview-app
sudo chown ec2-user:ec2-user /opt/interview-app

echo "=== [3/4] .env 파일 생성 ==="
# 아래 값을 실제 RDS 엔드포인트와 비밀번호로 교체해 주세요.
cat > /opt/interview-app/.env << 'EOF'
DB_URL=jdbc:postgresql://<RDS_ENDPOINT>:5432/interview_db
DB_USERNAME=postgres
DB_PASSWORD=<RDS_PASSWORD>
JWT_SECRET=<32자_이상_랜덤_문자열>
LIVEKIT_URL=wss://ai-interview-app-niy1zwbc.livekit.cloud
LIVEKIT_API_KEY=APIUGSPKKAAVt67
LIVEKIT_API_SECRET=nN912i55p0YWCIGK1tGJv5FXbqFdt69BUrgKpnDbbfM
EOF
echo ".env 파일 생성 완료. /opt/interview-app/.env 에서 실제 값으로 수정하세요."

echo "=== [4/4] systemd 서비스 등록 ==="
sudo tee /etc/systemd/system/interview-app.service > /dev/null << 'EOF'
[Unit]
Description=AI Interview App
After=network.target

[Service]
User=ec2-user
WorkingDirectory=/opt/interview-app
ExecStart=/usr/bin/java -Dspring.profiles.active=prod -jar /opt/interview-app/app.jar
SuccessExitStatus=143
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable interview-app

echo ""
echo "=== 설정 완료 ==="
echo "다음 단계:"
echo "  1. /opt/interview-app/.env 파일의 <RDS_ENDPOINT>, <RDS_PASSWORD>, <JWT_SECRET> 값을 실제 값으로 교체"
echo "  2. GitHub Actions가 첫 배포 후 자동으로 서비스를 시작합니다"
echo ""
echo "로그 확인 명령어: sudo journalctl -u interview-app -f"
