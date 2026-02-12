import { Card, Row, Col } from 'antd';
import dayjs from 'dayjs';
import DateInfoCard from '../DateInfoCard/index';

export default function DateInfoModule() {
  const today = dayjs();
  const targetDate = dayjs().add(1, 'day');

  return (
    <Card>
      <Row gutter={0}>
        {/* 左侧：今日信息 */}
        <Col
          xs={24}
          sm={12}
          style={{
            paddingRight: 24,
            borderRight: '1px solid #e8e8e8',
            paddingBottom: 0,
            marginBottom: 0,
          }}
        >
          <DateInfoCard date={today} title="今日" />
        </Col>
        {/* 右侧：明天信息 */}
        <Col xs={24} sm={12} style={{ paddingLeft: 24 }}>
          <DateInfoCard date={targetDate} title="明天" />
        </Col>
      </Row>
    </Card>
  );
}
