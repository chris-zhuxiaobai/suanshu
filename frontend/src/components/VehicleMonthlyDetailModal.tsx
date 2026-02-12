import { Modal, Table, Tag, Space, Row, Col, Statistic } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { getVehicleMonthlyDetail } from '@/services/monthlyStatistics';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';

export interface VehicleMonthlyDetailModalProps {
  /** 是否显示 */
  open: boolean;
  /** 车辆ID */
  vehicleId: string;
  /** 年份 */
  year: number;
  /** 月份 */
  month: number;
  /** 金额格式化函数 */
  formatAmount?: (amount: number) => string;
  /** 关闭回调 */
  onClose: () => void;
}

function defaultFormatAmount(amount: number): string {
  if (isNaN(amount) || !isFinite(amount)) return '0';
  const truncated = Math.floor(amount * 10) / 10;
  return truncated % 1 === 0 ? truncated.toString() : truncated.toFixed(1);
}

export default function VehicleMonthlyDetailModal({
  open,
  vehicleId,
  year,
  month,
  formatAmount = defaultFormatAmount,
  onClose,
}: VehicleMonthlyDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<API.VehicleMonthlyDetailData | null>(null);

  useEffect(() => {
    if (open && vehicleId) {
      loadData();
    } else {
      setData(null);
    }
  }, [open, vehicleId, year, month]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await getVehicleMonthlyDetail(vehicleId, year, month);
      setData(result);
    } catch (error: any) {
      console.error('加载车辆月详情失败:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // 提取服务员信息（从所有记录中获取，去重）
  const conductorInfo = useMemo(() => {
    if (!data?.records || data.records.length === 0) return null;
    const conductors = new Set<string>();
    data.records.forEach((record) => {
      if (record.conductor_id) {
        conductors.add(record.conductor_id);
      }
    });
    return Array.from(conductors);
  }, [data?.records]);

  // 计算合计数据
  const summaryData = useMemo(() => {
    if (!data?.records || data.records.length === 0) {
      return {
        turn_total: 0,
        wechat_amount: 0,
        revenue: 0,
        fuel_subsidy: 0,
        reward_penalty: 0,
        net_income: 0,
        turn_count: 0,
        turn1_amount: 0,
        turn2_amount: 0,
        turn3_amount: 0,
        turn4_amount: 0,
        turn5_amount: 0,
      };
    }

    return data.records.reduce(
      (acc, record) => ({
        turn_total: acc.turn_total + (record.turn_total || 0),
        wechat_amount: acc.wechat_amount + (record.wechat_amount || 0),
        revenue: acc.revenue + (record.revenue || 0),
        fuel_subsidy: acc.fuel_subsidy + (record.fuel_subsidy || 0),
        reward_penalty: acc.reward_penalty + (record.reward_penalty || 0),
        net_income: acc.net_income + (record.net_income || 0),
        turn_count: acc.turn_count + (record.turn_count || 0),
        turn1_amount: acc.turn1_amount + (record.turn1_amount || 0),
        turn2_amount: acc.turn2_amount + (record.turn2_amount || 0),
        turn3_amount: acc.turn3_amount + (record.turn3_amount || 0),
        turn4_amount: acc.turn4_amount + (record.turn4_amount || 0),
        turn5_amount: acc.turn5_amount + (record.turn5_amount || 0),
      }),
      {
        turn_total: 0,
        wechat_amount: 0,
        revenue: 0,
        fuel_subsidy: 0,
        reward_penalty: 0,
        net_income: 0,
        turn_count: 0,
        turn1_amount: 0,
        turn2_amount: 0,
        turn3_amount: 0,
        turn4_amount: 0,
        turn5_amount: 0,
      }
    );
  }, [data?.records]);

  const columns: ColumnsType<API.VehicleMonthlyDetailData['records'][0]> = [
    {
      title: '日期',
      dataIndex: 'date',
      width: 100,
      fixed: 'left' as const,
      render: (date: string) => dayjs(date).format('MM-DD'),
    },
    {
      title: '现金收入',
      dataIndex: 'turn_total',
      width: 100,
      render: (v: number) => (v > 0 ? formatAmount(v) : ''),
    },
    {
      title: '微信收入',
      dataIndex: 'wechat_amount',
      width: 100,
      render: (v: number) => (v > 0 ? formatAmount(v) : ''),
    },
    {
      title: '营业额',
      dataIndex: 'revenue',
      width: 100,
      render: (v: number) => (v > 0 ? formatAmount(v) : ''),
    },
    {
      title: '补油款',
      dataIndex: 'fuel_subsidy',
      width: 100,
      render: (v: number) => (v > 0 ? formatAmount(v) : ''),
    },
    {
      title: '奖罚',
      dataIndex: 'reward_penalty',
      width: 100,
      render: (v: number) => {
        if (v === 0) return '';
        const color = v > 0 ? '#52c41a' : '#ff4d4f';
        return <span style={{ color, fontWeight: 'bold' }}>{v > 0 ? '+' : ''}{formatAmount(v)}</span>;
      },
    },
    {
      title: '实际分配金额',
      dataIndex: 'net_income',
      width: 120,
      render: (v: number) => (v > 0 ? formatAmount(v) : ''),
    },
    {
      title: '转数',
      dataIndex: 'turn_count',
      width: 80,
      render: (v: number) => (v > 0 ? v.toString() : ''),
    },
    {
      title: '第1转',
      dataIndex: 'turn1_amount',
      width: 90,
      render: (v: number) => (v > 0 ? formatAmount(v) : ''),
    },
    {
      title: '第2转',
      dataIndex: 'turn2_amount',
      width: 90,
      render: (v: number) => (v > 0 ? formatAmount(v) : ''),
    },
    {
      title: '第3转',
      dataIndex: 'turn3_amount',
      width: 90,
      render: (v: number) => (v > 0 ? formatAmount(v) : ''),
    },
    {
      title: '第4转',
      dataIndex: 'turn4_amount',
      width: 90,
      render: (v: number) => (v > 0 ? formatAmount(v) : ''),
    },
    {
      title: '第5转',
      dataIndex: 'turn5_amount',
      width: 90,
      render: (v: number) => (v > 0 ? formatAmount(v) : ''),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      width: 140,
      ellipsis: true,
      render: (v: string) => v || '',
    },
  ];

  return (
    <Modal
      title="车辆月详情"
      open={open}
      onCancel={onClose}
      footer={null}
      width={1600}
      destroyOnHidden
    >
      {/* 统计信息卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Statistic title="车辆" value={vehicleId} />
        </Col>
        <Col span={6}>
          <Statistic title="月份" value={`${year}-${String(month).padStart(2, '0')}`} />
        </Col>
        <Col span={12}>
          <div style={{ paddingTop: 4 }}>
            <div style={{ fontSize: '14px', color: 'rgba(0, 0, 0, 0.45)', marginBottom: 4 }}>服务员</div>
            <div>
              {conductorInfo && conductorInfo.length > 0 ? (
                <Space size="small">
                  {conductorInfo.map((id) => (
                    <Tag key={id}>{id}</Tag>
                  ))}
                </Space>
              ) : (
                <span style={{ color: '#999' }}>-</span>
              )}
            </div>
          </div>
        </Col>
      </Row>

      <Table
        loading={loading}
        dataSource={data?.records || []}
        columns={columns}
        pagination={false}
        scroll={{ x: 1500, y: 600 }}
        size="small"
        rowKey="date"
        summary={(pageData) => {
          if (!pageData || pageData.length === 0) return null;

          return (
            <Table.Summary fixed>
              <Table.Summary.Row style={{ backgroundColor: '#fafafa', fontWeight: 'bold' }}>
                <Table.Summary.Cell index={0} colSpan={1}>
                  合计
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1}>
                  {summaryData.turn_total > 0 ? formatAmount(summaryData.turn_total) : ''}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2}>
                  {summaryData.wechat_amount > 0 ? formatAmount(summaryData.wechat_amount) : ''}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3}>
                  {summaryData.revenue > 0 ? formatAmount(summaryData.revenue) : ''}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4}>
                  {summaryData.fuel_subsidy > 0 ? formatAmount(summaryData.fuel_subsidy) : ''}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5}>
                  {summaryData.reward_penalty !== 0 ? (
                    <span
                      style={{
                        color: summaryData.reward_penalty > 0 ? '#52c41a' : '#ff4d4f',
                        fontWeight: 'bold',
                      }}
                    >
                      {summaryData.reward_penalty > 0 ? '+' : ''}
                      {formatAmount(summaryData.reward_penalty)}
                    </span>
                  ) : (
                    ''
                  )}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6}>
                  {summaryData.net_income > 0 ? formatAmount(summaryData.net_income) : ''}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={7}>
                  {summaryData.turn_count > 0 ? summaryData.turn_count.toString() : ''}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={8}>
                  {summaryData.turn1_amount > 0 ? formatAmount(summaryData.turn1_amount) : ''}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={9}>
                  {summaryData.turn2_amount > 0 ? formatAmount(summaryData.turn2_amount) : ''}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={10}>
                  {summaryData.turn3_amount > 0 ? formatAmount(summaryData.turn3_amount) : ''}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={11}>
                  {summaryData.turn4_amount > 0 ? formatAmount(summaryData.turn4_amount) : ''}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={12}>
                  {summaryData.turn5_amount > 0 ? formatAmount(summaryData.turn5_amount) : ''}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={13} colSpan={1} />
              </Table.Summary.Row>
            </Table.Summary>
          );
        }}
      />
    </Modal>
  );
}
