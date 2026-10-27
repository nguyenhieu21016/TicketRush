import React from 'react';

const infraItems = [
  {
    icon: '🛡️',
    title: 'ALB & VPC 2 AZ',
    desc: 'Lưu lượng đi qua Application Load Balancer tới EC2 trong Private Subnet an toàn tuyệt đối.',
  },
  {
    icon: '⚡',
    title: 'ElastiCache Redis',
    desc: 'Bộ đếm vé siêu tốc in-memory loại bỏ hoàn toàn nguy cơ oversell khi hàng nghìn request ập đến.',
  },
  {
    icon: '🔄',
    title: 'SQS & Serverless Lambda',
    desc: 'Tách tác vụ nặng (tạo vé QR, gửi SES) ra khỏi luồng đăng ký, giải phóng tài nguyên máy chủ tức thì.',
  },
  {
    icon: '🗄️',
    title: 'Amazon RDS Multi-AZ',
    desc: 'Cơ sở dữ liệu MySQL đồng bộ tự động giữa 2 Availability Zone, sao lưu định kỳ, không lo sập nguồn.',
  },
];

const InfraHighlights: React.FC = () => {
  return (
    <section className="infra-highlights">
      <h2 className="section-title">Hạ Tầng Điện Toán Đám Mây Hậu Thuẫn</h2>
      <div className="grid-cards">
        {infraItems.map((item, idx) => (
          <div className="infra-card" key={idx}>
            <div className="infra-icon">{item.icon}</div>
            <h3>{item.title}</h3>
            <p>{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default InfraHighlights;
