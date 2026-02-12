import { Card, Row, Col } from 'antd';
import dayjs from 'dayjs';
import DateInfoCard from '../DateInfoCard/index';
import './index.less';

export default function DateInfoModule() {
  const today = dayjs();
  const targetDate = dayjs().add(1, 'day');

  return (
    <Card className="date-info-module">
      <Row gutter={0}>
        {/* 左侧：今日信息 */}
        <Col
          xs={24}
          sm={12}
          className="date-info-col-left"
        >
          <DateInfoCard date={today} title="今日" />
        </Col>
        {/* 右侧：明天信息 */}
        <Col 
          xs={24} 
          sm={12} 
          className="date-info-col-right"
        >
          <DateInfoCard date={targetDate} title="明天" />
        </Col>
      </Row>
    </Card>
  );
}
