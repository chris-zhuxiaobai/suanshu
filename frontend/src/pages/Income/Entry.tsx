import DailyStatisticsView from '@/components/DailyStatisticsView';
import { PageContainer } from '@ant-design/pro-components';
import { App, Button, Card, DatePicker, Form, Input, InputNumber, Row, Col, Select, Space, Table, Tabs, Tag } from 'antd';
import { SaveOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { createDailyIncome, getIncomesByDate, updateDailyIncome } from '@/services/dailyIncomes';
import { getSchedulesByMonth } from '@/services/conductorSchedules';
import { getStatisticsByDate } from '@/services/dailyStatistics';

interface VehicleIncomeItem {
  vehicle_id: string;
  has_income: boolean;
  income: API.DailyIncome | null;
  is_rest: boolean;
}

interface LocalIncomeData {
  conductor_id: string;
  turn1_amount: number | null;
  turn2_amount: number | null;
  turn3_amount: number | null;
  turn4_amount: number | null;
  turn5_amount: number | null;
  wechat_amount: number;
  fuel_subsidy: number;
  reward_penalty: number;
  remark?: string;
}

export default function IncomeEntryPage() {
  const { message: messageApi } = App.useApp();
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [activeTab, setActiveTab] = useState<string>('entry');
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleIncomeItem[]>([]);
  const [conductorSchedules, setConductorSchedules] = useState<Record<string, string>>({});
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [incomeStatusFilter, setIncomeStatusFilter] = useState<'all' | 'entered' | 'not_entered'>('all');
  const [localIncomes, setLocalIncomes] = useState<Record<string, LocalIncomeData>>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [savingVehicles, setSavingVehicles] = useState<Set<string>>(new Set());
  const [statisticsLoading, setStatisticsLoading] = useState(false);
  const [statisticsData, setStatisticsData] = useState<API.DailyStatisticsData | null>(null);

  // 加载售票员排班（用于默认填充售票员）
  const loadConductorSchedules = async (date: Dayjs): Promise<Record<string, string>> => {
    try {
      const year = date.year();
      const month = date.month() + 1;
      const result = await getSchedulesByMonth(year, month);
      const schedules: Record<string, string> = {};
      result.vehicles.forEach((item) => {
        if (item.conductor_id) {
          schedules[item.vehicle_id] = item.conductor_id;
        }
      });
      setConductorSchedules(schedules);
      return schedules;
    } catch (error: any) {
      console.error('加载售票员排班失败:', error);
      return {};
    }
  };

  // 加载指定日期的统计数据
  const loadStatisticsData = async (date: Dayjs) => {
    setStatisticsLoading(true);
    try {
      const dateStr = date.format('YYYY-MM-DD');
      const result = await getStatisticsByDate(dateStr);
      // 响应拦截器已经提取了 data 字段，result 就是 DailyStatisticsData
      // 确保金额字段是数字类型（后端 decimal 可能在 JSON 中变成字符串）
      if (result && result.statistics) {
        result.statistics.total_revenue = Number(result.statistics.total_revenue) || 0;
        result.statistics.total_net_income = Number(result.statistics.total_net_income) || 0;
        result.statistics.average_revenue = Number(result.statistics.average_revenue) || 0;
        result.statistics.average_net_income = Number(result.statistics.average_net_income) || 0;
        result.statistics.vehicle_count = Number(result.statistics.vehicle_count) || 0;
        result.statistics.total_vehicle_count = Number(result.statistics.total_vehicle_count) || 0;
      }
      if (result && result.vehicles) {
        result.vehicles = result.vehicles.map((v) => ({
          ...v,
          revenue: Number(v.revenue) || 0,
          net_income: Number(v.net_income) || 0,
          turn_count: Number(v.turn_count) || 0,
          payment_amount: Number(v.payment_amount) || 0,
        }));
      }
      setStatisticsData(result);
    } catch (error: any) {
      if (error?.response?.status === 403) return; // 已在全局统一提示
      messageApi.error(error?.message || '加载统计数据失败');
      setStatisticsData(null);
    } finally {
      setStatisticsLoading(false);
    }
  };

  // 加载指定日期的收入数据
  const loadIncomeData = async (date: Dayjs, schedules: Record<string, string> = {}) => {
    setLoading(true);
    try {
      const dateStr = date.format('YYYY-MM-DD');
      const result = await getIncomesByDate(dateStr);
      setVehicles(result.vehicles);

      // 初始化本地状态
      const localData: Record<string, LocalIncomeData> = {};
      result.vehicles.forEach((item) => {
        if (item.has_income && item.income) {
          localData[item.vehicle_id] = {
            conductor_id: item.income.conductor_id,
            turn1_amount: item.income.turn1_amount != null ? Number(item.income.turn1_amount) : null,
            turn2_amount: item.income.turn2_amount != null ? Number(item.income.turn2_amount) : null,
            turn3_amount: item.income.turn3_amount != null ? Number(item.income.turn3_amount) : null,
            turn4_amount: item.income.turn4_amount != null ? Number(item.income.turn4_amount) : null,
            turn5_amount: item.income.turn5_amount != null ? Number(item.income.turn5_amount) : null,
            wechat_amount: Number(item.income.wechat_amount) || 0,
            fuel_subsidy: Number(item.income.fuel_subsidy) || 0,
            reward_penalty: Number(item.income.reward_penalty) || 0,
            remark: item.income.remark,
          };
        } else {
          // 新录入，使用售票员排班的默认值
          localData[item.vehicle_id] = {
            conductor_id: schedules[item.vehicle_id] || '',
            turn1_amount: null,
            turn2_amount: null,
            turn3_amount: null,
            turn4_amount: null,
            turn5_amount: null,
            wechat_amount: 0,
            fuel_subsidy: 0,
            reward_penalty: 0,
          };
        }
      });
      setLocalIncomes(localData);
    } catch (error: any) {
      if (error?.response?.status === 403) return; // 已在全局统一提示
      messageApi.error(error?.message || '加载收入数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      const schedules = await loadConductorSchedules(selectedDate);
      await loadIncomeData(selectedDate, schedules);
      // 如果当前在统计 Tab，也加载统计数据
      if (activeTab === 'statistics') {
        await loadStatisticsData(selectedDate);
      }
    };
    loadData();
  }, [selectedDate]);

  // 切换到统计 Tab 时加载统计数据
  useEffect(() => {
    if (activeTab === 'statistics') {
      loadStatisticsData(selectedDate);
    }
  }, [activeTab]);

  // 禁用未来日期
  const disabledDate = (current: Dayjs | null) => {
    if (!current) return false;
    const today = dayjs().startOf('day');
    // 只禁用今天之后的日期，今天和之前的日期都可以选择
    return current.isAfter(today, 'day');
  };

  const handleDateChange = (date: Dayjs | null) => {
    if (!date) return;
    if (date.isAfter(dayjs())) {
      messageApi.warning('不能选择未来日期');
      return;
    }
    setSelectedDate(date);
  };

  // 截断金额到一位小数（不四舍五入）
  const truncateAmount = (amount: number): number => {
    if (isNaN(amount) || !isFinite(amount)) {
      return 0;
    }
    return Math.floor(amount * 10) / 10;
  };

  // 格式化金额显示：如果是整数不显示小数点，否则显示一位小数
  const formatAmount = (amount: number): string => {
    if (isNaN(amount) || !isFinite(amount)) {
      return '0';
    }
    const truncated = truncateAmount(amount);
    // 判断是否为整数
    if (truncated % 1 === 0) {
      return truncated.toString();
    }
    return truncated.toFixed(1);
  };

  // 更新本地收入数据（处理金额精度）
  const updateLocalIncome = (vehicleId: string, field: keyof LocalIncomeData, value: any) => {
    // 如果是金额字段，需要截断到一位小数
    const amountFields = [
      'turn1_amount',
      'turn2_amount',
      'turn3_amount',
      'turn4_amount',
      'turn5_amount',
      'wechat_amount',
      'fuel_subsidy',
      'reward_penalty',
    ];

    let processedValue = value;
    if (amountFields.includes(field) && value !== null && value !== undefined && value !== '') {
      processedValue = truncateAmount(Number(value));
    }

    setLocalIncomes((prev) => ({
      ...prev,
      [vehicleId]: {
        ...prev[vehicleId],
        [field]: processedValue,
      },
    }));
  };

  // 计算营业额
  const calculateRevenue = (data: LocalIncomeData): number => {
    let total = 0;
    for (let i = 1; i <= 5; i++) {
      const amount = data[`turn${i}_amount` as keyof LocalIncomeData] as number | null;
      if (amount !== null && amount !== undefined && !isNaN(amount)) {
        total += Number(amount);
      }
    }
    const wechatAmount = Number(data.wechat_amount) || 0;
    if (!isNaN(wechatAmount)) {
      total += wechatAmount;
    }
    return truncateAmount(total);
  };

  // 计算净收入（实际分配金额）= 营业额 - 补油款 + 奖罚
  const calculateNetIncome = (data: LocalIncomeData): number => {
    const revenue = calculateRevenue(data);
    const fuelSubsidy = Number(data?.fuel_subsidy) || 0;
    const rewardPenalty = Number(data?.reward_penalty) || 0;
    const netIncome = revenue - fuelSubsidy + rewardPenalty;
    const result = truncateAmount(netIncome);
    return isNaN(result) ? 0 : result;
  };

  // 计算转数
  const calculateTurnCount = (data: LocalIncomeData): number => {
    let count = 0;
    for (let i = 1; i <= 4; i++) {
      const amount = data[`turn${i}_amount` as keyof LocalIncomeData] as number | null;
      if (amount !== null && amount !== undefined && amount > 0) {
        count++;
      }
    }
    return count;
  };

  // 保存单个车辆收入
  const handleSaveVehicle = async (vehicleId: string) => {
    const data = localIncomes[vehicleId];
    if (!data) {
      messageApi.warning('数据加载中，请稍候');
      return;
    }

    // 获取服务员ID：优先使用已保存的收入记录中的，否则从排班中获取
    const vehicleItem = vehicles.find((v) => v.vehicle_id === vehicleId);
    const conductorId = vehicleItem?.has_income && vehicleItem.income?.conductor_id
      ? vehicleItem.income.conductor_id
      : (conductorSchedules[vehicleId] || data.conductor_id);

    if (!conductorId) {
      messageApi.warning('该车辆未配置服务员，请先在车队管理中配置服务员排班');
      return;
    }

    setSavingVehicles((prev) => new Set(prev).add(vehicleId));

    try {
      const incomeData = {
        date: selectedDate.format('YYYY-MM-DD'),
        vehicle_id: vehicleId,
        conductor_id: conductorId,
        turn1_amount: data.turn1_amount,
        turn2_amount: data.turn2_amount,
        turn3_amount: data.turn3_amount,
        turn4_amount: data.turn4_amount,
        turn5_amount: data.turn5_amount,
        wechat_amount: data.wechat_amount ?? 0,
        fuel_subsidy: data.fuel_subsidy ?? 0,
        reward_penalty: data.reward_penalty ?? 0,
        remark: data.remark,
      };

      // 检查是否已存在收入记录
      if (vehicleItem?.has_income && vehicleItem.income) {
        // 更新现有记录
        await updateDailyIncome(vehicleItem.income.id, incomeData);
        messageApi.success('更新成功');
      } else {
        // 创建新记录
        await createDailyIncome(incomeData);
        messageApi.success('保存成功');
      }

      // 折叠当前记录
      setExpandedRows((prev) => {
        const newSet = new Set(prev);
        newSet.delete(vehicleId);
        return newSet;
      });

      // 重新加载数据
      const schedules = await loadConductorSchedules(selectedDate);
      await loadIncomeData(selectedDate, schedules);
    } catch (error: any) {
      if (error?.response?.status === 403) return; // 已在全局统一提示
      const errorMessage =
        error?.response?.data?.message || error?.message || '保存失败';
      messageApi.error(errorMessage);
    } finally {
      setSavingVehicles((prev) => {
        const next = new Set(prev);
        next.delete(vehicleId);
        return next;
      });
    }
  };


  // 根据搜索关键词和录入状态过滤车辆
  const filteredVehicles = useMemo(() => {
    let filtered = vehicles;

    // 录入状态筛选
    if (incomeStatusFilter === 'entered') {
      filtered = filtered.filter((v) => v.has_income);
    } else if (incomeStatusFilter === 'not_entered') {
      filtered = filtered.filter((v) => !v.has_income);
    }

    // 搜索关键词筛选
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.trim().toLowerCase();
      filtered = filtered.filter((vehicle) =>
        vehicle.vehicle_id.toLowerCase().includes(keyword)
      );
    }

    return filtered;
  }, [vehicles, searchKeyword, incomeStatusFilter]);


  // 金额输入框格式化（限制最多一位小数）
  const amountFormatter = (value: number | undefined) => {
    if (value === undefined || value === null) return '';
    return value.toString();
  };

  const amountParser = (value: string | undefined): number => {
    if (!value) return 0;
    // 只允许数字和一个小数点
    const parsed = value.replace(/[^\d.]/g, '');
    // 确保只有一个小数点
    const parts = parsed.split('.');
    if (parts.length > 2) {
      const result = parts[0] + '.' + parts.slice(1).join('');
      return Number(result) || 0;
    }
    // 限制小数位数最多1位
    if (parts[1] && parts[1].length > 1) {
      const result = parts[0] + '.' + parts[1].substring(0, 1);
      return Number(result) || 0;
    }
    return parsed === '' ? 0 : Number(parsed) || 0;
  };

  // 奖罚金额解析器，允许负数
  const rewardPenaltyParser = (value: string | undefined): number => {
    if (!value) return 0;
    // 允许负号、数字和一个小数点，负号只能在开头
    let parsed = value.replace(/[^-?\d.]/g, '');
    // 确保负号只在开头
    const hasNegative = parsed.startsWith('-');
    parsed = parsed.replace(/-/g, '');
    if (hasNegative && parsed) {
      parsed = '-' + parsed;
    }
    // 确保只有一个小数点
    const parts = parsed.split('.');
    if (parts.length > 2) {
      parsed = parts[0] + '.' + parts.slice(1).join('');
    }
    // 限制小数位数最多1位
    if (parts.length === 2 && parts[1] && parts[1].length > 1) {
      parsed = parts[0] + '.' + parts[1].substring(0, 1);
    }
    // 处理纯负号的情况
    if (parsed === '-' || parsed === '') return 0;
    const numValue = Number(parsed);
    return isNaN(numValue) ? 0 : numValue;
  };

  const entryColumns = [
    {
      title: '车辆',
      dataIndex: 'vehicle_id',
      width: 100,
      fixed: 'left' as const,
      render: (_: any, record: VehicleIncomeItem) => (
        <Space>
          <span>{record.vehicle_id}</span>
          {record.is_rest && <Tag color="warning">休息</Tag>}
          {record.has_income && record.income?.is_overtime && (
            <Tag color="orange">加班</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '服务员',
      width: 120,
      render: (_: any, record: VehicleIncomeItem) => {
        const data = localIncomes[record.vehicle_id];
        // 优先使用本地数据中的服务员ID，如果没有则从排班中获取
        const conductorId = data?.conductor_id || conductorSchedules[record.vehicle_id] || null;
        return conductorId || '-';
      },
    },
    {
      title: '营业额',
      width: 100,
      render: (_: any, record: VehicleIncomeItem) => {
        const data = localIncomes[record.vehicle_id];
        if (!data) return '';
        const revenue = calculateRevenue(data);
        if (isNaN(revenue) || revenue === 0) return '';
        return formatAmount(revenue);
      },
    },
    {
      title: '实际分配金额',
      width: 120,
      render: (_: any, record: VehicleIncomeItem) => {
        const data = localIncomes[record.vehicle_id];
        if (!data) return '';
        const netIncome = calculateNetIncome(data);
        if (isNaN(netIncome) || netIncome === 0) return '';
        return formatAmount(netIncome);
      },
    },
    {
      title: '转数',
      width: 80,
      render: (_: any, record: VehicleIncomeItem) => {
        const data = localIncomes[record.vehicle_id];
        if (!data) return '';
        const turnCount = calculateTurnCount(data);
        return turnCount > 0 ? turnCount.toString() : '';
      },
    },
    {
      title: '状态',
      width: 100,
      render: (_: any, record: VehicleIncomeItem) => {
        if (record.is_rest) return <Tag color="warning">休息</Tag>;
        if (!record.has_income) return <Tag color="default">未录入</Tag>;
        return <Tag color="success">已录入</Tag>;
      },
    },
    {
      title: '录入时间',
      width: 160,
      render: (_: any, record: VehicleIncomeItem) => {
        if (!record.has_income || !record.income?.created_at) {
          return '-';
        }
        return dayjs(record.income.created_at).format('YYYY-MM-DD HH:mm:ss');
      },
    },
    {
      title: '修改时间',
      width: 160,
      render: (_: any, record: VehicleIncomeItem) => {
        if (!record.has_income || !record.income?.updated_at) {
          return '-';
        }
        const createdAt = dayjs(record.income.created_at);
        const updatedAt = dayjs(record.income.updated_at);
        // 如果修改时间和录入时间相同，显示"-"
        if (updatedAt.isSame(createdAt, 'second')) {
          return '-';
        }
        return updatedAt.format('YYYY-MM-DD HH:mm:ss');
      },
    },
  ];

  // 统计展示与导出已抽离到 @/components/DailyStatisticsView

  return (
    <PageContainer>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 外层：日期选择 */}
          <Space>
            <span>选择日期：</span>
            <DatePicker
              value={selectedDate}
              onChange={handleDateChange}
              disabledDate={disabledDate}
              format="YYYY-MM-DD"
              placeholder="选择收入日期"
              showToday
            />
          </Space>

          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'entry',
                label: '录入',
                children: (
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    {/* 录入Tab的检索功能 */}
                    <Space wrap>
                      <Space>
                        <span>搜索车辆：</span>
                        <Input
                          placeholder="请输入车牌号"
                          prefix={<SearchOutlined />}
                          value={searchKeyword}
                          onChange={(e) => setSearchKeyword(e.target.value)}
                          allowClear
                          style={{ width: 200 }}
                        />
                      </Space>
                      <Space>
                        <span>录入状态：</span>
                        <Select
                          value={incomeStatusFilter}
                          onChange={setIncomeStatusFilter}
                          style={{ width: 120 }}
                          options={[
                            { label: '全部', value: 'all' },
                            { label: '已录入', value: 'entered' },
                            { label: '未录入', value: 'not_entered' },
                          ]}
                        />
                      </Space>
                    </Space>

                    {/* 统计信息 */}
                    {(() => {
                      const enteredCount = filteredVehicles.filter((v) => v.has_income).length;
                      const totalCount = filteredVehicles.length;
                      const pendingCount = filteredVehicles.filter((v) => !v.is_rest && !v.has_income).length;
                      const totalRevenue = filteredVehicles.reduce((sum, v) => {
                        const data = localIncomes[v.vehicle_id];
                        return sum + (data ? calculateRevenue(data) : 0);
                      }, 0);
                      const totalNetIncome = filteredVehicles.reduce((sum, v) => {
                        const data = localIncomes[v.vehicle_id];
                        return sum + (data ? calculateNetIncome(data) : 0);
                      }, 0);

                      return (
                        <Card size="small" style={{ backgroundColor: '#fafafa' }}>
                          <Space size="large">
                            <span>
                              <strong>
                                {searchKeyword || incomeStatusFilter !== 'all'
                                  ? `已筛选 ${totalCount} 辆，已录入 ${enteredCount} 辆，待录入 ${pendingCount} 辆`
                                  : `共 ${totalCount} 辆，已录入 ${enteredCount} 辆，待录入 ${pendingCount} 辆`}
                              </strong>
                            </span>
                            <span>
                              <strong>合计营业额：{isNaN(totalRevenue) ? '0' : formatAmount(totalRevenue)} 元</strong>
                            </span>
                            <span>
                              <strong>合计实际分配金额：{isNaN(totalNetIncome) ? '0' : formatAmount(totalNetIncome)} 元</strong>
                            </span>
                          </Space>
                          <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
                            营业额=5转收入+微信收入；实际分配金额=营业额−补油款+奖罚
                          </div>
                        </Card>
                      );
                    })()}

                    <Table<VehicleIncomeItem>
                      rowKey="vehicle_id"
                      columns={entryColumns}
                      dataSource={filteredVehicles}
                      loading={loading}
                      pagination={false}
                      scroll={{ x: 1200 }}
                      expandable={{
                        expandedRowKeys: Array.from(expandedRows),
                        onExpandedRowsChange: (keys) => {
                          setExpandedRows(new Set(keys as string[]));
                        },
                        expandedRowRender: (record) => {
                          const data = localIncomes[record.vehicle_id];
                          if (!data) return null;
                          const isSaving = savingVehicles.has(record.vehicle_id);

                          return (
                            <Card size="small" style={{ margin: '8px 0', backgroundColor: '#fafafa' }}>
                              <Form layout="vertical" style={{ padding: '8px 0' }}>
                                <Row gutter={16}>
                                  <Col span={24}>
                                    <Form.Item label="5转收入">
                                      <Row gutter={12}>
                                        <Col>
                                          <Form.Item label="第1转" style={{ marginBottom: 0 }}>
                                            <Space.Compact>
                                              <InputNumber
                                                placeholder="收入"
                                                value={data.turn1_amount ?? undefined}
                                                onChange={(value) =>
                                                  updateLocalIncome(record.vehicle_id, 'turn1_amount', value ?? null)
                                                }
                                                min={0}
                                                precision={1}
                                                formatter={amountFormatter}
                                                parser={amountParser}
                                                style={{ width: 120 }}
                                              />
                                              <span style={{ padding: '0 11px', display: 'inline-flex', alignItems: 'center', backgroundColor: '#fafafa', border: '1px solid #d9d9d9', borderLeft: 'none', borderRadius: '0 6px 6px 0', height: '32px' }}>元</span>
                                            </Space.Compact>
                                          </Form.Item>
                                        </Col>
                                        <Col>
                                          <Form.Item label="第2转" style={{ marginBottom: 0 }}>
                                            <Space.Compact>
                                              <InputNumber
                                                placeholder="收入"
                                                value={data.turn2_amount ?? undefined}
                                                onChange={(value) =>
                                                  updateLocalIncome(record.vehicle_id, 'turn2_amount', value ?? null)
                                                }
                                                min={0}
                                                precision={1}
                                                formatter={amountFormatter}
                                                parser={amountParser}
                                                style={{ width: 120 }}
                                              />
                                              <span style={{ padding: '0 11px', display: 'inline-flex', alignItems: 'center', backgroundColor: '#fafafa', border: '1px solid #d9d9d9', borderLeft: 'none', borderRadius: '0 6px 6px 0', height: '32px' }}>元</span>
                                            </Space.Compact>
                                          </Form.Item>
                                        </Col>
                                        <Col>
                                          <Form.Item label="第3转" style={{ marginBottom: 0 }}>
                                            <Space.Compact>
                                              <InputNumber
                                                placeholder="收入"
                                                value={data.turn3_amount ?? undefined}
                                                onChange={(value) =>
                                                  updateLocalIncome(record.vehicle_id, 'turn3_amount', value ?? null)
                                                }
                                                min={0}
                                                precision={1}
                                                formatter={amountFormatter}
                                                parser={amountParser}
                                                style={{ width: 120 }}
                                              />
                                              <span style={{ padding: '0 11px', display: 'inline-flex', alignItems: 'center', backgroundColor: '#fafafa', border: '1px solid #d9d9d9', borderLeft: 'none', borderRadius: '0 6px 6px 0', height: '32px' }}>元</span>
                                            </Space.Compact>
                                          </Form.Item>
                                        </Col>
                                        <Col>
                                          <Form.Item label="第4转" style={{ marginBottom: 0 }}>
                                            <Space.Compact>
                                              <InputNumber
                                                placeholder="收入"
                                                value={data.turn4_amount ?? undefined}
                                                onChange={(value) =>
                                                  updateLocalIncome(record.vehicle_id, 'turn4_amount', value ?? null)
                                                }
                                                min={0}
                                                precision={1}
                                                formatter={amountFormatter}
                                                parser={amountParser}
                                                style={{ width: 120 }}
                                              />
                                              <span style={{ padding: '0 11px', display: 'inline-flex', alignItems: 'center', backgroundColor: '#fafafa', border: '1px solid #d9d9d9', borderLeft: 'none', borderRadius: '0 6px 6px 0', height: '32px' }}>元</span>
                                            </Space.Compact>
                                          </Form.Item>
                                        </Col>
                                        <Col>
                                          <Form.Item label="第5转" style={{ marginBottom: 0 }}>
                                            <Space.Compact>
                                              <InputNumber
                                                placeholder="收入"
                                                value={data.turn5_amount ?? undefined}
                                                onChange={(value) =>
                                                  updateLocalIncome(record.vehicle_id, 'turn5_amount', value ?? null)
                                                }
                                                min={0}
                                                precision={1}
                                                formatter={amountFormatter}
                                                parser={amountParser}
                                                style={{ width: 120 }}
                                              />
                                              <span style={{ padding: '0 11px', display: 'inline-flex', alignItems: 'center', backgroundColor: '#fafafa', border: '1px solid #d9d9d9', borderLeft: 'none', borderRadius: '0 6px 6px 0', height: '32px' }}>元</span>
                                            </Space.Compact>
                                          </Form.Item>
                                        </Col>
                                      </Row>
                                    </Form.Item>
                                  </Col>
                                </Row>

                                <Row gutter={16}>
                                  <Col>
                                    <Form.Item label="微信收入">
                                      <Space.Compact>
                                        <InputNumber
                                          placeholder="收入"
                                          value={data.wechat_amount || undefined}
                                          onChange={(value) =>
                                            updateLocalIncome(record.vehicle_id, 'wechat_amount', value ?? 0)
                                          }
                                          min={0}
                                          precision={1}
                                          formatter={amountFormatter}
                                          parser={amountParser}
                                          style={{ width: 120 }}
                                        />
                                        <span style={{ padding: '0 8px', display: 'flex', alignItems: 'center', backgroundColor: '#fafafa', border: '1px solid #d9d9d9', borderLeft: 'none', borderRadius: '0 6px 6px 0' }}>元</span>
                                      </Space.Compact>
                                    </Form.Item>
                                  </Col>
                                  <Col>
                                    <Form.Item label="补油款">
                                      <Space.Compact>
                                        <InputNumber
                                          placeholder="金额"
                                          value={data.fuel_subsidy || undefined}
                                          onChange={(value) =>
                                            updateLocalIncome(record.vehicle_id, 'fuel_subsidy', value ?? 0)
                                          }
                                          min={0}
                                          precision={1}
                                          formatter={amountFormatter}
                                          parser={amountParser}
                                          style={{ width: 120 }}
                                        />
                                        <span style={{ padding: '0 8px', display: 'flex', alignItems: 'center', backgroundColor: '#fafafa', border: '1px solid #d9d9d9', borderLeft: 'none', borderRadius: '0 6px 6px 0' }}>元</span>
                                      </Space.Compact>
                                    </Form.Item>
                                  </Col>
                                  <Col>
                                    <Form.Item label="奖罚">
                                      <Space.Compact>
                                        <InputNumber
                                          placeholder="金额（可为负）"
                                          value={data.reward_penalty || undefined}
                                          onChange={(value) =>
                                            updateLocalIncome(record.vehicle_id, 'reward_penalty', value ?? 0)
                                          }
                                          precision={1}
                                          formatter={amountFormatter}
                                          parser={rewardPenaltyParser}
                                          style={{ width: 120 }}
                                        />
                                        <span style={{ padding: '0 8px', display: 'flex', alignItems: 'center', backgroundColor: '#fafafa', border: '1px solid #d9d9d9', borderLeft: 'none', borderRadius: '0 6px 6px 0' }}>元</span>
                                      </Space.Compact>
                                    </Form.Item>
                                  </Col>
                                </Row>

                                <Row gutter={16}>
                                  <Col>
                                    <Form.Item label="备注">
                                      <Input.TextArea
                                        placeholder="备注信息"
                                        value={data.remark}
                                        onChange={(e) =>
                                          updateLocalIncome(record.vehicle_id, 'remark', e.target.value)
                                        }
                                        rows={2}
                                        style={{ width: 450 }}
                                        maxLength={1000}
                                        showCount
                                      />
                                    </Form.Item>
                                  </Col>
                                </Row>

                                <Row gutter={16}>
                                  <Col span={24}>
                                    <Space size="large">
                                      {(() => {
                                        const revenue = calculateRevenue(data);
                                        if (!isNaN(revenue) && revenue !== 0) {
                                          return (
                                            <span>
                                              <strong>营业额：</strong>
                                              <span style={{ color: '#1677ff', fontSize: '16px', fontWeight: 'bold' }}>
                                                {formatAmount(revenue)}
                                              </span>
                                              <span style={{ marginLeft: '4px' }}>元</span>
                                            </span>
                                          );
                                        }
                                        return null;
                                      })()}
                                      {(() => {
                                        const netIncome = calculateNetIncome(data);
                                        if (!isNaN(netIncome) && netIncome !== 0) {
                                          return (
                                            <span>
                                              <strong>实际分配金额：</strong>
                                              <span style={{ color: '#52c41a', fontSize: '16px', fontWeight: 'bold' }}>
                                                {formatAmount(netIncome)}
                                              </span>
                                              <span style={{ marginLeft: '4px' }}>元</span>
                                            </span>
                                          );
                                        }
                                        return null;
                                      })()}
                                      <span>
                                        <strong>转数：</strong>
                                        <span style={{ color: '#722ed1', fontSize: '16px', fontWeight: 'bold' }}>
                                          {calculateTurnCount(data)}
                                        </span>
                                        <span style={{ marginLeft: '4px' }}>转</span>
                                      </span>
                                    </Space>
                                    <Button
                                      type="primary"
                                      icon={<SaveOutlined />}
                                      onClick={() => handleSaveVehicle(record.vehicle_id)}
                                      loading={isSaving}
                                      style={{ marginLeft: 24 }}
                                    >
                                      保存
                                    </Button>
                                  </Col>
                                </Row>
                              </Form>
                            </Card>
                          );
                        },
                      }}
                    />
                  </Space>
                ),
              },
              {
                key: 'statistics',
                label: '统计',
                children: (
                  <DailyStatisticsView
                    data={statisticsData}
                    loading={statisticsLoading}
                    exportDate={selectedDate.format('YYYY-MM-DD')}
                    formatAmount={formatAmount}
                  />
                ),
              },
            ]}
          />
        </Space>
      </Card>
    </PageContainer>
  );
}
