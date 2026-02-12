import { PageContainer } from '@ant-design/pro-components';
import { App, Card, Space, Tag, Typography, Divider, Row, Col, Statistic } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState, useMemo } from 'react';
import { getIncomesByDate } from '@/services/dailyIncomes';
import { getStatisticsByDate } from '@/services/dailyStatistics';
import IncomeEntryModal from './components/IncomeEntryModal';
import DateInfoModule from '@/components/DateInfoModule';

interface VehicleIncomeItem {
  vehicle_id: string;
  has_income: boolean;
  income: API.DailyIncome | null;
  is_rest: boolean;
}

export default function WorkspacePage() {
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleIncomeItem[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleIncomeItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [statisticsLoading, setStatisticsLoading] = useState(false);
  const [statisticsData, setStatisticsData] = useState<API.DailyStatisticsData | null>(null);
  const today = dayjs().format('YYYY-MM-DD');

  // 金额格式化：整数不显示小数，小数保留1位
  const formatAmount = (amount: number): string => {
    if (isNaN(amount) || !isFinite(amount)) return '0';
    const truncated = Math.floor(amount * 10) / 10;
    return truncated % 1 === 0 ? truncated.toString() : truncated.toFixed(1);
  };

  // 加载当天车辆数据
  const loadTodayVehicles = async () => {
    setLoading(true);
    try {
      const result = await getIncomesByDate(today);
      setVehicles(result.vehicles);
    } catch (error: any) {
      if (error?.response?.status === 403) return;
      messageApi.error(error?.message || '加载车辆数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载当天统计数据
  const loadStatisticsData = async () => {
    setStatisticsLoading(true);
    try {
      const result = await getStatisticsByDate(today);
      // 确保金额字段是数字类型
      if (result && result.statistics) {
        result.statistics.total_revenue = Number(result.statistics.total_revenue) || 0;
        result.statistics.total_net_income = Number(result.statistics.total_net_income) || 0;
        result.statistics.average_revenue = Number(result.statistics.average_revenue) || 0;
        result.statistics.average_net_income = Number(result.statistics.average_net_income) || 0;
        result.statistics.vehicle_count = Number(result.statistics.vehicle_count) || 0;
        result.statistics.total_vehicle_count = Number(result.statistics.total_vehicle_count) || 0;
      }
      setStatisticsData(result);
    } catch (error: any) {
      if (error?.response?.status === 403) return;
      messageApi.error(error?.message || '加载统计数据失败');
      setStatisticsData(null);
    } finally {
      setStatisticsLoading(false);
    }
  };

  useEffect(() => {
    loadTodayVehicles();
    loadStatisticsData();
  }, []);

  // 按状态分类车辆
  const categorizedVehicles = useMemo(() => {
    const pending: VehicleIncomeItem[] = [];
    const entered: VehicleIncomeItem[] = [];
    const rest: VehicleIncomeItem[] = [];

    vehicles.forEach((vehicle) => {
      if (vehicle.is_rest) {
        rest.push(vehicle);
      } else if (vehicle.has_income) {
        entered.push(vehicle);
      } else {
        pending.push(vehicle);
      }
    });

    return { pending, entered, rest };
  }, [vehicles]);

  // 点击Tag处理
  const handleTagClick = (vehicle: VehicleIncomeItem) => {
    // 休息状态的车辆不能点击
    if (vehicle.is_rest) {
      return;
    }
    setSelectedVehicle(vehicle);
    setModalOpen(true);
  };

  // 弹窗关闭处理
  const handleModalCancel = () => {
    setModalOpen(false);
    setSelectedVehicle(null);
  };

  // 保存成功后刷新数据
  const handleModalSuccess = () => {
    loadTodayVehicles();
    loadStatisticsData();
  };

  return (
    <PageContainer>
      {/* 日期信息模块 */}
      <div style={{ marginBottom: 16 }}>
        <DateInfoModule />
      </div>

      <Row gutter={16}>
        {/* 左侧：车辆信息 */}
        <Col xs={24} lg={14}>
          <Card>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>

              {/* 待录入车辆 */}
              <div>
                <Typography.Title level={5} style={{ marginBottom: 16 }}>
                  待录入
                  <Tag color="default" style={{ marginLeft: 8 }}>
                    {categorizedVehicles.pending.length}
                  </Tag>
                </Typography.Title>
                <Space wrap size={[8, 8]}>
                  {categorizedVehicles.pending.length === 0 ? (
                    <Typography.Text type="secondary">暂无待录入车辆</Typography.Text>
                  ) : (
                    categorizedVehicles.pending.map((vehicle) => (
                      <Tag
                        key={vehicle.vehicle_id}
                        color="default"
                        style={{
                          cursor: 'pointer',
                          padding: '4px 12px',
                          fontSize: '14px',
                          borderRadius: '4px',
                        }}
                        onClick={() => handleTagClick(vehicle)}
                      >
                        {vehicle.vehicle_id}
                      </Tag>
                    ))
                  )}
                </Space>
              </div>

              <Divider />

              {/* 已录入车辆 */}
              <div>
                <Typography.Title level={5} style={{ marginBottom: 16 }}>
                  已录入
                  <Tag color="success" style={{ marginLeft: 8 }}>
                    {categorizedVehicles.entered.length}
                  </Tag>
                </Typography.Title>
                <Space wrap size={[8, 8]}>
                  {categorizedVehicles.entered.length === 0 ? (
                    <Typography.Text type="secondary">暂无已录入车辆</Typography.Text>
                  ) : (
                    categorizedVehicles.entered.map((vehicle) => (
                      <Tag
                        key={vehicle.vehicle_id}
                        color="success"
                        style={{
                          cursor: 'pointer',
                          padding: '4px 12px',
                          fontSize: '14px',
                          borderRadius: '4px',
                        }}
                        onClick={() => handleTagClick(vehicle)}
                      >
                        {vehicle.vehicle_id}
                      </Tag>
                    ))
                  )}
                </Space>
              </div>

              <Divider />

              {/* 休息车辆 */}
              <div>
                <Typography.Title level={5} style={{ marginBottom: 16 }}>
                  休息
                  <Tag color="warning" style={{ marginLeft: 8 }}>
                    {categorizedVehicles.rest.length}
                  </Tag>
                </Typography.Title>
                <Space wrap size={[8, 8]}>
                  {categorizedVehicles.rest.length === 0 ? (
                    <Typography.Text type="secondary">今日无休息车辆</Typography.Text>
                  ) : (
                    categorizedVehicles.rest.map((vehicle) => (
                      <Tag
                        key={vehicle.vehicle_id}
                        color="warning"
                        style={{
                          padding: '4px 12px',
                          fontSize: '14px',
                          borderRadius: '4px',
                        }}
                      >
                        {vehicle.vehicle_id}
                      </Tag>
                    ))
                  )}
                </Space>
              </div>
            </Space>
          </Card>
        </Col>

        {/* 右侧：统计数据 */}
        <Col xs={24} lg={10}>
          <Card title="当日统计" loading={statisticsLoading}>
            {statisticsData?.statistics ? (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="总营业额"
                      value={statisticsData.statistics.total_revenue}
                      precision={1}
                      suffix="元"
                      valueStyle={{ color: '#1677ff' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="总净收入"
                      value={statisticsData.statistics.total_net_income}
                      precision={1}
                      suffix="元"
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="平均营业额"
                      value={statisticsData.statistics.average_revenue}
                      precision={1}
                      suffix="元"
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="平均净收入"
                      value={statisticsData.statistics.average_net_income}
                      precision={1}
                      suffix="元"
                    />
                  </Col>
                </Row>
                <Divider style={{ margin: '16px 0' }} />
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="已录入车辆"
                      value={statisticsData.statistics.vehicle_count}
                      suffix={`/ ${statisticsData.statistics.total_vehicle_count}`}
                      valueStyle={{ color: '#722ed1' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="休息车辆"
                      value={statisticsData.statistics.rest_vehicle_count || 0}
                      valueStyle={{ color: '#fa8c16' }}
                    />
                  </Col>
                </Row>
              </Space>
            ) : (
              <Typography.Text type="secondary">暂无统计数据</Typography.Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* 数据录入弹窗 */}
      {selectedVehicle && (
        <IncomeEntryModal
          open={modalOpen}
          vehicleId={selectedVehicle.vehicle_id}
          date={today}
          income={selectedVehicle.income}
          onCancel={handleModalCancel}
          onSuccess={handleModalSuccess}
        />
      )}
    </PageContainer>
  );
}
