import { PageContainer } from '@ant-design/pro-components';
import { App, Button, Card, DatePicker, Input, Space, Switch, Table, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { batchCreateVehicleSchedule, getSchedulesByDate } from '@/services/vehicleSchedules';

interface VehicleScheduleItem {
  vehicle_id: string;
  status: 'rest' | 'operate';
  has_schedule: boolean;
}

export default function SchedulePage() {
  const { message: messageApi } = App.useApp();
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleScheduleItem[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // 加载指定日期的排班数据
  const loadScheduleData = async (date: Dayjs) => {
    setLoading(true);
    try {
      const dateStr = date.format('YYYY-MM-DD');
      const result = await getSchedulesByDate(dateStr);
      setVehicles(result.vehicles);
      setSelectedVehicleIds([]);
    } catch (error: any) {
      if (error?.response?.status === 403) return; // 已在全局统一提示
      messageApi.error(error?.message || '加载排班数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScheduleData(selectedDate);
  }, [selectedDate]);

  // 检查日期范围：只能配置当天开始到往后最多一个月
  const isDateValid = (date: Dayjs): boolean => {
    const today = dayjs().startOf('day');
    const maxDate = today.add(1, 'month');
    return (date.isAfter(today) || date.isSame(today)) && (date.isBefore(maxDate) || date.isSame(maxDate));
  };

  const handleDateChange = (date: Dayjs | null) => {
    if (!date) return;

    if (!isDateValid(date)) {
      messageApi.warning('排班日期只能选择今天起一个月内的日期');
      return;
    }

    setSelectedDate(date);
  };

  // 单个车辆状态切换
  const handleStatusToggle = async (vehicleId: string, newStatus: 'rest' | 'operate') => {
    try {
      await batchCreateVehicleSchedule({
        date: selectedDate.format('YYYY-MM-DD'),
        vehicle_ids: [vehicleId],
        status: newStatus,
      });
      messageApi.success('更新成功');
      loadScheduleData(selectedDate);
    } catch (error: any) {
      if (error?.response?.status === 403) return; // 已在全局统一提示
      const errorMessage =
        error?.response?.data?.message || error?.message || '更新失败';
      messageApi.error(errorMessage);
    }
  };

  // 批量设置状态
  const handleBatchSetStatus = async (status: 'rest' | 'operate') => {
    if (selectedVehicleIds.length === 0) {
      messageApi.warning('请先选择要设置的车辆');
      return;
    }

    try {
      await batchCreateVehicleSchedule({
        date: selectedDate.format('YYYY-MM-DD'),
        vehicle_ids: selectedVehicleIds,
        status,
      });
      messageApi.success(`已批量设置 ${selectedVehicleIds.length} 辆车辆为${status === 'rest' ? '休息' : '营运'}`);
      setSelectedVehicleIds([]);
      loadScheduleData(selectedDate);
    } catch (error: any) {
      if (error?.response?.status === 403) return; // 已在全局统一提示
      const errorMessage =
        error?.response?.data?.message || error?.message || '批量设置失败';
      messageApi.error(errorMessage);
    }
  };

  const columns = [
    {
      title: '车牌号',
      dataIndex: 'vehicle_id',
      width: 100,
      fixed: 'left' as const,
    },
    {
      title: '排班状态',
      dataIndex: 'status',
      width: 150,
      render: (_: any, record: VehicleScheduleItem) => (
        <Space>
          <Tag color={record.status === 'operate' ? 'success' : 'default'}>
            {record.status === 'operate' ? '营运' : '休息'}
          </Tag>
          {!record.has_schedule && (
            <Tag color="warning">默认</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      width: 200,
      render: (_: any, record: VehicleScheduleItem) => (
        <Switch
          checked={record.status === 'operate'}
          checkedChildren="营运"
          unCheckedChildren="休息"
          onChange={(checked) =>
            handleStatusToggle(record.vehicle_id, checked ? 'operate' : 'rest')
          }
        />
      ),
    },
  ];

  // 根据搜索关键词过滤车辆
  const filteredVehicles = useMemo(() => {
    if (!searchKeyword.trim()) {
      return vehicles;
    }
    const keyword = searchKeyword.trim().toLowerCase();
    return vehicles.filter((vehicle) =>
      vehicle.vehicle_id.toLowerCase().includes(keyword)
    );
  }, [vehicles, searchKeyword]);

  const rowSelection = {
    selectedRowKeys: selectedVehicleIds.filter((id) =>
      filteredVehicles.some((v) => v.vehicle_id === id)
    ),
    onChange: (selectedKeys: React.Key[]) => {
      setSelectedVehicleIds(selectedKeys as string[]);
    },
  };

  // 禁用今天之前的日期和一个月后的日期
  const disabledDate = (current: Dayjs | null) => {
    if (!current) return false;
    const today = dayjs().startOf('day');
    const maxDate = today.add(1, 'month');
    return current.isBefore(today) || current.isAfter(maxDate);
  };

  return (
    <PageContainer>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Space wrap>
            <Space>
              <span>选择日期：</span>
              <DatePicker
                value={selectedDate}
                onChange={handleDateChange}
                disabledDate={disabledDate}
                format="YYYY-MM-DD"
                placeholder="选择排班日期"
              />
              <span style={{ color: '#999', fontSize: '12px' }}>
                （只能选择今天起一个月内的日期）
              </span>
            </Space>
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
          </Space>

          {selectedVehicleIds.length > 0 && (
            <Space>
              <Button
                type="primary"
                onClick={() => handleBatchSetStatus('operate')}
              >
                批量设为营运 ({selectedVehicleIds.length})
              </Button>
              <Button onClick={() => handleBatchSetStatus('rest')}>
                批量设为休息 ({selectedVehicleIds.length})
              </Button>
              <Button onClick={() => setSelectedVehicleIds([])}>取消选择</Button>
            </Space>
          )}

          <Table<VehicleScheduleItem>
            rowKey="vehicle_id"
            columns={columns}
            dataSource={filteredVehicles}
            loading={loading}
            rowSelection={rowSelection}
            pagination={false}
            scroll={{ x: 600 }}
            summary={() => {
              const operateCount = filteredVehicles.filter((v) => v.status === 'operate').length;
              const restCount = filteredVehicles.filter((v) => v.status === 'rest').length;
              const totalCount = filteredVehicles.length;
              return (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={2}>
                      <strong>
                        合计{searchKeyword ? `（已筛选 ${totalCount} 辆）` : `（共 ${totalCount} 辆）`}
                      </strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2}>
                      <Space>
                        <Tag color="success">营运: {operateCount}</Tag>
                        <Tag color="default">休息: {restCount}</Tag>
                      </Space>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} />
                  </Table.Summary.Row>
                </Table.Summary>
              );
            }}
          />
        </Space>
      </Card>
    </PageContainer>
  );
}
