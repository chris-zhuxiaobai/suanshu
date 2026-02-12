import { PageContainer } from '@ant-design/pro-components';
import { App, Button, Card, Checkbox, DatePicker, Dropdown, Form, Input, InputNumber, Radio, Row, Col, Select, Space, Table, Tabs, Tag } from 'antd';
import { DownloadOutlined, SaveOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons';
import ExcelJS from 'exceljs';
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

  // 统计 Tab 车辆收入详情表：显示列配置（key -> 是否显示），持久化到 localStorage
  const STATS_COLUMNS_STORAGE_KEY = 'income.statsTableColumns';
  const STATS_COLUMN_OPTIONS: { key: string; label: string }[] = [
    { key: 'vehicle_id', label: '车辆' },
    { key: 'conductor_id', label: '服务员' },
    { key: 'turn_total', label: '现金收入' },
    { key: 'wechat_amount', label: '微信收入' },
    { key: 'revenue', label: '营业额' },
    { key: 'fuel_subsidy', label: '补油款' },
    { key: 'reward_penalty', label: '奖罚' },
    { key: 'net_income', label: '实际分配金额' },
    { key: 'turn_count', label: '转数' },
    { key: 'turn1_amount', label: '第1转' },
    { key: 'turn2_amount', label: '第2转' },
    { key: 'turn3_amount', label: '第3转' },
    { key: 'turn4_amount', label: '第4转' },
    { key: 'turn5_amount', label: '第5转' },
    { key: 'remark', label: '备注' },
    { key: 'payment_amount', label: '收付款' },
    { key: 'vehicle_id_right', label: '车辆(右)' },
  ];
  const [statsColumnsVisible, setStatsColumnsVisible] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(STATS_COLUMNS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        const out: Record<string, boolean> = {};
        STATS_COLUMN_OPTIONS.forEach(({ key }) => { out[key] = parsed[key] !== false; });
        return out;
      }
    } catch (_) {}
    return Object.fromEntries(STATS_COLUMN_OPTIONS.map(({ key }) => [key, true]));
  });
  const persistStatsColumns = (next: Record<string, boolean>) => {
    setStatsColumnsVisible(next);
    try { localStorage.setItem(STATS_COLUMNS_STORAGE_KEY, JSON.stringify(next)); } catch (_) {}
  };

  // 统计 Tab 车辆收入详情表：表格密度（small/middle/large），持久化到 localStorage
  const STATS_TABLE_SIZE_STORAGE_KEY = 'income.statsTableSize';
  type StatsTableSize = 'small' | 'middle' | 'large';
  const [statsTableSize, setStatsTableSize] = useState<StatsTableSize>(() => {
    try {
      const raw = localStorage.getItem(STATS_TABLE_SIZE_STORAGE_KEY);
      if (raw === 'small' || raw === 'middle' || raw === 'large') return raw;
    } catch (_) {}
    return 'small';
  });
  const persistStatsTableSize = (size: StatsTableSize) => {
    setStatsTableSize(size);
    try { localStorage.setItem(STATS_TABLE_SIZE_STORAGE_KEY, size); } catch (_) {}
  };

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
      align: 'right' as const,
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
      align: 'right' as const,
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
      align: 'center' as const,
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

  // 统计 Tab 车辆收入详情表：根据列显示配置生成列定义，左侧固定车辆/服务员，右侧固定收付款/车辆，中间可横向滚动
  const statsTableColumnsConfig: Array<{ key: string; title: string; dataIndex: string; width: number; align?: 'left' | 'right' | 'center'; fixed?: 'left' | 'right'; ellipsis?: boolean; sorter?: (a: any, b: any) => number; render: (value: any, record: any) => React.ReactNode }> = [
    { key: 'vehicle_id', title: '车辆', dataIndex: 'vehicle_id', width: 100, fixed: 'left', sorter: (a, b) => a.vehicle_id.localeCompare(b.vehicle_id), render: (value: string, record: any) => (
      <Space>
        <span>{value}</span>
        {record.is_rest ? <Tag color="warning">休息</Tag> : !record.has_income && <Tag color="default">未录入</Tag>}
        {record.has_income && record.is_overtime && <Tag color="orange">加班</Tag>}
      </Space>
    ) },
    { key: 'conductor_id', title: '服务员', dataIndex: 'conductor_id', width: 100, fixed: 'left', render: (v: string | null) => v || '-' },
    { key: 'turn_total', title: '现金收入', dataIndex: 'turn_total', width: 100, align: 'right', sorter: (a, b) => (a.turn_total ?? 0) - (b.turn_total ?? 0), render: (value: number, record: any) => (record.has_income && value != null ? formatAmount(value) : '') },
    { key: 'wechat_amount', title: '微信收入', dataIndex: 'wechat_amount', width: 100, align: 'right', sorter: (a, b) => (a.wechat_amount ?? 0) - (b.wechat_amount ?? 0), render: (value: number, record: any) => (record.has_income && value != null ? formatAmount(value) : '') },
    { key: 'revenue', title: '营业额', dataIndex: 'revenue', width: 120, align: 'right', sorter: (a, b) => a.revenue - b.revenue, render: (value: number) => (value > 0 ? formatAmount(value) : '') },
    { key: 'fuel_subsidy', title: '补油款', dataIndex: 'fuel_subsidy', width: 100, align: 'right', sorter: (a, b) => (a.fuel_subsidy ?? 0) - (b.fuel_subsidy ?? 0), render: (value: number, record: any) => (record.has_income && value != null && value !== 0 ? formatAmount(value) : '') },
    { key: 'reward_penalty', title: '奖罚', dataIndex: 'reward_penalty', width: 100, align: 'right', sorter: (a, b) => (a.reward_penalty ?? 0) - (b.reward_penalty ?? 0), render: (value: number, record: any) => {
      if (!record.has_income || value == null || value === 0) return '';
      const color = value > 0 ? '#52c41a' : '#ff4d4f';
      return <span style={{ color }}>{value > 0 ? '+' : ''}{formatAmount(value)}</span>;
    } },
    { key: 'net_income', title: '实际分配金额', dataIndex: 'net_income', width: 120, align: 'right', sorter: (a, b) => a.net_income - b.net_income, render: (value: number) => (value > 0 ? formatAmount(value) : '') },
    { key: 'turn_count', title: '转数', dataIndex: 'turn_count', width: 80, align: 'center', sorter: (a, b) => a.turn_count - b.turn_count, render: (value: number, record: any) => (!record.has_income ? '-' : value > 0 ? value.toString() : '') },
    { key: 'turn1_amount', title: '第1转', dataIndex: 'turn1_amount', width: 90, align: 'right', sorter: (a, b) => (a.turn1_amount ?? 0) - (b.turn1_amount ?? 0), render: (value: number, record: any) => (record.has_income && value != null && value !== 0 ? formatAmount(value) : '') },
    { key: 'turn2_amount', title: '第2转', dataIndex: 'turn2_amount', width: 90, align: 'right', sorter: (a, b) => (a.turn2_amount ?? 0) - (b.turn2_amount ?? 0), render: (value: number, record: any) => (record.has_income && value != null && value !== 0 ? formatAmount(value) : '') },
    { key: 'turn3_amount', title: '第3转', dataIndex: 'turn3_amount', width: 90, align: 'right', sorter: (a, b) => (a.turn3_amount ?? 0) - (b.turn3_amount ?? 0), render: (value: number, record: any) => (record.has_income && value != null && value !== 0 ? formatAmount(value) : '') },
    { key: 'turn4_amount', title: '第4转', dataIndex: 'turn4_amount', width: 90, align: 'right', sorter: (a, b) => (a.turn4_amount ?? 0) - (b.turn4_amount ?? 0), render: (value: number, record: any) => (record.has_income && value != null && value !== 0 ? formatAmount(value) : '') },
    { key: 'turn5_amount', title: '第5转', dataIndex: 'turn5_amount', width: 90, align: 'right', sorter: (a, b) => (a.turn5_amount ?? 0) - (b.turn5_amount ?? 0), render: (value: number, record: any) => (record.has_income && value != null && value !== 0 ? formatAmount(value) : '') },
    { key: 'remark', title: '备注', dataIndex: 'remark', width: 140, ellipsis: true, render: (value: string | null | undefined, record: any) => (record.has_income && value ? value : '') },
    { key: 'payment_amount', title: '收付款', dataIndex: 'payment_amount', width: 120, align: 'right', fixed: 'right', sorter: (a, b) => a.payment_amount - b.payment_amount, render: (value: number) => {
      if (value === 0) return <span style={{ color: '#999' }}>0</span>;
      const color = value > 0 ? '#52c41a' : '#ff4d4f';
      return <span style={{ color, fontWeight: 'bold' }}>{value > 0 ? '+' : ''}{formatAmount(value)}</span>;
    } },
    { key: 'vehicle_id_right', title: '车辆', dataIndex: 'vehicle_id', width: 100, fixed: 'right', render: (value: string) => value },
  ];
  const statsTableColumns = useMemo(() => {
    return statsTableColumnsConfig
      .filter((col) => statsColumnsVisible[col.key] !== false)
      .map(({ key, title, dataIndex, width, align, fixed, ellipsis, sorter, render }) => ({
        key,
        title,
        dataIndex,
        width,
        align: align as 'left' | 'right' | 'center' | undefined,
        fixed,
        ellipsis,
        sorter,
        render,
      }));
  }, [statsColumnsVisible]);
  const statsTableScrollX = useMemo(() => statsTableColumns.reduce((sum, c) => sum + (c.width ?? 0), 0), [statsTableColumns]);

  // 统计 Tab：导出为 Excel（单 sheet，概览 + 车辆收入详情，表头与休息行样式）
  const handleExportStatistics = async () => {
    if (!statisticsData) {
      messageApi.warning('暂无统计数据可导出');
      return;
    }
    const wb = new ExcelJS.Workbook();
    const { statistics } = statisticsData;
    const pendingCount = Math.max(0, statistics.total_vehicle_count - statistics.rest_vehicle_count - statistics.vehicle_count);

    const sheet = wb.addWorksheet('日收入统计', { views: [{ rightToLeft: false }] });

    // 样式常量
    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    const overviewTitleFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
    const overviewTitleFont = { bold: true, size: 12 };
    const overviewLabelFont = { bold: true, size: 10 };
    const restRowFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    const alignLeft = { horizontal: 'left' as const, vertical: 'middle' as const };
    const alignCenter = { horizontal: 'center' as const, vertical: 'middle' as const };
    const fontGreen = { color: { argb: 'FF00B050' } };
    const fontRed = { color: { argb: 'FFFF0000' } };

    // 概览区域：日期单独一行，总营业额/总实际分配金额一行，平均金额一行，其他数据一行
    const rowHeight = 21;
    sheet.addRow(['统计概览']);
    const overviewTitleRow = sheet.lastRow!;
    overviewTitleRow.height = rowHeight;
    overviewTitleRow.getCell(1).fill = overviewTitleFill;
    overviewTitleRow.getCell(1).font = overviewTitleFont;
    overviewTitleRow.getCell(1).alignment = alignLeft;

    sheet.addRow(['日期', statistics.date]);
    const rDate = sheet.lastRow!;
    rDate.height = rowHeight;
    rDate.getCell(1).font = overviewLabelFont;
    rDate.getCell(1).alignment = alignLeft;
    rDate.getCell(2).alignment = alignLeft;

    sheet.addRow(['总营业额', formatAmount(statistics.total_revenue), '实际分配', formatAmount(statistics.total_net_income)]);
    const rTotal = sheet.lastRow!;
    rTotal.height = rowHeight;
    [1, 2, 3, 4].forEach((i) => { rTotal.getCell(i).alignment = alignLeft; });
    rTotal.getCell(1).font = overviewLabelFont;
    rTotal.getCell(3).font = overviewLabelFont;

    sheet.addRow(['均营业额', formatAmount(statistics.average_revenue), '均净收', formatAmount(statistics.average_net_income)]);
    const rAvg = sheet.lastRow!;
    rAvg.height = rowHeight;
    [1, 2, 3, 4].forEach((i) => { rAvg.getCell(i).alignment = alignLeft; });
    rAvg.getCell(1).font = overviewLabelFont;
    rAvg.getCell(3).font = overviewLabelFont;

    sheet.addRow(['在册车辆', statistics.total_vehicle_count, '已录入', statistics.vehicle_count, '待录入', pendingCount, '休息', statistics.rest_vehicle_count]);
    const rOther = sheet.lastRow!;
    rOther.height = rowHeight;
    [1, 2, 3, 4, 5, 6, 7, 8].forEach((i) => { rOther.getCell(i).alignment = alignLeft; });
    rOther.getCell(1).font = overviewLabelFont;
    rOther.getCell(3).font = overviewLabelFont;
    rOther.getCell(5).font = overviewLabelFont;
    rOther.getCell(7).font = overviewLabelFont;

    sheet.addRow([]);

    // 车辆收入详情：仅对超过 5 字的列名做简短处理；表头 + 状态列放最后，列表居中，收付款/奖罚绿正红负
    const detailCols = statsTableColumnsConfig.filter((c) => c.key !== 'vehicle_id_right');
    const shortTitle: Record<string, string> = {
      net_income: '净收', // 实际分配金额(6字)
    };
    const exportTitle = (title: string, key: string) => (key === 'vehicle_id' ? '车号' : (title.length > 5 ? (shortTitle[key] ?? title) : title));
    const detailHeaders = [...detailCols.map((c) => exportTitle(c.title, c.key)), '状态'];
    const rewardPenaltyColIndex = detailCols.findIndex((c) => c.key === 'reward_penalty');
    const paymentAmountColIndex = detailCols.findIndex((c) => c.key === 'payment_amount');

    const headerRow = sheet.addRow(detailHeaders);
    headerRow.height = rowHeight;
    for (let i = 0; i <= detailCols.length; i++) {
      const cell = headerRow.getCell(i + 1);
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = alignCenter;
    }

    const vehicles = statisticsData.vehicles || [];
    const amountKeys = new Set(['turn_total', 'wechat_amount', 'revenue', 'fuel_subsidy', 'reward_penalty', 'net_income', 'payment_amount', 'turn1_amount', 'turn2_amount', 'turn3_amount', 'turn4_amount', 'turn5_amount']);
    vehicles.forEach((row: any) => {
      const statusText = [row.is_rest ? '休息' : '', !row.has_income && !row.is_rest ? '未录入' : '', row.has_income && row.is_overtime ? '加班' : ''].filter(Boolean).join(' ');
      const cells: (string | number)[] = [];
      detailCols.forEach((col) => {
        if (col.key === 'vehicle_id') {
          cells.push(row.vehicle_id);
          return;
        }
        const v = row[col.dataIndex];
        if (col.dataIndex === 'conductor_id') {
          cells.push(v || '-');
          return;
        }
        if (col.dataIndex === 'turn_count') {
          cells.push(!row.has_income ? '-' : (v > 0 ? String(v) : ''));
          return;
        }
        if (col.dataIndex === 'remark') {
          cells.push(row.has_income && v ? String(v) : '');
          return;
        }
        if (amountKeys.has(col.key) && typeof v === 'number') {
          if (!row.has_income && col.key !== 'payment_amount') {
            cells.push('');
            return;
          }
          if (col.key === 'reward_penalty' && v !== 0) {
            cells.push((v > 0 ? '+' : '') + formatAmount(v));
          } else if (v === 0 && col.key !== 'payment_amount') {
            cells.push('');
          } else {
            cells.push(formatAmount(v));
          }
          return;
        }
        cells.push(v != null && v !== '' ? (typeof v === 'number' ? v : String(v)) : '');
      });
      cells.push(statusText);

      const dataRow = sheet.addRow(cells);
      dataRow.height = rowHeight;
      const numCols = detailCols.length + 1;
      for (let i = 0; i < numCols; i++) {
        dataRow.getCell(i + 1).alignment = alignCenter;
      }
      if (row.is_rest) {
        for (let i = 0; i < numCols; i++) {
          dataRow.getCell(i + 1).fill = restRowFill;
        }
      }
      // 收付款、奖罚：绿正红负
      if (rewardPenaltyColIndex >= 0) {
        const val = row.reward_penalty;
        if (val != null && val !== 0) {
          const cell = dataRow.getCell(rewardPenaltyColIndex + 1);
          cell.font = val > 0 ? fontGreen : fontRed;
        }
      }
      if (paymentAmountColIndex >= 0) {
        const val = row.payment_amount;
        if (val != null && val !== 0) {
          const cell = dataRow.getCell(paymentAmountColIndex + 1);
          cell.font = val > 0 ? fontGreen : fontRed;
        }
      }
    });

    // 列宽：A=8, B=6.8, C-D=7.6, E-N=7.1, O=10, P-Q=9.2
    const colWidths = [
      8, 6.8, 7.6, 7.6,
      ...Array(10).fill(7.1),   // E-N
      10, 9.2, 9.2,             // O, P, Q
    ];
    sheet.columns = colWidths.map((w) => ({ width: w }));

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `日收入统计_${statistics.date}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    messageApi.success('导出成功');
  };

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
                  <Card loading={statisticsLoading}>
                    {statisticsData ? (
                      <Space direction="vertical" style={{ width: '100%' }} size="large">
                        {/* 统计概览 */}
                        <Card
                          size="small"
                          style={{ backgroundColor: '#fafafa' }}
                          extra={
                            <Button type="primary" size="small" icon={<DownloadOutlined />} onClick={handleExportStatistics}>
                              导出
                            </Button>
                          }
                        >
                          <Row gutter={24}>
                            <Col span={6}>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>总营业额</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1677ff' }}>
                                  {formatAmount(statisticsData.statistics.total_revenue)} 元
                                </div>
                              </div>
                            </Col>
                            <Col span={6}>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>总实际分配金额</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                                  {formatAmount(statisticsData.statistics.total_net_income)} 元
                                </div>
                              </div>
                            </Col>
                            <Col span={6}>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>平均营业额</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#722ed1' }}>
                                  {formatAmount(statisticsData.statistics.average_revenue)} 元
                                </div>
                              </div>
                            </Col>
                            <Col span={6}>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>平均实际分配金额</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fa8c16' }}>
                                  {formatAmount(statisticsData.statistics.average_net_income)} 元
                                </div>
                              </div>
                            </Col>
                          </Row>
                          <div style={{ marginTop: '16px', textAlign: 'center', color: '#999', fontSize: '12px' }}>
                            共 {statisticsData.statistics.total_vehicle_count} 辆在册车辆，已录入 {statisticsData.statistics.vehicle_count} 辆，待录入 {Math.max(0, statisticsData.statistics.total_vehicle_count - statisticsData.statistics.rest_vehicle_count - statisticsData.statistics.vehicle_count)} 辆，休息 {statisticsData.statistics.rest_vehicle_count} 辆
                          </div>
                          <div style={{ marginTop: '8px', textAlign: 'center', color: '#999', fontSize: '11px' }}>
                            营业额=5转收入+微信收入；实际分配金额=营业额−补油款+奖罚
                          </div>
                        </Card>

                        {/* 车辆正负值列表 */}
                        {statisticsData.vehicles && statisticsData.vehicles.length > 0 ? (
                          <Card
                            title="车辆收入详情"
                            size="small"
                            extra={
                              <Space>
                                <Dropdown
                                  trigger={['click']}
                                  popupRender={() => (
                                    <div style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 6px 16px rgba(0,0,0,0.08)', padding: '12px 16px', minWidth: 180 }}>
                                      <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>显示列</div>
                                      <Checkbox.Group
                                        value={STATS_COLUMN_OPTIONS.filter(({ key }) => statsColumnsVisible[key] !== false).map(({ key }) => key)}
                                        style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                                        onChange={(checkedValues) => {
                                          const next = { ...statsColumnsVisible };
                                          STATS_COLUMN_OPTIONS.forEach(({ key }) => { next[key] = (checkedValues as string[]).includes(key); });
                                          persistStatsColumns(next);
                                        }}
                                      >
                                        {STATS_COLUMN_OPTIONS.map(({ key, label }) => (
                                          <Checkbox key={key} value={key}>{label}</Checkbox>
                                        ))}
                                      </Checkbox.Group>
                                    </div>
                                  )}
                                >
                                  <Button type="text" size="small" icon={<SettingOutlined />}>列显示</Button>
                                </Dropdown>
                                <Dropdown
                                  trigger={['click']}
                                  popupRender={() => (
                                    <div style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 6px 16px rgba(0,0,0,0.08)', padding: '12px 16px', minWidth: 140 }}>
                                      <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>表格密度</div>
                                      <Radio.Group
                                        value={statsTableSize}
                                        onChange={(e) => persistStatsTableSize(e.target.value)}
                                        options={[
                                          { value: 'small', label: '紧凑' },
                                          { value: 'middle', label: '默认' },
                                          { value: 'large', label: '宽松' },
                                        ]}
                                      />
                                    </div>
                                  )}
                                >
                                  <Button type="text" size="small">表格密度</Button>
                                </Dropdown>
                              </Space>
                            }
                          >
                            <Table
                              rowKey="vehicle_id"
                              size={statsTableSize}
                              columns={statsTableColumns}
                              dataSource={statisticsData.vehicles}
                              pagination={false}
                              scroll={{ x: statsTableScrollX }}
                            />
                          </Card>
                        ) : (
                          <Card title="车辆收入详情" size="small">
                            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                              暂无车辆收入数据
                            </div>
                          </Card>
                        )}
                      </Space>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                        暂无统计数据
                      </div>
                    )}
                  </Card>
                ),
              },
            ]}
          />
        </Space>
      </Card>
    </PageContainer>
  );
}
