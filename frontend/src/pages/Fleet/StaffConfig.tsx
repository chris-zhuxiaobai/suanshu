import { PageContainer } from '@ant-design/pro-components';
import { App, Button, Card, DatePicker, Input, Select, Space, Table, Tag } from 'antd';
import { ReloadOutlined, SearchOutlined, SaveOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { batchCreateConductorSchedule, getSchedulesByMonth } from '@/services/conductorSchedules';
import { listVehicles } from '@/services/vehicles';

interface ConductorScheduleItem {
  vehicle_id: string;
  conductor_id: string | null;
  has_schedule: boolean;
}

export default function StaffConfigPage() {
  const { message: messageApi } = App.useApp();
  const [selectedYear, setSelectedYear] = useState<number>(dayjs().year());
  const [selectedMonth, setSelectedMonth] = useState<number>(dayjs().month() + 1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vehicles, setVehicles] = useState<ConductorScheduleItem[]>([]);
  const [allVehicles, setAllVehicles] = useState<API.Vehicle[]>([]);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [localSchedules, setLocalSchedules] = useState<Record<string, string | null>>({});
  const [originalSchedules, setOriginalSchedules] = useState<Record<string, string | null>>({});

  // 加载车辆列表
  const loadVehicles = async () => {
    try {
      const result = await listVehicles({ status: 'active', per_page: 1000 });
      setAllVehicles(result.data);
    } catch (error: any) {
      if (error?.response?.status === 403) return; // 已在全局统一提示
      messageApi.error(error?.message || '加载车辆列表失败');
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  // 加载指定年月的排班数据
  const loadScheduleData = async (year: number, month: number) => {
    setLoading(true);
    try {
      const result = await getSchedulesByMonth(year, month);
      setVehicles(result.vehicles);
      // 初始化本地状态和原始状态
      const schedules: Record<string, string | null> = {};
      result.vehicles.forEach((item) => {
        schedules[item.vehicle_id] = item.conductor_id;
      });
      setLocalSchedules(schedules);
      setOriginalSchedules({ ...schedules }); // 保存原始状态用于重置
    } catch (error: any) {
      if (error?.response?.status === 403) return; // 已在全局统一提示
      messageApi.error(error?.message || '加载排班数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScheduleData(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  // 判断选择的月份是否已过期（小于当前月份）
  const isMonthExpired = useMemo(() => {
    const currentDate = dayjs();
    const selectedDate = dayjs(`${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`);
    return selectedDate.isBefore(currentDate.startOf('month'));
  }, [selectedYear, selectedMonth]);

  // 处理年月选择
  const handleMonthChange = (date: dayjs.Dayjs | null) => {
    if (!date) return;
    setSelectedYear(date.year());
    setSelectedMonth(date.month() + 1);
  };

  // 处理售票员选择
  const handleConductorChange = (vehicleId: string, conductorId: string | null) => {
    // 如果月份已过期，不允许修改
    if (isMonthExpired) {
      messageApi.warning('已过期的月份不允许修改，只能查看');
      return;
    }
    // 校验：服务员不能跟本车
    if (conductorId === vehicleId) {
      messageApi.warning('服务员不能跟本车');
      return;
    }
    setLocalSchedules((prev) => ({
      ...prev,
      [vehicleId]: conductorId,
    }));
  };

  // 重置所有配置
  const handleReset = () => {
    if (isMonthExpired) {
      messageApi.warning('已过期的月份不允许重置');
      return;
    }
    setLocalSchedules({ ...originalSchedules });
    messageApi.success('已重置所有配置');
  };

  // 自动随机分配
  const handleAutoAssign = () => {
    if (isMonthExpired) {
      messageApi.warning('已过期的月份不允许修改');
      return;
    }

    if (filteredVehicles.length === 0) {
      messageApi.warning('没有可分配的车辆');
      return;
    }

    // 获取所有启用状态的车辆ID（作为售票员池）
    const availableConductors = allVehicles
      .filter((v) => v.status === 'active')
      .map((v) => v.id);

    if (availableConductors.length < filteredVehicles.length) {
      messageApi.warning('服务员数量不足，无法完成分配');
      return;
    }

    // 创建新的分配结果
    const newSchedules: Record<string, string | null> = { ...localSchedules };
    const usedConductors = new Set<string>();

    // 为每辆车随机分配售票员
    filteredVehicles.forEach((vehicle) => {
      // 获取该车辆可用的售票员（排除本车、排除已使用的）
      const availableForVehicle = availableConductors.filter(
        (conductorId) =>
          conductorId !== vehicle.vehicle_id && !usedConductors.has(conductorId)
      );

      if (availableForVehicle.length > 0) {
        // 随机选择一个
        const randomIndex = Math.floor(Math.random() * availableForVehicle.length);
        const selectedConductor = availableForVehicle[randomIndex];
        newSchedules[vehicle.vehicle_id] = selectedConductor;
        usedConductors.add(selectedConductor);
      } else {
        // 如果没有可用售票员，清空该车辆的分配
        newSchedules[vehicle.vehicle_id] = null;
      }
    });

    setLocalSchedules(newSchedules);
    messageApi.success('已自动随机分配完成');
  };

  // 保存排班
  const handleSave = async () => {
    setSaving(true);
    try {
      const schedules = Object.entries(localSchedules)
        .filter(([_, conductorId]) => conductorId !== null)
        .map(([vehicleId, conductorId]) => ({
          vehicle_id: vehicleId,
          conductor_id: conductorId!,
        }));

      if (schedules.length === 0) {
        messageApi.warning('请至少配置一个车辆的服务员');
        setSaving(false);
        return;
      }

      await batchCreateConductorSchedule({
        year: selectedYear,
        month: selectedMonth,
        schedules,
      });

      messageApi.success('保存成功');
      // 重新加载数据，更新原始状态
      await loadScheduleData(selectedYear, selectedMonth);
    } catch (error: any) {
      if (error?.response?.status === 403) return; // 已在全局统一提示
      const errorMessage =
        error?.response?.data?.message || error?.message || '保存失败';
      messageApi.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

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

  // 售票员选项（排除本车和已被其他车辆选中的售票员）
  const getConductorOptions = (vehicleId: string) => {
    // 获取所有已被选中的售票员ID（排除当前车辆自己的选择）
    const selectedConductorIds = new Set(
      Object.entries(localSchedules)
        .filter(([vid, cid]) => vid !== vehicleId && cid !== null)
        .map(([_, cid]) => cid!)
    );

    return allVehicles
      .filter(
        (v) =>
          v.id !== vehicleId && // 排除本车
          v.status === 'active' && // 只显示启用状态的车辆
          !selectedConductorIds.has(v.id) // 排除已被其他车辆选中的售票员
      )
      .map((v) => ({
        label: v.id,
        value: v.id,
      }));
  };

  const columns = [
    {
      title: '车辆',
      dataIndex: 'vehicle_id',
      width: 100,
      fixed: 'left' as const,
    },
    {
      title: '服务员',
      width: 120,
      render: (_: any, record: ConductorScheduleItem) => (
        <Select
          placeholder="请选择服务员"
          value={localSchedules[record.vehicle_id] ?? null}
          onChange={(value) => handleConductorChange(record.vehicle_id, value)}
          allowClear
          disabled={isMonthExpired}
          showSearch
          filterOption={(input, option) =>
            (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
          }
          style={{ width: 90 }}
          options={getConductorOptions(record.vehicle_id)}
        />
      ),
    },
    {
      title: '状态',
      width: 100,
      render: (_: any, record: ConductorScheduleItem) => {
        const conductorId = localSchedules[record.vehicle_id];
        if (!conductorId) {
          return <Tag color="warning">未配置</Tag>;
        }
        return <Tag color="success">已配置</Tag>;
      },
    },
  ];

  return (
    <PageContainer>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Space wrap>
            <Space>
              <span>选择月份：</span>
              <DatePicker
                picker="month"
                value={dayjs(`${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`)}
                onChange={handleMonthChange}
                format="YYYY-MM"
                placeholder="选择排班月份"
              />
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
            {isMonthExpired && (
              <Tag color="warning">当前月份已过期，仅可查看</Tag>
            )}
            <Button
              icon={<ThunderboltOutlined />}
              onClick={handleAutoAssign}
              disabled={isMonthExpired}
            >
              自动随机分配
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleReset}
              disabled={isMonthExpired}
            >
              重置所有配置
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
              disabled={isMonthExpired}
            >
              保存排班
            </Button>
          </Space>

          <Table<ConductorScheduleItem>
            rowKey="vehicle_id"
            columns={columns}
            dataSource={filteredVehicles}
            loading={loading}
            pagination={false}
            scroll={{ x: 600 }}
            summary={() => {
              const configuredCount = filteredVehicles.filter(
                (v) => localSchedules[v.vehicle_id] !== null && localSchedules[v.vehicle_id] !== undefined
              ).length;
              const totalCount = filteredVehicles.length;
              return (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={2}>
                      <strong>
                        {searchKeyword
                          ? `已筛选 ${totalCount} 辆，已配置 ${configuredCount} 辆`
                          : `共 ${totalCount} 辆，已配置 ${configuredCount} 辆`}
                      </strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} />
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
