import DailyStatisticsView from '@/components/DailyStatisticsView';
import { PageContainer } from '@ant-design/pro-components';
import { App, Card, Col, DatePicker, Divider, Row, Space, Statistic, Table, Tabs, Tag } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { getStatisticsByDate } from '@/services/dailyStatistics';

export default function DailyStatisticsPage() {
  const { message: messageApi } = App.useApp();
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [statisticsLoading, setStatisticsLoading] = useState(false);
  const [statisticsData, setStatisticsData] = useState<API.DailyStatisticsData | null>(null);

  // 金额格式化：整数不显示小数，小数保留1位
  const formatAmount = (amount: number): string => {
    if (isNaN(amount) || !isFinite(amount)) return '0';
    const truncated = Math.floor(amount * 10) / 10;
    return truncated % 1 === 0 ? truncated.toString() : truncated.toFixed(1);
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

  // 日期变化时重新加载
  useEffect(() => {
    loadStatisticsData(selectedDate);
  }, [selectedDate]);

  // 禁用未来日期
  const disabledDate = (current: Dayjs | null) => {
    if (!current) return false;
    const today = dayjs().startOf('day');
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

  // 计算总览数据
  const overviewData = useMemo(() => {
    if (!statisticsData?.vehicles) {
      return null;
    }

    const vehicles = statisticsData.vehicles;
    const operatingVehicles = vehicles.filter((v) => !v.is_rest); // 营运车辆 = 非休息车辆（不管是否已录入）
    const restVehicles = vehicles.filter((v) => v.is_rest);
    const vehiclesWithIncome = vehicles.filter((v) => v.has_income); // 已入账 = 有收入的车辆
    const vehiclesWithRevenue = vehicles.filter((v) => v.has_income && v.revenue > 0);
    const vehiclesWithNetIncome = vehicles.filter((v) => v.has_income && v.net_income > 0);
    const vehiclesWithTurns = vehicles.filter((v) => v.has_income && v.turn_count > 0);

    // 最高/最低营业额
    let maxRevenueVehicle = vehiclesWithRevenue[0] || null;
    let minRevenueVehicle = vehiclesWithRevenue[0] || null;
    if (vehiclesWithRevenue.length > 0) {
      vehiclesWithRevenue.forEach((v) => {
        if (v.revenue > maxRevenueVehicle!.revenue) maxRevenueVehicle = v;
        if (v.revenue < minRevenueVehicle!.revenue) minRevenueVehicle = v;
      });
    }

    // 最高/最低实际分配金额
    let maxNetIncomeVehicle = vehiclesWithNetIncome[0] || null;
    let minNetIncomeVehicle = vehiclesWithNetIncome[0] || null;
    if (vehiclesWithNetIncome.length > 0) {
      vehiclesWithNetIncome.forEach((v) => {
        if (v.net_income > maxNetIncomeVehicle!.net_income) maxNetIncomeVehicle = v;
        if (v.net_income < minNetIncomeVehicle!.net_income) minNetIncomeVehicle = v;
      });
    }

    // 单转收入最高/最低（单次转的最大/最小金额，取 turn1-turn5 中的最大值/最小值）
    let maxSingleTurnVehicle = vehiclesWithTurns[0] || null;
    let maxSingleTurnValue = 0;
    let minSingleTurnVehicle = vehiclesWithTurns[0] || null;
    let minSingleTurnValue = Infinity;
    if (vehiclesWithTurns.length > 0) {
      vehiclesWithTurns.forEach((v) => {
        const turnAmounts = [
          v.turn1_amount || 0,
          v.turn2_amount || 0,
          v.turn3_amount || 0,
          v.turn4_amount || 0,
          v.turn5_amount || 0,
        ].filter((amt) => amt > 0); // 只考虑有收入的转
        if (turnAmounts.length > 0) {
          const maxTurn = Math.max(...turnAmounts);
          const minTurn = Math.min(...turnAmounts);
          if (maxTurn > maxSingleTurnValue) {
            maxSingleTurnValue = maxTurn;
            maxSingleTurnVehicle = v;
          }
          if (minTurn < minSingleTurnValue) {
            minSingleTurnValue = minTurn;
            minSingleTurnVehicle = v;
          }
        }
      });
    }
    if (minSingleTurnValue === Infinity) {
      minSingleTurnVehicle = null;
      minSingleTurnValue = 0;
    }

    // 平均每转收入最高（revenue / turn_count）

    // 营业额排行：先列出有收入的车辆，然后列出未入账的营运车辆，最后列出休息的车辆
    const revenueRankingWithIncome = [...vehiclesWithRevenue]
      .sort((a, b) => b.revenue - a.revenue)
      .map((v, index) => ({ ...v, rank: index + 1 }));
    
    // 未入账的营运车辆（营运但没收入）
    const operatingNoIncomeVehicles = operatingVehicles
      .filter((v) => !v.has_income) // 未录入的营运车辆
      .filter((v) => !revenueRankingWithIncome.some((r) => r.vehicle_id === v.vehicle_id)) // 排除已在有收入列表中的
      .map((v, index) => ({ ...v, rank: revenueRankingWithIncome.length + index + 1 }));
    
    // 休息的车辆
    const restVehiclesForRevenue = restVehicles
      .filter((v) => !revenueRankingWithIncome.some((r) => r.vehicle_id === v.vehicle_id) && !operatingNoIncomeVehicles.some((o) => o.vehicle_id === v.vehicle_id))
      .map((v, index) => ({ ...v, is_rest: true, revenue: 0, rank: revenueRankingWithIncome.length + operatingNoIncomeVehicles.length + index + 1 }));
    
    const revenueRanking = [...revenueRankingWithIncome, ...operatingNoIncomeVehicles, ...restVehiclesForRevenue];

    // 单转收入排行（按单转收入排序，车辆可重复上榜，每辆车的每个转都单独参与排行）
    const singleTurnRankingRaw: Array<{
      vehicle_id: string;
      conductor_id: string | null;
      is_overtime: boolean;
      turnNumber: number;
      turnAmount: number;
    }> = [];
    vehiclesWithTurns.forEach((v) => {
      const turns = [
        { num: 1, amount: v.turn1_amount || 0 },
        { num: 2, amount: v.turn2_amount || 0 },
        { num: 3, amount: v.turn3_amount || 0 },
        { num: 4, amount: v.turn4_amount || 0 },
        { num: 5, amount: v.turn5_amount || 0 },
      ];
      turns.forEach((turn) => {
        if (turn.amount > 0) {
          singleTurnRankingRaw.push({
            vehicle_id: v.vehicle_id,
            conductor_id: v.conductor_id,
            is_overtime: v.is_overtime || false,
            turnNumber: turn.num,
            turnAmount: turn.amount,
          });
        }
      });
    });
    // 按金额降序排序
    singleTurnRankingRaw.sort((a, b) => b.turnAmount - a.turnAmount);
    // 取前20条和后3条，中间用省略号
    const top20 = singleTurnRankingRaw.slice(0, 20);
    const bottom3 = singleTurnRankingRaw.slice(-3);
    const hasEllipsis = singleTurnRankingRaw.length > 23; // 超过23条才需要省略号
    
    // 检查是否有重复的 key（同一辆车的同一转不应该出现两次，但为了安全起见，添加唯一索引）
    const singleTurnRanking = [
      ...top20.map((item, index) => ({ ...item, rank: index + 1, uniqueIndex: index })),
      ...(hasEllipsis ? [{ isEllipsis: true, rank: 21, uniqueIndex: 20 }] : []),
      ...bottom3.map((item, index) => ({
        ...item,
        rank: singleTurnRankingRaw.length - 2 + index,
        uniqueIndex: (hasEllipsis ? 21 : top20.length) + index,
      })),
    ];

    // 平均每转收入排行：先列出有转数的车辆，然后列出未入账的营运车辆，最后列出休息的车辆
    const avgTurnRankingWithTurns = [...vehiclesWithTurns]
      .map((v) => ({ ...v, avgTurnRevenue: v.revenue / v.turn_count }))
      .sort((a, b) => b.avgTurnRevenue - a.avgTurnRevenue)
      .map((v, index) => ({ ...v, rank: index + 1 }));
    
    // 平均每转收入最低（从有转数的车辆中找）
    const minAvgTurnVehicle = avgTurnRankingWithTurns.length > 0 ? avgTurnRankingWithTurns[avgTurnRankingWithTurns.length - 1] : null;
    
    // 未入账的营运车辆（营运但没有转数）
    const operatingNoTurnsVehicles = operatingVehicles
      .filter((v) => !v.has_income || v.turn_count === 0) // 未录入或没有转数的营运车辆
      .filter((v) => !avgTurnRankingWithTurns.some((r) => r.vehicle_id === v.vehicle_id)) // 排除已在有转数列表中的
      .map((v, index) => ({ ...v, avgTurnRevenue: 0, rank: avgTurnRankingWithTurns.length + index + 1 }));
    
    // 休息的车辆
    const restVehiclesForAvgTurn = restVehicles
      .filter((v) => !avgTurnRankingWithTurns.some((r) => r.vehicle_id === v.vehicle_id) && !operatingNoTurnsVehicles.some((o) => o.vehicle_id === v.vehicle_id))
      .map((v, index) => ({ ...v, is_rest: true, avgTurnRevenue: 0, rank: avgTurnRankingWithTurns.length + operatingNoTurnsVehicles.length + index + 1 }));
    
    const avgTurnRanking = [...avgTurnRankingWithTurns, ...operatingNoTurnsVehicles, ...restVehiclesForAvgTurn];

    // 奖罚排行（只包含有奖罚的记录，按奖罚金额降序：正数在前，负数在后）
    const rewardPenaltyRanking = [...vehiclesWithIncome]
      .filter((v) => v.reward_penalty != null && v.reward_penalty !== 0)
      .sort((a, b) => {
        // 先按正负排序：正数在前，负数在后
        if (a.reward_penalty! > 0 && b.reward_penalty! <= 0) return -1;
        if (a.reward_penalty! <= 0 && b.reward_penalty! > 0) return 1;
        // 同号时按绝对值降序
        return Math.abs(b.reward_penalty!) - Math.abs(a.reward_penalty!);
      })
      .map((v, index) => ({ ...v, rank: index + 1 }));

    // 待入账车辆数（营运但未入账的车辆）
    const pendingIncomeCount = operatingVehicles.filter((v) => !v.has_income).length;

    // 收付平衡统计
    const receivableTotal = vehiclesWithIncome.reduce((sum, v) => {
      const payment = v.payment_amount || 0;
      return sum + (payment > 0 ? payment : 0);
    }, 0);
    const payableTotal = vehiclesWithIncome.reduce((sum, v) => {
      const payment = v.payment_amount || 0;
      return sum + (payment < 0 ? Math.abs(payment) : 0);
    }, 0);
    const paymentBalance = receivableTotal - payableTotal; // 应收总额 - 应付总额，理论上应该接近0

    return {
      operatingCount: operatingVehicles.length,
      incomeCount: vehiclesWithIncome.length,
      pendingIncomeCount,
      restCount: restVehicles.length,
      restVehicles: restVehicles.map((v) => v.vehicle_id),
      totalRevenue: statisticsData.statistics?.total_revenue || 0,
      totalNetIncome: statisticsData.statistics?.total_net_income || 0,
      averageRevenue: statisticsData.statistics?.average_revenue || 0,
      averageNetIncome: statisticsData.statistics?.average_net_income || 0,
      maxRevenueVehicle,
      minRevenueVehicle,
      maxNetIncomeVehicle,
      minNetIncomeVehicle,
      maxSingleTurnVehicle,
      maxSingleTurnValue,
      minSingleTurnVehicle,
      minSingleTurnValue,
      minAvgTurnVehicle,
      revenueRanking,
      singleTurnRanking,
      avgTurnRanking,
      rewardPenaltyRanking,
      receivableTotal,
      payableTotal,
      paymentBalance,
    };
  }, [statisticsData]);

  return (
    <PageContainer>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 日期选择 */}
          <Space>
            <span>选择日期：</span>
            <DatePicker
              value={selectedDate}
              onChange={handleDateChange}
              disabledDate={disabledDate}
              format="YYYY-MM-DD"
              placeholder="选择统计日期"
              showToday
            />
          </Space>

          {/* Tab：数据总览、数据详情 */}
          <Tabs
            items={[
              {
                key: 'overview',
                label: '数据总览',
                children: statisticsLoading ? (
                  <Card loading />
                ) : overviewData ? (
                  <Space direction="vertical" style={{ width: '100%' }} size="large">
                    {/* 基础数据 */}
                    <Card title={`基础数据（${selectedDate.format('YYYY-MM-DD')}）`}>
                      <Row gutter={[8, 16]}>
                        <Col span={5}>
                          <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            <Statistic title="营运车辆" value={overviewData.operatingCount} suffix="辆" />
                            <div style={{ fontSize: '14px', color: '#666' }}>
                              已入账：<span style={{ fontWeight: 500 }}>{overviewData.incomeCount}</span> 辆
                            </div>
                            <div style={{ fontSize: '14px', color: '#666' }}>
                              待入账：<span style={{ fontWeight: 500 }}>{overviewData.pendingIncomeCount}</span> 辆
                            </div>
                          </Space>
                        </Col>
                        <Col span={5}>
                          <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            <Statistic title="休息车辆" value={overviewData.restCount} suffix="辆" />
                            {overviewData.restVehicles.length > 0 && (
                              <div style={{ marginTop: 8 }}>
                                <div style={{ fontSize: '12px', color: '#666', marginBottom: 4 }}>休息车辆：</div>
                                <Space size={[4, 4]} wrap>
                                  {overviewData.restVehicles.map((vid) => (
                                    <Tag key={vid} color="warning">{vid}</Tag>
                                  ))}
                                </Space>
                              </div>
                            )}
                          </Space>
                        </Col>
                        <Col span={5}>
                          <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                              <strong style={{ width: 110, textAlign: 'right', flexShrink: 0 }}>最高营业额：</strong>
                              {overviewData.maxRevenueVehicle ? (
                                <>
                                  <Tag color="green" style={{ flexShrink: 0 }}>{overviewData.maxRevenueVehicle.vehicle_id}</Tag>
                                  <span style={{ minWidth: 80, flexShrink: 0 }}>{formatAmount(overviewData.maxRevenueVehicle.revenue)} 元</span>
                                  {overviewData.maxRevenueVehicle.conductor_id && (
                                    <>
                                      <span style={{ color: '#666', flexShrink: 0 }}>服务员：</span>
                                      <Tag style={{ flexShrink: 0 }}>{overviewData.maxRevenueVehicle.conductor_id}</Tag>
                                    </>
                                  )}
                                </>
                              ) : (
                                <span style={{ color: '#999' }}>暂无</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                              <strong style={{ width: 110, textAlign: 'right', flexShrink: 0 }}>最高实际分配：</strong>
                              {overviewData.maxNetIncomeVehicle ? (
                                <>
                                  <Tag color="cyan" style={{ flexShrink: 0 }}>{overviewData.maxNetIncomeVehicle.vehicle_id}</Tag>
                                  <span style={{ minWidth: 80, flexShrink: 0 }}>{formatAmount(overviewData.maxNetIncomeVehicle.net_income)} 元</span>
                                  {overviewData.maxNetIncomeVehicle.conductor_id && (
                                    <>
                                      <span style={{ color: '#666', flexShrink: 0 }}>服务员：</span>
                                      <Tag style={{ flexShrink: 0 }}>{overviewData.maxNetIncomeVehicle.conductor_id}</Tag>
                                    </>
                                  )}
                                </>
                              ) : (
                                <span style={{ color: '#999' }}>暂无</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                              <strong style={{ width: 110, textAlign: 'right', flexShrink: 0 }}>单转收入最高：</strong>
                              {overviewData.maxSingleTurnVehicle ? (
                                <>
                                  <Tag color="blue" style={{ flexShrink: 0 }}>{overviewData.maxSingleTurnVehicle.vehicle_id}</Tag>
                                  <span style={{ minWidth: 80, flexShrink: 0 }}>{formatAmount(overviewData.maxSingleTurnValue)} 元</span>
                                  {overviewData.maxSingleTurnVehicle.conductor_id && (
                                    <>
                                      <span style={{ color: '#666', flexShrink: 0 }}>服务员：</span>
                                      <Tag style={{ flexShrink: 0 }}>{overviewData.maxSingleTurnVehicle.conductor_id}</Tag>
                                    </>
                                  )}
                                </>
                              ) : (
                                <span style={{ color: '#999' }}>暂无</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                              <strong style={{ width: 110, textAlign: 'right', flexShrink: 0 }}>平均每转最高：</strong>
                              {overviewData.avgTurnRanking[0] && overviewData.avgTurnRanking[0].has_income && overviewData.avgTurnRanking[0].avgTurnRevenue > 0 ? (
                                <>
                                  <Tag color="purple" style={{ flexShrink: 0 }}>{overviewData.avgTurnRanking[0].vehicle_id}</Tag>
                                  <span style={{ minWidth: 80, flexShrink: 0 }}>
                                    {formatAmount(overviewData.avgTurnRanking[0].avgTurnRevenue)} 元
                                  </span>
                                  {overviewData.avgTurnRanking[0].conductor_id && (
                                    <>
                                      <span style={{ color: '#666', flexShrink: 0 }}>服务员：</span>
                                      <Tag style={{ flexShrink: 0 }}>{overviewData.avgTurnRanking[0].conductor_id}</Tag>
                                    </>
                                  )}
                                </>
                              ) : (
                                <span style={{ color: '#999' }}>暂无</span>
                              )}
                            </div>
                          </Space>
                        </Col>
                        <Col span={5}>
                          <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                              <strong style={{ width: 110, textAlign: 'right', flexShrink: 0 }}>最低营业额：</strong>
                              {overviewData.minRevenueVehicle ? (
                                <>
                                  <Tag color="orange" style={{ flexShrink: 0 }}>{overviewData.minRevenueVehicle.vehicle_id}</Tag>
                                  <span style={{ minWidth: 80, flexShrink: 0 }}>{formatAmount(overviewData.minRevenueVehicle.revenue)} 元</span>
                                  {overviewData.minRevenueVehicle.conductor_id && (
                                    <>
                                      <span style={{ color: '#666', flexShrink: 0 }}>服务员：</span>
                                      <Tag style={{ flexShrink: 0 }}>{overviewData.minRevenueVehicle.conductor_id}</Tag>
                                    </>
                                  )}
                                </>
                              ) : (
                                <span style={{ color: '#999' }}>暂无</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                              <strong style={{ width: 110, textAlign: 'right', flexShrink: 0 }}>最低实际分配：</strong>
                              {overviewData.minNetIncomeVehicle ? (
                                <>
                                  <Tag color="magenta" style={{ flexShrink: 0 }}>{overviewData.minNetIncomeVehicle.vehicle_id}</Tag>
                                  <span style={{ minWidth: 80, flexShrink: 0 }}>{formatAmount(overviewData.minNetIncomeVehicle.net_income)} 元</span>
                                  {overviewData.minNetIncomeVehicle.conductor_id && (
                                    <>
                                      <span style={{ color: '#666', flexShrink: 0 }}>服务员：</span>
                                      <Tag style={{ flexShrink: 0 }}>{overviewData.minNetIncomeVehicle.conductor_id}</Tag>
                                    </>
                                  )}
                                </>
                              ) : (
                                <span style={{ color: '#999' }}>暂无</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                              <strong style={{ width: 110, textAlign: 'right', flexShrink: 0 }}>单转收入最低：</strong>
                              {overviewData.minSingleTurnVehicle ? (
                                <>
                                  <Tag color="geekblue" style={{ flexShrink: 0 }}>{overviewData.minSingleTurnVehicle.vehicle_id}</Tag>
                                  <span style={{ minWidth: 80, flexShrink: 0 }}>{formatAmount(overviewData.minSingleTurnValue)} 元</span>
                                  {overviewData.minSingleTurnVehicle.conductor_id && (
                                    <>
                                      <span style={{ color: '#666', flexShrink: 0 }}>服务员：</span>
                                      <Tag style={{ flexShrink: 0 }}>{overviewData.minSingleTurnVehicle.conductor_id}</Tag>
                                    </>
                                  )}
                                </>
                              ) : (
                                <span style={{ color: '#999' }}>暂无</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                              <strong style={{ width: 110, textAlign: 'right', flexShrink: 0 }}>平均每转最低：</strong>
                              {overviewData.minAvgTurnVehicle ? (
                                <>
                                  <Tag color="volcano" style={{ flexShrink: 0 }}>{overviewData.minAvgTurnVehicle.vehicle_id}</Tag>
                                  <span style={{ minWidth: 80, flexShrink: 0 }}>
                                    {formatAmount(overviewData.minAvgTurnVehicle.avgTurnRevenue)} 元
                                  </span>
                                  {overviewData.minAvgTurnVehicle.conductor_id && (
                                    <>
                                      <span style={{ color: '#666', flexShrink: 0 }}>服务员：</span>
                                      <Tag style={{ flexShrink: 0 }}>{overviewData.minAvgTurnVehicle.conductor_id}</Tag>
                                    </>
                                  )}
                                </>
                              ) : (
                                <span style={{ color: '#999' }}>暂无</span>
                              )}
                            </div>
                          </Space>
                        </Col>
                      </Row>
                      <Divider style={{ margin: '16px 0' }} />
                      {/* 统计数据汇总 */}
                      <Row gutter={[16, 16]}>
                        <Col span={6}>
                          <Statistic
                            title="总营业额"
                            value={formatAmount(overviewData.totalRevenue)}
                            suffix="元"
                            valueStyle={{ color: '#1677ff' }}
                          />
                        </Col>
                        <Col span={6}>
                          <Statistic
                            title="总实际分配金额"
                            value={formatAmount(overviewData.totalNetIncome)}
                            suffix="元"
                            valueStyle={{ color: '#52c41a' }}
                          />
                        </Col>
                        <Col span={6}>
                          <Statistic
                            title="平均营业额"
                            value={formatAmount(overviewData.averageRevenue)}
                            suffix="元"
                            valueStyle={{ color: '#722ed1' }}
                          />
                        </Col>
                        <Col span={6}>
                          <Statistic
                            title="平均实际分配金额"
                            value={formatAmount(overviewData.averageNetIncome)}
                            suffix="元"
                            valueStyle={{ color: '#fa8c16' }}
                          />
                        </Col>
                      </Row>
                    </Card>

                    {/* 四个排行榜 */}
                    <Row gutter={16}>
                      <Col span={6}>
                        <Card title="营业额排行" size="small">
                          <Table
                            size="small"
                            dataSource={overviewData.revenueRanking}
                            pagination={false}
                            columns={[
                              {
                                title: '排名',
                                dataIndex: 'rank',
                                width: 60,
                                render: (rank: number) => (
                                  <Tag color={rank <= 3 ? 'gold' : 'default'}>{rank}</Tag>
                                ),
                              },
                              {
                                title: '车辆',
                                dataIndex: 'vehicle_id',
                                width: 120,
                                render: (value: string, record: any) => (
                                  <Space size="small">
                                    <span>{value}</span>
                                    {record.is_overtime ? (
                                      <Tag color="orange" size="small">加班</Tag>
                                    ) : (
                                      record.is_rest && <Tag color="warning" size="small">休息</Tag>
                                    )}
                                  </Space>
                                ),
                              },
                              {
                                title: '服务员',
                                dataIndex: 'conductor_id',
                                width: 100,
                                render: (v: string | null) => v || '-',
                              },
                              {
                                title: '营业额',
                                dataIndex: 'revenue',
                                render: (v: number, record: any) => {
                                  // 加班车即使 is_rest 为 true 也应该显示营业额
                                  if (record.is_overtime) {
                                    if (!record.has_income || v === 0) return '-';
                                    return formatAmount(v) + ' 元';
                                  }
                                  // 非加班的休息车辆或未入账车辆显示 '-'
                                  if (record.is_rest || !record.has_income || v === 0) return '-';
                                  return formatAmount(v) + ' 元';
                                },
                              },
                            ]}
                            rowKey="vehicle_id"
                          />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card title="单转收入排行" size="small">
                          {overviewData.singleTurnRanking.length > 0 ? (
                            <Table
                              size="small"
                              dataSource={overviewData.singleTurnRanking}
                              pagination={false}
                              columns={[
                                {
                                  title: '排名',
                                  dataIndex: 'rank',
                                  width: 60,
                                  render: (rank: number, record: any) => {
                                    if (record.isEllipsis) {
                                      return <span style={{ color: '#999' }}>...</span>;
                                    }
                                    return <Tag color={rank <= 3 ? 'gold' : 'default'}>{rank}</Tag>;
                                  },
                                },
                                {
                                  title: '车辆',
                                  dataIndex: 'vehicle_id',
                                  width: 110,
                                  render: (value: string, record: any) => {
                                    if (record.isEllipsis) return null;
                                    return (
                                      <Space size="small">
                                        <span>{value}</span>
                                        {record.is_overtime && <Tag color="orange" size="small">加班</Tag>}
                                      </Space>
                                    );
                                  },
                                },
                                {
                                  title: '服务员',
                                  dataIndex: 'conductor_id',
                                  width: 80,
                                  render: (v: string | null, record: any) => {
                                    if (record.isEllipsis) return null;
                                    return v || '-';
                                  },
                                },
                                {
                                  title: '转数',
                                  dataIndex: 'turnNumber',
                                  width: 85,
                                  render: (v: number, record: any) => {
                                    if (record.isEllipsis) return null;
                                    return `第${v}转`;
                                  },
                                },
                                {
                                  title: '单转收入',
                                  dataIndex: 'turnAmount',
                                  width: 100,
                                  render: (v: number, record: any) => {
                                    if (record.isEllipsis) return null;
                                    return formatAmount(v) + ' 元';
                                  },
                                },
                              ]}
                              rowKey={(record: any) =>
                                record.isEllipsis ? 'ellipsis' : `${record.vehicle_id}-${record.turnNumber}-${record.uniqueIndex ?? record.rank}`
                              }
                            />
                          ) : (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>暂无</div>
                          )}
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card title="平均每转收入排行" size="small">
                          <Table
                            size="small"
                            dataSource={overviewData.avgTurnRanking}
                            pagination={false}
                            columns={[
                              {
                                title: '排名',
                                dataIndex: 'rank',
                                width: 60,
                                render: (rank: number) => (
                                  <Tag color={rank <= 3 ? 'gold' : 'default'}>{rank}</Tag>
                                ),
                              },
                              {
                                title: '车辆',
                                dataIndex: 'vehicle_id',
                                width: 120,
                                render: (value: string, record: any) => (
                                  <Space size="small">
                                    <span>{value}</span>
                                    {record.is_overtime ? (
                                      <Tag color="orange" size="small">加班</Tag>
                                    ) : (
                                      record.is_rest && <Tag color="warning" size="small">休息</Tag>
                                    )}
                                  </Space>
                                ),
                              },
                              {
                                title: '服务员',
                                dataIndex: 'conductor_id',
                                width: 100,
                                render: (v: string | null) => v || '-',
                              },
                              {
                                title: '平均每转',
                                dataIndex: 'avgTurnRevenue',
                                render: (v: number, record: any) => {
                                  // 加班车即使 is_rest 为 true 也应该显示平均每转收入
                                  if (record.is_overtime) {
                                    if (!record.has_income || v === 0) return '-';
                                    return formatAmount(v) + ' 元';
                                  }
                                  // 非加班的休息车辆或未入账车辆显示 '-'
                                  if (record.is_rest || !record.has_income || v === 0) return '-';
                                  return formatAmount(v) + ' 元';
                                },
                              },
                            ]}
                            rowKey="vehicle_id"
                          />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card title="奖罚排行" size="small">
                          {overviewData.rewardPenaltyRanking.length > 0 ? (
                            <Table
                              size="small"
                              dataSource={overviewData.rewardPenaltyRanking}
                              pagination={false}
                              columns={[
                                {
                                  title: '排名',
                                  dataIndex: 'rank',
                                  width: 60,
                                  render: (rank: number) => (
                                    <Tag color={rank <= 3 ? 'gold' : 'default'}>{rank}</Tag>
                                  ),
                                },
                                {
                                  title: '车辆',
                                  dataIndex: 'vehicle_id',
                                  width: 120,
                                  render: (value: string, record: any) => (
                                    <Space size="small">
                                      <span>{value}</span>
                                      {record.is_overtime && <Tag color="orange" size="small">加班</Tag>}
                                    </Space>
                                  ),
                                },
                                {
                                  title: '服务员',
                                  dataIndex: 'conductor_id',
                                  width: 100,
                                  render: (v: string | null) => v || '-',
                                },
                                {
                                  title: '奖罚',
                                  dataIndex: 'reward_penalty',
                                  render: (v: number) => {
                                    const color = v > 0 ? '#52c41a' : '#ff4d4f';
                                    return (
                                      <span style={{ color, fontWeight: v !== 0 ? 'bold' : 'normal' }}>
                                        {v > 0 ? '+' : ''}{formatAmount(v)} 元
                                      </span>
                                    );
                                  },
                                },
                              ]}
                              rowKey="vehicle_id"
                            />
                          ) : (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>暂无</div>
                          )}
                        </Card>
                      </Col>
                    </Row>
                  </Space>
                ) : (
                  <Card>暂无数据</Card>
                ),
              },
              {
                key: 'detail',
                label: '数据详情',
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
