import { PageContainer } from '@ant-design/pro-components';
import { App, Card, Space, Tag, Typography, Divider, Row, Col, Statistic } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState, useMemo } from 'react';
import { history } from '@umijs/max';
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
  const [vehicles, setVehicles] = useState<VehicleIncomeItem[]>([]);
  const [statisticsData, setStatisticsData] = useState<API.DailyStatisticsData | null>(null);
  const [historyPendingDates, setHistoryPendingDates] = useState<string[]>([]);
  
  // Modal相关状态
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedIncome, setSelectedIncome] = useState<API.DailyIncome | null>(null);
  
  const today = dayjs().format('YYYY-MM-DD');

  // 加载当天车辆数据
  const loadTodayVehicles = async () => {
    try {
      const result = await getIncomesByDate(today);
      setVehicles(result.vehicles);
    } catch (error: any) {
      if (error?.response?.status === 403) return;
      messageApi.error(error?.message || '加载车辆数据失败');
    }
  };

  // 加载当天统计数据
  const loadStatisticsData = async () => {
    try {
      const result = await getStatisticsByDate(today);
      if (result?.statistics) {
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
    }
  };

  // 加载历史待办日期
  const loadHistoryPendingDates = async () => {
    try {
      const start = dayjs().startOf('month');
      const end = dayjs().subtract(1, 'day');
      if (end.isBefore(start)) {
        setHistoryPendingDates([]);
        return;
      }
      const datesToCheck: string[] = [];
      let d = start;
      while (!d.isAfter(end)) {
        datesToCheck.push(d.format('YYYY-MM-DD'));
        d = d.add(1, 'day');
      }
      const results = await Promise.all(
        datesToCheck.map((date) =>
          getIncomesByDate(date).catch(() => ({ vehicles: [] }))
        )
      );
      const pending: string[] = [];
      results.forEach((res, i) => {
        const hasPending = res.vehicles?.some(
          (v) => !v.is_rest && !v.has_income
        );
        if (hasPending) pending.push(datesToCheck[i]);
      });
      pending.sort((a, b) => (a > b ? -1 : 1));
      setHistoryPendingDates(pending);
    } catch (e) {
      if ((e as any)?.response?.status === 403) return;
      setHistoryPendingDates([]);
    }
  };

  // 初始化加载数据
  useEffect(() => {
    loadTodayVehicles();
    loadStatisticsData();
    loadHistoryPendingDates();
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

  // 点击待录入车辆：打开Modal进行新增
  const handlePendingClick = (vehicle: VehicleIncomeItem) => {
    setSelectedVehicleId(vehicle.vehicle_id);
    setSelectedIncome(null); // 新增模式，income为null
    setModalOpen(true);
  };

  // 点击已录入车辆：打开Modal进行编辑
  const handleEnteredClick = (vehicle: VehicleIncomeItem) => {
    setSelectedVehicleId(vehicle.vehicle_id);
    setSelectedIncome(vehicle.income); // 编辑模式，传入已有数据
    setModalOpen(true);
  };

  // Modal关闭处理
  const handleModalCancel = () => {
    setModalOpen(false);
    setSelectedVehicleId('');
    setSelectedIncome(null);
  };

  // Modal保存成功处理：刷新所有数据
  const handleModalSuccess = () => {
    loadTodayVehicles();
    loadStatisticsData();
    loadHistoryPendingDates();
  };

  // 跳转到收入录入页面
  const goToIncomeEntry = (date: string) => {
    history.push(`/income/entry?date=${date}`);
  };

  return (
    <PageContainer>
      {/* 第一排：日期信息模块 + 当日统计 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <DateInfoModule />
        </Col>
        <Col xs={24} lg={10}>
          <Card title="当日统计">
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

      {/* 第二排：左侧今日待办+已录入+休息，右侧历史待办 */}
      <Row gutter={16}>
        {/* 左侧：今日待办、已录入、休息 */}
        <Col xs={24} lg={14}>
          <Card>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {/* 今日待办：未录入的车辆 */}
              <div>
                <Typography.Title level={5} style={{ marginBottom: 16 }}>
                  今日待办
                  <Tag color="default" style={{ marginLeft: 8 }}>
                    {categorizedVehicles.pending.length}
                  </Tag>
                </Typography.Title>
                <Space wrap size={[8, 8]}>
                  {categorizedVehicles.pending.length === 0 ? (
                    <Typography.Text type="secondary">暂无待办车辆</Typography.Text>
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
                        onClick={() => handlePendingClick(vehicle)}
                      >
                        {vehicle.vehicle_id}
                      </Tag>
                    ))
                  )}
                </Space>
              </div>

              <Divider />

              {/* 已录入：已录入的车辆 */}
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
                        onClick={() => handleEnteredClick(vehicle)}
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

        {/* 右侧：历史待办 */}
        <Col xs={24} lg={10}>
          <Card title="历史待办">
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              当月今日以前存在未录入信息的日期
            </Typography.Text>
            {historyPendingDates.length === 0 ? (
              <Typography.Text type="secondary">暂无</Typography.Text>
            ) : (
              <Space wrap size={[8, 8]}>
                {historyPendingDates.map((dateStr) => (
                  <Tag
                    key={dateStr}
                    color="blue"
                    style={{
                      cursor: 'pointer',
                      padding: '4px 12px',
                      fontSize: '14px',
                      borderRadius: '4px',
                    }}
                    onClick={() => goToIncomeEntry(dateStr)}
                  >
                    {dayjs(dateStr).format('M月D日')}
                  </Tag>
                ))}
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      {/* 数据录入弹窗 */}
      {selectedVehicleId && (
        <IncomeEntryModal
          open={modalOpen}
          vehicleId={selectedVehicleId}
          date={today}
          income={selectedIncome}
          onCancel={handleModalCancel}
          onSuccess={handleModalSuccess}
        />
      )}
    </PageContainer>
  );
}
