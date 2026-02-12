import DailyStatisticsView from '@/components/DailyStatisticsView';
import { PageContainer } from '@ant-design/pro-components';
import { App, Button, Card, Col, DatePicker, Divider, Input, InputNumber, Row, Space, Statistic, Table, Tabs, Tag } from 'antd';
import { SearchOutlined, SaveOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useModel } from '@umijs/max';
import { getStatisticsByMonth, getRevenueMatrix } from '@/services/monthlyStatistics';
import { getPaymentBalanceByMonth, savePaymentBalance, previewPaymentBalance, type PaymentBalanceSnapshotData } from '@/services/paymentBalance';
import * as ExcelJSLib from 'exceljs';

export default function MonthlyStatisticsPage() {
  const { message: messageApi } = App.useApp();
  const { initialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser;
  const isExportAdmin = currentUser?.role === 'export_admin';

  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs());
  const [statisticsLoading, setStatisticsLoading] = useState(false);
  const [statisticsData, setStatisticsData] = useState<API.MonthlyStatisticsData | null>(null);
  const [revenueMatrixLoading, setRevenueMatrixLoading] = useState(false);
  const [revenueMatrixData, setRevenueMatrixData] = useState<API.RevenueMatrixData | null>(null);
  const [revenueSearchKeyword, setRevenueSearchKeyword] = useState<string>('');

  // 收付平衡相关状态
  const [paymentBalanceLoading, setPaymentBalanceLoading] = useState(false);
  const [paymentBalanceData, setPaymentBalanceData] = useState<PaymentBalanceSnapshotData | null>(null);
  const [managerSalary, setManagerSalary] = useState<number>(0);
  const [manualAverageIncome, setManualAverageIncome] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  // 保存原始值，用于重置
  const [originalManagerSalary, setOriginalManagerSalary] = useState<number>(0);
  const [originalManualAverageIncome, setOriginalManualAverageIncome] = useState<number | null>(null);
  // 记录上次预览时的管理员工资，用于判断是否需要调用后端
  const [lastPreviewManagerSalary, setLastPreviewManagerSalary] = useState<number>(0);

  // 金额格式化：整数不显示小数，小数保留1位
  const formatAmount = (amount: number): string => {
    if (isNaN(amount) || !isFinite(amount)) return '0';
    const truncated = Math.floor(amount * 10) / 10;
    return truncated % 1 === 0 ? truncated.toString() : truncated.toFixed(1);
  };

  /** 从 exceljs 取 Workbook（兼容命名导出与 default 导出，避免 MF/Webpack 下 "is not a constructor"） */
  const getExcelJSWorkbook = (): typeof ExcelJSLib.Workbook | null => {
    const W = (ExcelJSLib as any).Workbook ?? (ExcelJSLib as any).default?.Workbook ?? (ExcelJSLib as any).default;
    return typeof W === 'function' ? W : null;
  };

  /** 导出收付平衡表 */
  const handleExportPaymentBalance = async () => {
    if (!paymentBalanceData) {
      messageApi.warning('暂无收付平衡数据可导出');
      return;
    }

    const WorkbookClass = getExcelJSWorkbook();
    if (!WorkbookClass) {
      messageApi.error('导出库加载失败，请刷新后重试');
      return;
    }

    try {
      const wb = new WorkbookClass();
      const sheet = wb.addWorksheet('收付平衡表', { views: [{ rightToLeft: false }] });

      const year = selectedMonth.year();
      const month = selectedMonth.month() + 1;
      const monthName = selectedMonth.format('M');
      const startDate = selectedMonth.startOf('month');
      const endDate = selectedMonth.endOf('month');
      const dateRange = `${year}年 ${month}月${startDate.date()} 日至${month}月${endDate.date()}日`;

      // 计算修正后的平均收入
      const correctedAverageIncome = manualAverageIncome ?? paymentBalanceData.auto_average_income;
      const averageIncomeText = `平均收入数${formatAmount(correctedAverageIncome)}元`;

      // 重新计算修正后的收付款
      const vehicleDetailsWithCorrected = paymentBalanceData.vehicle_details.map((v) => {
        const paymentAmount = correctedAverageIncome - v.net_income;
        const paymentDueCorrected = paymentAmount < 0 ? Math.abs(paymentAmount) : 0;
        const paymentReceivableCorrected = paymentAmount > 0 ? paymentAmount : 0;

        return {
          ...v,
          payment_due_corrected: Math.floor(paymentDueCorrected * 10) / 10,
          payment_receivable_corrected: Math.floor(paymentReceivableCorrected * 10) / 10,
        };
      });

      // 计算合计
      const totalRevenue = vehicleDetailsWithCorrected.reduce((sum, v) => sum + v.revenue, 0);
      const totalTurnCount = vehicleDetailsWithCorrected.reduce((sum, v) => sum + v.turn_count, 0);
      const totalFuelSubsidy = vehicleDetailsWithCorrected.reduce((sum, v) => sum + v.fuel_subsidy, 0);
      const totalRewardPenalty = vehicleDetailsWithCorrected.reduce((sum, v) => sum + v.reward_penalty, 0);
      const totalPayable = vehicleDetailsWithCorrected.reduce((sum, v) => sum + v.payment_due_corrected, 0);
      const totalReceivable = vehicleDetailsWithCorrected.reduce((sum, v) => sum + v.payment_receivable_corrected, 0);

      // 样式定义
      const alignCenter = { horizontal: 'center' as const, vertical: 'middle' as const };
      const borderStyle = {
        top: { style: 'thin' as const },
        bottom: { style: 'thin' as const },
        left: { style: 'thin' as const },
        right: { style: 'thin' as const },
      };

      // 标题行
      const titleRow = sheet.addRow([`${monthName} 月车辆收付平衡表`]);
      titleRow.height = 30;
      sheet.mergeCells(1, 1, 1, 10);
      const titleCell = sheet.getCell(1, 1);
      titleCell.font = { bold: true, size: 16 };
      titleCell.alignment = alignCenter;

      // 表头第一行：日期范围和平均收入数
      const headerRow1 = sheet.addRow([]);
      headerRow1.height = 25;
      // 日期范围（合并前3列：序号、车号、营运总收入）
      sheet.mergeCells(2, 1, 2, 3);
      const dateRangeCell = sheet.getCell(2, 1);
      dateRangeCell.value = dateRange;
      dateRangeCell.alignment = alignCenter;
      dateRangeCell.font = { size: 12 }; // 字体大一号
      dateRangeCell.border = borderStyle;
      // 平均收入数（合并第6-7列：奖罚、服务员）
      sheet.mergeCells(2, 6, 2, 7);
      const avgIncomeCell = sheet.getCell(2, 6);
      avgIncomeCell.value = averageIncomeText;
      avgIncomeCell.alignment = alignCenter;
      avgIncomeCell.font = { size: 12 }; // 字体大一号
      avgIncomeCell.border = borderStyle;
      // 其他列也需要边框
      for (let col = 4; col <= 10; col++) {
        if (col !== 6 && col !== 7) {
          const cell = sheet.getCell(2, col);
          cell.border = borderStyle;
        }
      }

      // 表头第二行：列标题
      const headerRow2 = sheet.addRow([
        '序号',
        '车号',
        '营运总收入',
        '转数',
        '补油款',
        '奖罚',
        '服务员',
        '应付款',
        '应收款',
        '签名',
      ]);
      headerRow2.height = 25;
      headerRow2.eachCell((cell) => {
        cell.font = { bold: true };
        cell.alignment = alignCenter;
        cell.border = borderStyle;
      });

      // 数据行
      vehicleDetailsWithCorrected.forEach((vehicle, index) => {
        const dataRow = sheet.addRow([
          index + 1, // 序号
          vehicle.vehicle_id, // 车号
          vehicle.revenue > 0 ? vehicle.revenue : '', // 营运总收入
          vehicle.turn_count > 0 ? vehicle.turn_count : '', // 转数
          vehicle.fuel_subsidy > 0 ? vehicle.fuel_subsidy : '', // 补油款
          vehicle.reward_penalty !== 0 ? vehicle.reward_penalty : '', // 奖罚
          vehicle.conductor_id || '', // 服务员
          vehicle.payment_due_corrected > 0 ? vehicle.payment_due_corrected : '', // 应付款
          vehicle.payment_receivable_corrected > 0 ? vehicle.payment_receivable_corrected : '', // 应收款
          '', // 签名
        ]);
        dataRow.height = 22;
        dataRow.eachCell((cell) => {
          cell.border = borderStyle;
          // 所有数据都居中显示
          cell.alignment = alignCenter;
        });
      });

      // 计算行号：标题(1) + 表头第一行(2) + 表头第二行(3) + 数据行(4开始)
      const dataStartRow = 4;
      const salaryRowNum = dataStartRow + vehicleDetailsWithCorrected.length;
      const totalRowNum = salaryRowNum + 1;
      const dateRowNum = totalRowNum + 1;

      // 工资复印行（合计行前）
      const salaryRow = sheet.addRow([]);
      salaryRow.height = 22;
      // 合并"奖罚"、"服务员"、"应付款"列（第6-8列）
      sheet.mergeCells(salaryRowNum, 6, salaryRowNum, 8);
      const salaryMergedCell = sheet.getCell(salaryRowNum, 6);
      // 合并单元格的值设置为"工资复印"和工资值，居中
      salaryMergedCell.value = `工资复印 ${paymentBalanceData.manager_salary}`;
      salaryMergedCell.alignment = alignCenter;
      salaryMergedCell.border = borderStyle;
      // 其他列也需要边框
      for (let col = 1; col <= 10; col++) {
        if (col < 6 || col === 9 || col === 10) {
          const cell = sheet.getCell(salaryRowNum, col);
          cell.border = borderStyle;
        }
      }

      // 合计行
      const totalRow = sheet.addRow([
        '合计',
        '',
        totalRevenue > 0 ? totalRevenue : 0,
        totalTurnCount > 0 ? totalTurnCount : 0,
        totalFuelSubsidy > 0 ? totalFuelSubsidy : 0,
        totalRewardPenalty !== 0 ? totalRewardPenalty : 0,
        '',
        totalPayable > 0 ? totalPayable : 0,
        totalReceivable > 0 ? totalReceivable : 0,
        '',
      ]);
      totalRow.height = 22;
      totalRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.border = borderStyle;
        // 合计行也居中显示
        cell.alignment = alignCenter;
      });

      // 制表日期行
      const dateRow = sheet.addRow([]);
      dateRow.height = 25;
      sheet.mergeCells(dateRowNum, 1, dateRowNum, 10);
      const dateCell = sheet.getCell(dateRowNum, 1);
      dateCell.value = `制表日期 ${dayjs().format('YYYY年 M月D日')}`;
      dateCell.alignment = alignCenter;

      // 设置列宽（稍微压缩）
      sheet.getColumn(1).width = 8; // 序号
      sheet.getColumn(2).width = 10; // 车号
      sheet.getColumn(3).width = 12; // 营运总收入
      sheet.getColumn(4).width = 8; // 转数
      sheet.getColumn(5).width = 10; // 补油款
      sheet.getColumn(6).width = 10; // 奖罚
      sheet.getColumn(7).width = 10; // 服务员
      sheet.getColumn(8).width = 10; // 应付款
      sheet.getColumn(9).width = 10; // 应收款
      sheet.getColumn(10).width = 12; // 签名

      // 生成文件并下载
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${year}年${month}月车辆收付平衡表.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      messageApi.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      messageApi.error('导出失败，请重试');
    }
  };

  // 加载指定月份的统计数据
  const loadStatisticsData = async (month: Dayjs) => {
    setStatisticsLoading(true);
    try {
      const year = month.year();
      const monthNum = month.month() + 1; // dayjs的month()返回0-11，需要+1
      const result = await getStatisticsByMonth(year, monthNum);
      // 响应拦截器已经提取了 data 字段，result 就是 MonthlyStatisticsData
      // 确保金额字段是数字类型（后端 decimal 可能在 JSON 中变成字符串）
      if (result && result.statistics) {
        result.statistics.total_revenue = Number(result.statistics.total_revenue) || 0;
        result.statistics.total_net_income = Number(result.statistics.total_net_income) || 0;
        result.statistics.average_revenue = Number(result.statistics.average_revenue) || 0;
        result.statistics.average_net_income = Number(result.statistics.average_net_income) || 0;
        result.statistics.vehicle_count = Number(result.statistics.vehicle_count) || 0;
        result.statistics.total_vehicle_count = Number(result.statistics.total_vehicle_count) || 0;
        result.statistics.income_record_count = Number(result.statistics.income_record_count) || 0;
        result.statistics.total_rest_count = Number(result.statistics.total_rest_count) || 0;
        result.statistics.total_overtime_count = Number(result.statistics.total_overtime_count) || 0;
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

  // 加载营收矩阵数据
  const loadRevenueMatrixData = async (month: Dayjs) => {
    setRevenueMatrixLoading(true);
    try {
      const year = month.year();
      const monthNum = month.month() + 1;
      const result = await getRevenueMatrix(year, monthNum);
      setRevenueMatrixData(result);
    } catch (error: any) {
      if (error?.response?.status === 403) return;
      messageApi.error(error?.message || '加载营收矩阵数据失败');
      setRevenueMatrixData(null);
    } finally {
      setRevenueMatrixLoading(false);
    }
  };

  // 加载收付平衡数据
  const loadPaymentBalanceData = async (month: Dayjs) => {
    setPaymentBalanceLoading(true);
    try {
      const year = month.year();
      const monthNum = month.month() + 1;
      const result = await getPaymentBalanceByMonth(year, monthNum);
      if (result) {
        setPaymentBalanceData(result);
        setManagerSalary(result.manager_salary);
        setManualAverageIncome(result.manual_average_income);
        // 保存原始值
        setOriginalManagerSalary(result.manager_salary);
        setOriginalManualAverageIncome(result.manual_average_income);
        // 记录当前管理员工资，用于预览判断
        setLastPreviewManagerSalary(result.manager_salary);
      } else {
        setPaymentBalanceData(null);
        setManagerSalary(0);
        setManualAverageIncome(null);
        setOriginalManagerSalary(0);
        setOriginalManualAverageIncome(null);
        setLastPreviewManagerSalary(0);
      }
    } catch (error: any) {
      // 403错误静默处理（导出管理员无权限访问）
      if (error?.response?.status === 403 || error?.code === 403) {
        setPaymentBalanceData(null);
        return;
      }
      messageApi.error(error?.message || '加载收付平衡数据失败');
      setPaymentBalanceData(null);
    } finally {
      setPaymentBalanceLoading(false);
    }
  };

  // 重置收付平衡数据
  const handleResetPaymentBalance = async () => {
    // 恢复到原始值
    setManagerSalary(originalManagerSalary);
    setManualAverageIncome(originalManualAverageIncome);
    // 重新加载原始数据
    await loadPaymentBalanceData(selectedMonth);
  };

  // 预览收付平衡数据
  const handlePreviewPaymentBalance = async () => {
    if (!paymentBalanceData) return;

    // 如果只修改了手动修正平均收入（管理员工资没变），直接在前端计算，不需要调用后端
    if (managerSalary === lastPreviewManagerSalary) {
      // 只更新收付款，自动平均收入不变
      const correctedAverageIncome = manualAverageIncome ?? paymentBalanceData.auto_average_income;
      const updatedVehicleDetails = paymentBalanceData.vehicle_details.map((v) => {
        const paymentAmount = correctedAverageIncome - v.net_income;
        const paymentDueCorrected = paymentAmount < 0 ? Math.abs(paymentAmount) : 0;
        const paymentReceivableCorrected = paymentAmount > 0 ? paymentAmount : 0;

        return {
          ...v,
          payment_due_corrected: Math.floor(paymentDueCorrected * 10) / 10,
          payment_receivable_corrected: Math.floor(paymentReceivableCorrected * 10) / 10,
        };
      });

      setPaymentBalanceData({
        ...paymentBalanceData,
        vehicle_details: updatedVehicleDetails,
      });
      return;
    }

    // 如果修改了管理员工资，需要调用后端重新计算自动平均收入
    setPreviewing(true);
    try {
      const year = selectedMonth.year();
      const monthNum = selectedMonth.month() + 1;

      const previewData = await previewPaymentBalance({
        year,
        month: monthNum,
        manager_salary: managerSalary,
        manual_average_income: manualAverageIncome,
      });

      // 更新预览数据
      setPaymentBalanceData({
        ...paymentBalanceData,
        auto_average_income: previewData.auto_average_income,
        vehicle_details: previewData.vehicle_details,
      });
      
      // 记录当前管理员工资
      setLastPreviewManagerSalary(managerSalary);
    } catch (error: any) {
      if (error?.response?.status === 403) return;
      messageApi.error(error?.message || '预览失败');
    } finally {
      setPreviewing(false);
    }
  };

  // 保存收付平衡数据
  const handleSavePaymentBalance = async () => {
    if (!paymentBalanceData) return;

    setSaving(true);
    try {
      const year = selectedMonth.year();
      const monthNum = selectedMonth.month() + 1;

      // 重新计算修正后的收付款（使用修正后的平均收入）
      const correctedAverageIncome = manualAverageIncome ?? paymentBalanceData.auto_average_income;
      const updatedVehicleDetails = paymentBalanceData.vehicle_details.map((v) => {
        const paymentAmount = correctedAverageIncome - v.net_income;
        const paymentDueCorrected = paymentAmount < 0 ? Math.abs(paymentAmount) : 0;
        const paymentReceivableCorrected = paymentAmount > 0 ? paymentAmount : 0;

        return {
          ...v,
          payment_due_corrected: Math.floor(paymentDueCorrected * 10) / 10,
          payment_receivable_corrected: Math.floor(paymentReceivableCorrected * 10) / 10,
        };
      });

      await savePaymentBalance({
        year,
        month: monthNum,
        auto_average_income: paymentBalanceData.auto_average_income,
        manual_average_income: manualAverageIncome,
        manager_salary: managerSalary,
        vehicle_details: updatedVehicleDetails,
      });

      messageApi.success('保存成功');
      // 重新加载数据
      await loadPaymentBalanceData(selectedMonth);
    } catch (error: any) {
      if (error?.response?.status === 403) return;
      messageApi.error(error?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 月份变化时重新加载
  useEffect(() => {
    loadStatisticsData(selectedMonth);
    loadRevenueMatrixData(selectedMonth);
    loadPaymentBalanceData(selectedMonth);
  }, [selectedMonth]);

  // 禁用未来月份
  const disabledDate = (current: Dayjs | null) => {
    if (!current) return false;
    const today = dayjs().startOf('month');
    return current.isAfter(today, 'month');
  };

  const handleMonthChange = (date: Dayjs | null) => {
    if (!date) return;
    if (date.isAfter(dayjs(), 'month')) {
      messageApi.warning('不能选择未来月份');
      return;
    }
    setSelectedMonth(date);
  };

  // 计算总览数据（月统计逻辑：移除营运/休息概念，使用有收入/总车辆等）
  const overviewData = useMemo(() => {
    if (!statisticsData?.vehicles) {
      return null;
    }

    const vehicles = statisticsData.vehicles;
    const vehiclesWithIncome = vehicles.filter((v) => v.has_income); // 有收入的车辆
    const vehiclesWithRevenue = vehicles.filter((v) => v.has_income && v.revenue > 0);
    const vehiclesWithNetIncome = vehicles.filter((v) => v.has_income && v.net_income > 0);
    const vehiclesWithTurns = vehicles.filter((v) => v.has_income && v.turn_count > 0);
    const totalVehicleCount = statisticsData.statistics?.total_vehicle_count || vehicles.length;
    const incomeRecordCount = statisticsData.statistics?.income_record_count || 0; // 入账记录数
    const totalRestCount = statisticsData.statistics?.total_rest_count || 0; // 总休息车次
    const totalOvertimeCount = statisticsData.statistics?.total_overtime_count || 0; // 总加班车次
    const overtimeVehicles = statisticsData.overtime_vehicles || []; // 具体加班的车辆列表

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
    let maxSingleTurnVehicle: typeof vehiclesWithTurns[0] | null = vehiclesWithTurns[0] || null;
    let maxSingleTurnValue = 0;
    let minSingleTurnVehicle: typeof vehiclesWithTurns[0] | null = vehiclesWithTurns[0] || null;
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

    // 营业额排行：先列出有收入的车辆，然后列出未入账的车辆
    const revenueRankingWithIncome = [...vehiclesWithRevenue]
      .sort((a, b) => b.revenue - a.revenue)
      .map((v, index) => ({ ...v, rank: index + 1 }));

    const noIncomeVehicles = vehicles
      .filter((v) => !v.has_income)
      .filter((v) => !revenueRankingWithIncome.some((r) => r.vehicle_id === v.vehicle_id))
      .map((v, index) => ({ ...v, rank: revenueRankingWithIncome.length + index + 1 }));

    const revenueRanking = [...revenueRankingWithIncome, ...noIncomeVehicles];

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
    const singleTurnRanking = [
      ...top20.map((item, index) => ({ ...item, rank: index + 1 })),
      ...(hasEllipsis ? [{ isEllipsis: true, rank: 21 }] : []),
      ...bottom3.map((item, index) => ({
        ...item,
        rank: singleTurnRankingRaw.length - 2 + index,
      })),
    ];

    // 平均每转收入排行：先列出有转数的车辆，然后列出未入账的车辆
    const avgTurnRankingWithTurns = [...vehiclesWithTurns]
      .map((v) => ({ ...v, avgTurnRevenue: v.revenue / v.turn_count }))
      .sort((a, b) => b.avgTurnRevenue - a.avgTurnRevenue)
      .map((v, index) => ({ ...v, rank: index + 1 }));

    // 平均每转收入最低（从有转数的车辆中找）
    const minAvgTurnVehicle = avgTurnRankingWithTurns.length > 0 ? avgTurnRankingWithTurns[avgTurnRankingWithTurns.length - 1] : null;

    const noTurnsVehicles = vehicles
      .filter((v) => !v.has_income || v.turn_count === 0)
      .filter((v) => !avgTurnRankingWithTurns.some((r) => r.vehicle_id === v.vehicle_id))
      .map((v, index) => ({ ...v, avgTurnRevenue: 0, rank: avgTurnRankingWithTurns.length + index + 1 }));

    const avgTurnRanking = [...avgTurnRankingWithTurns, ...noTurnsVehicles];

    // 奖罚排行使用后端返回的数据（已按单次列出并排序）
    const rewardPenaltyRanking = statisticsData.reward_penalty_ranking || [];

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
      totalVehicleCount,
      incomeCount: vehiclesWithIncome.length,
      incomeRecordCount,
      totalRestCount,
      totalOvertimeCount,
      overtimeVehicles,
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
          {/* 月份选择 */}
          <Space>
            <span>选择月份：</span>
            <DatePicker
              picker="month"
              value={selectedMonth}
              onChange={handleMonthChange}
              disabledDate={disabledDate}
              format="YYYY-MM"
              placeholder="选择统计月份"
              presets={[
                {
                  label: '本月',
                  value: dayjs().startOf('month'),
                },
              ]}
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
                    <Card title={`基础数据（${selectedMonth.format('YYYY-MM')}）`}>
                      <Row gutter={[8, 16]}>
                        <Col span={5}>
                          <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            <Statistic title="总车辆数" value={overviewData.totalVehicleCount} suffix="辆" />
                            <div style={{ fontSize: '14px', color: '#666' }}>
                              入账记录数：<span style={{ fontWeight: 500 }}>{overviewData.incomeRecordCount}</span> 条
                            </div>
                            <div style={{ fontSize: '14px', color: '#666' }}>
                              总休息车次：<span style={{ fontWeight: 500 }}>{overviewData.totalRestCount}</span> 次
                            </div>
                          </Space>
                        </Col>
                        <Col span={5}>
                          <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            <Statistic title="加班车次" value={overviewData.totalOvertimeCount} suffix="次" />
                            {overviewData.overtimeVehicles.length > 0 && (
                              <div style={{ marginTop: 8 }}>
                                <div style={{ fontSize: '12px', color: '#666', marginBottom: 4 }}>加班车辆：</div>
                                <Space size={[4, 4]} wrap>
                                  {overviewData.overtimeVehicles.map((item) => (
                                    <Tag key={item.vehicle_id} color="orange">
                                      {item.vehicle_id} ({item.dates.length}天)
                                    </Tag>
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
                                      <Tag color="orange">加班</Tag>
                                    ) : (
                                      record.is_rest && <Tag color="warning">休息</Tag>
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
                                        {record.is_overtime && <Tag color="orange">加班</Tag>}
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
                                record.isEllipsis ? 'ellipsis' : `${record.vehicle_id}-${record.turnNumber}`
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
                                      <Tag color="orange">加班</Tag>
                                    ) : (
                                      record.is_rest && <Tag color="warning">休息</Tag>
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
                                  render: (rank: number, record: any) => {
                                    if (record.isEllipsis) {
                                      return <span style={{ color: '#999' }}>...</span>;
                                    }
                                    return <Tag color={rank <= 3 ? 'gold' : 'default'}>{rank}</Tag>;
                                  },
                                },
                                {
                                  title: '日期',
                                  dataIndex: 'date',
                                  width: 90,
                                  render: (v: string, record: any) => {
                                    if (record.isEllipsis) return null;
                                    return v ? dayjs(v).format('MM-DD') : '-';
                                  },
                                },
                                {
                                  title: '车辆',
                                  dataIndex: 'vehicle_id',
                                  width: 100,
                                  render: (value: string, record: any) => {
                                    if (record.isEllipsis) return null;
                                    return (
                                      <Space size="small">
                                        <span>{value}</span>
                                        {record.is_overtime && <Tag color="orange">加班</Tag>}
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
                                  title: '奖罚',
                                  dataIndex: 'reward_penalty',
                                  render: (v: number, record: any) => {
                                    if (record.isEllipsis) return null;
                                    const color = v > 0 ? '#52c41a' : '#ff4d4f';
                                    return (
                                      <span style={{ color, fontWeight: v !== 0 ? 'bold' : 'normal' }}>
                                        {v > 0 ? '+' : ''}{formatAmount(v)} 元
                                      </span>
                                    );
                                  },
                                },
                              ]}
                              rowKey={(record: any) =>
                                record.isEllipsis ? 'ellipsis' : `${record.date}-${record.vehicle_id}`
                              }
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
                    exportDate={selectedMonth.format('YYYY-MM')}
                    formatAmount={formatAmount}
                  />
                ),
              },
              {
                key: 'payment-balance',
                label: '收付平衡',
                children: (
                  <Card loading={paymentBalanceLoading}>
                    {paymentBalanceData ? (
                      (() => {
                        // 计算修正后的平均收入
                        const correctedAverageIncome = manualAverageIncome ?? paymentBalanceData.auto_average_income;

                        // 重新计算修正后的收付款
                        const vehicleDetailsWithCorrected = paymentBalanceData.vehicle_details.map((v) => {
                          const paymentAmount = correctedAverageIncome - v.net_income;
                          const paymentDueCorrected = paymentAmount < 0 ? Math.abs(paymentAmount) : 0;
                          const paymentReceivableCorrected = paymentAmount > 0 ? paymentAmount : 0;

                          return {
                            ...v,
                            payment_due_corrected: Math.floor(paymentDueCorrected * 10) / 10,
                            payment_receivable_corrected: Math.floor(paymentReceivableCorrected * 10) / 10,
                          };
                        });

                        // 计算汇总数据（使用修正后的值）
                        const receivableTotal = vehicleDetailsWithCorrected.reduce(
                          (sum, v) => sum + v.payment_receivable_corrected,
                          0
                        );
                        const payableTotal = vehicleDetailsWithCorrected.reduce(
                          (sum, v) => sum + v.payment_due_corrected,
                          0
                        );
                        // 收付平衡 = 应收总额 - 应付总额
                        // 正值：应收 > 应付，剩余的是应收金额
                        // 负值：应付 > 应收，多余的是应付金额
                        const paymentBalance = receivableTotal - payableTotal;
                        // 平衡标签评判标准：0为平衡，[-100, 0)为基本平衡，其他为不平衡
                        let balanceStatus: 'balanced' | 'basically_balanced' | 'unbalanced';
                        if (Math.abs(paymentBalance) < 0.1) {
                          balanceStatus = 'balanced';
                        } else if (paymentBalance >= -100 && paymentBalance < 0) {
                          balanceStatus = 'basically_balanced';
                        } else {
                          balanceStatus = 'unbalanced';
                        }

                        // 合计行数据
                        const totalRow = {
                          vehicle_id: '合计',
                          revenue: vehicleDetailsWithCorrected.reduce((sum, v) => sum + v.revenue, 0),
                          turn_count: vehicleDetailsWithCorrected.reduce((sum, v) => sum + v.turn_count, 0),
                          fuel_subsidy: vehicleDetailsWithCorrected.reduce((sum, v) => sum + v.fuel_subsidy, 0),
                          reward_penalty: vehicleDetailsWithCorrected.reduce((sum, v) => sum + v.reward_penalty, 0),
                          payment_due_auto: vehicleDetailsWithCorrected.reduce((sum, v) => sum + v.payment_due_auto, 0),
                          payment_receivable_auto: vehicleDetailsWithCorrected.reduce(
                            (sum, v) => sum + v.payment_receivable_auto,
                            0
                          ),
                          payment_due_corrected: payableTotal,
                          payment_receivable_corrected: receivableTotal,
                        };

                        return (
                          <Space direction="vertical" style={{ width: '100%' }} size="large">
                            {/* 统计信息 */}
                            <Row gutter={[16, 16]}>
                              <Col span={6}>
                                <Statistic
                                  title="数据日期范围"
                                  value={selectedMonth.format('YYYY年MM月')}
                                />
                              </Col>
                              <Col span={6}>
                                <Statistic
                                  title="应付总额"
                                  value={formatAmount(payableTotal)}
                                  suffix="元"
                                  valueStyle={{ color: '#52c41a' }}
                                />
                              </Col>
                              <Col span={6}>
                                <Statistic
                                  title="应收总额"
                                  value={formatAmount(receivableTotal)}
                                  suffix="元"
                                  valueStyle={{ color: '#ff4d4f' }}
                                />
                              </Col>
                              <Col span={6}>
                                <div style={{ paddingTop: 4 }}>
                                  <div style={{ fontSize: '14px', color: 'rgba(0, 0, 0, 0.45)', marginBottom: 4 }}>
                                    收付平衡
                                  </div>
                                  <div>
                                    <Statistic
                                      value={Math.abs(paymentBalance)}
                                      prefix={paymentBalance >= 0 ? '+' : '-'}
                                      suffix="元"
                                      valueStyle={{
                                        color: balanceStatus === 'balanced' ? '#52c41a' : balanceStatus === 'basically_balanced' ? '#faad14' : paymentBalance > 0 ? '#ff4d4f' : '#52c41a',
                                        fontSize: '20px',
                                      }}
                                      formatter={(value) => formatAmount(value as number)}
                                    />
                                    <div style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.45)', marginTop: 4 }}>
                                      {paymentBalance < 0 ? `管理员小赚${formatAmount(Math.abs(paymentBalance))}元` : paymentBalance > 0 ? `管理员血亏${formatAmount(paymentBalance)}元` : '已平衡'}
                                    </div>
                                    <Tag 
                                      color={balanceStatus === 'balanced' ? 'success' : balanceStatus === 'basically_balanced' ? 'warning' : 'error'} 
                                      style={{ marginTop: 4 }}
                                    >
                                      {balanceStatus === 'balanced' ? '平衡' : balanceStatus === 'basically_balanced' ? '基本平衡' : '不平衡'}
                                    </Tag>
                                  </div>
                                </div>
                              </Col>
                            </Row>

                            {/* 设置项 */}
                            {!isExportAdmin && (
                              <Card title="设置" size="small">
                                <Row gutter={[16, 16]}>
                                  <Col span={6}>
                                    <div>
                                      <div style={{ fontSize: '14px', color: 'rgba(0, 0, 0, 0.45)', marginBottom: 8 }}>
                                        自动平均收入
                                      </div>
                                      <Space.Compact style={{ display: 'flex', width: '100%' }}>
                                        <InputNumber
                                          value={paymentBalanceData.auto_average_income}
                                          disabled
                                          style={{ flex: 1 }}
                                          precision={1}
                                        />
                                        <span
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: 40,
                                            height: 32,
                                            backgroundColor: '#fafafa',
                                            border: '1px solid #d9d9d9',
                                            borderLeft: 'none',
                                            borderRadius: '0 6px 6px 0',
                                            color: 'rgba(0, 0, 0, 0.65)',
                                            fontSize: '14px',
                                          }}
                                        >
                                          元
                                        </span>
                                      </Space.Compact>
                                    </div>
                                  </Col>
                                  <Col span={6}>
                                    <div>
                                      <div style={{ fontSize: '14px', color: 'rgba(0, 0, 0, 0.45)', marginBottom: 8 }}>
                                        手动修正平均收入
                                      </div>
                                      <Space.Compact style={{ display: 'flex', width: '100%' }}>
                                      <InputNumber
                                        value={manualAverageIncome ?? undefined}
                                        onChange={(value) => {
                                          // 确保 null/undefined 时设置为 null，而不是 0
                                          setManualAverageIncome(value === null || value === undefined ? null : value);
                                        }}
                                        onBlur={handlePreviewPaymentBalance}
                                        style={{ flex: 1 }}
                                        precision={1}
                                        placeholder="留空则使用自动值"
                                        disabled={previewing}
                                      />
                                        <span
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: 40,
                                            height: 32,
                                            backgroundColor: '#fafafa',
                                            border: '1px solid #d9d9d9',
                                            borderLeft: 'none',
                                            borderRadius: '0 6px 6px 0',
                                            color: 'rgba(0, 0, 0, 0.65)',
                                            fontSize: '14px',
                                          }}
                                        >
                                          元
                                        </span>
                                      </Space.Compact>
                                    </div>
                                  </Col>
                                  <Col span={6}>
                                    <div>
                                      <div style={{ fontSize: '14px', color: 'rgba(0, 0, 0, 0.45)', marginBottom: 8 }}>
                                        管理员工资
                                      </div>
                                      <Space.Compact style={{ display: 'flex', width: '100%' }}>
                                      <InputNumber
                                        value={managerSalary}
                                        onChange={(value) => setManagerSalary(value ?? 0)}
                                        onBlur={handlePreviewPaymentBalance}
                                        style={{ flex: 1 }}
                                        precision={1}
                                        min={0}
                                        disabled={previewing}
                                      />
                                        <span
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: 40,
                                            height: 32,
                                            backgroundColor: '#fafafa',
                                            border: '1px solid #d9d9d9',
                                            borderLeft: 'none',
                                            borderRadius: '0 6px 6px 0',
                                            color: 'rgba(0, 0, 0, 0.65)',
                                            fontSize: '14px',
                                          }}
                                        >
                                          元
                                        </span>
                                      </Space.Compact>
                                    </div>
                                  </Col>
                                </Row>
                                <div style={{ marginTop: 16 }}>
                                  <Space>
                                    <Button
                                      type="primary"
                                      icon={<SaveOutlined />}
                                      loading={saving}
                                      onClick={handleSavePaymentBalance}
                                    >
                                      确定
                                    </Button>
                                    <Button
                                      icon={<ReloadOutlined />}
                                      onClick={handleResetPaymentBalance}
                                      disabled={previewing || saving}
                                    >
                                      重置
                                    </Button>
                                  </Space>
                                </div>
                              </Card>
                            )}

                            {/* 收付平衡明细表格 */}
                            <Card
                              title="收付平衡明细"
                              size="small"
                              extra={
                                <Space>
                                  {!paymentBalanceData.is_saved && !isExportAdmin && (
                                    <span style={{ color: '#ff4d4f', fontSize: '12px' }}>
                                      等待管理员确认数据后才可导出
                                    </span>
                                  )}
                                  <Button
                                    type="primary"
                                    size="small"
                                    icon={<DownloadOutlined />}
                                    disabled={!paymentBalanceData.is_saved}
                                    onClick={handleExportPaymentBalance}
                                    title={
                                      paymentBalanceData.is_saved
                                        ? '导出数据'
                                        : '请先保存数据后再导出'
                                    }
                                  >
                                    导出
                                  </Button>
                                </Space>
                              }
                            >
                              <Table
                                size="small"
                                dataSource={[
                                  ...vehicleDetailsWithCorrected.map((v, index) => ({
                                    ...v,
                                    sequence: index + 1,
                                  })),
                                  { ...totalRow, sequence: 0 },
                                ]}
                                pagination={false}
                                scroll={{ x: 1400 }}
                                columns={[
                                  {
                                    title: '序号',
                                    dataIndex: 'sequence',
                                    width: 60,
                                    render: (seq: number, record: any) => {
                                      if (record.vehicle_id === '合计') {
                                        return <strong>合计</strong>;
                                      }
                                      return seq;
                                    },
                                  },
                                  {
                                    title: '车号',
                                    dataIndex: 'vehicle_id',
                                    width: 100,
                                    render: (value: string) => (
                                      <span style={{ fontWeight: value === '合计' ? 'bold' : 'normal' }}>
                                        {value}
                                      </span>
                                    ),
                                  },
                                  {
                                    title: '营业额',
                                    dataIndex: 'revenue',
                                    width: 100,
                                    render: (v: number, record: any) => {
                                      if (record.vehicle_id === '合计') {
                                        return <strong>{formatAmount(v)} 元</strong>;
                                      }
                                      return v > 0 ? formatAmount(v) + ' 元' : '-';
                                    },
                                  },
                                  {
                                    title: '转数',
                                    dataIndex: 'turn_count',
                                    width: 80,
                                    render: (v: number, record: any) => {
                                      if (record.vehicle_id === '合计') {
                                        return <strong>{v}</strong>;
                                      }
                                      return v > 0 ? v : '-';
                                    },
                                  },
                                  {
                                    title: '补油款',
                                    dataIndex: 'fuel_subsidy',
                                    width: 100,
                                    render: (v: number, record: any) => {
                                      if (record.vehicle_id === '合计') {
                                        return <strong>{formatAmount(v)} 元</strong>;
                                      }
                                      return v !== 0 ? formatAmount(v) + ' 元' : '-';
                                    },
                                  },
                                  {
                                    title: '奖罚',
                                    dataIndex: 'reward_penalty',
                                    width: 100,
                                    render: (v: number, record: any) => {
                                      if (record.vehicle_id === '合计') {
                                        return <strong>{formatAmount(v)} 元</strong>;
                                      }
                                      if (v === 0) return '-';
                                      const color = v > 0 ? '#52c41a' : '#ff4d4f';
                                      return (
                                        <span style={{ color }}>
                                          {v > 0 ? '+' : ''}
                                          {formatAmount(v)} 元
                                        </span>
                                      );
                                    },
                                  },
                                  {
                                    title: '服务员',
                                    dataIndex: 'conductor_id',
                                    width: 100,
                                    render: (v: string | null, record: any) => {
                                      if (record.vehicle_id === '合计') return null;
                                      return v || '-';
                                    },
                                  },
                                  {
                                    title: '应付款(自动)',
                                    dataIndex: 'payment_due_auto',
                                    width: 120,
                                    render: (v: number, record: any) => {
                                      if (record.vehicle_id === '合计') {
                                        return <strong>{formatAmount(v)} 元</strong>;
                                      }
                                      return v > 0 ? formatAmount(v) + ' 元' : '-';
                                    },
                                  },
                                  {
                                    title: '应收款(自动)',
                                    dataIndex: 'payment_receivable_auto',
                                    width: 120,
                                    render: (v: number, record: any) => {
                                      if (record.vehicle_id === '合计') {
                                        return <strong>{formatAmount(v)} 元</strong>;
                                      }
                                      return v > 0 ? formatAmount(v) + ' 元' : '-';
                                    },
                                  },
                                  {
                                    title: '应付款(修正)',
                                    dataIndex: 'payment_due_corrected',
                                    width: 120,
                                    render: (v: number, record: any) => {
                                      if (record.vehicle_id === '合计') {
                                        return <strong>{formatAmount(v)} 元</strong>;
                                      }
                                      return v > 0 ? formatAmount(v) + ' 元' : '-';
                                    },
                                  },
                                  {
                                    title: '应收款(修正)',
                                    dataIndex: 'payment_receivable_corrected',
                                    width: 120,
                                    render: (v: number, record: any) => {
                                      if (record.vehicle_id === '合计') {
                                        return <strong>{formatAmount(v)} 元</strong>;
                                      }
                                      return v > 0 ? formatAmount(v) + ' 元' : '-';
                                    },
                                  },
                                ]}
                                rowKey={(record: any) =>
                                  record.vehicle_id === '合计' ? 'total' : record.vehicle_id
                                }
                              />
                            </Card>
                          </Space>
                        );
                      })()
                    ) : (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无数据</div>
                    )}
                  </Card>
                ),
              },
              {
                key: 'revenue',
                label: '营收统计',
                children: (
                  <Card
                    loading={revenueMatrixLoading}
                    extra={
                      revenueMatrixData && (
                        <Input
                          placeholder="搜索车辆ID"
                          prefix={<SearchOutlined />}
                          value={revenueSearchKeyword}
                          onChange={(e) => setRevenueSearchKeyword(e.target.value)}
                          allowClear
                          style={{ width: 200 }}
                          size="small"
                        />
                      )
                    }
                  >
                    {revenueMatrixData ? (
                      (() => {
                        // 过滤车辆数据
                        const filteredVehicles = revenueSearchKeyword.trim()
                          ? revenueMatrixData.vehicles.filter((v) =>
                              v.vehicle_id.toLowerCase().includes(revenueSearchKeyword.trim().toLowerCase())
                            )
                          : revenueMatrixData.vehicles;

                        // 重新计算汇总行（基于过滤后的车辆）
                        let filteredDailyTotals: Record<number, number> = {};
                        let filteredGrandTotal = 0;

                        if (revenueSearchKeyword.trim() && filteredVehicles.length > 0) {
                          // 如果有搜索条件，只汇总过滤后的车辆
                          filteredDailyTotals = {};
                          for (let day = 1; day <= revenueMatrixData.days_in_month; day++) {
                            filteredDailyTotals[day] = filteredVehicles.reduce(
                              (sum, v) => sum + (v.daily_revenues[day] || 0),
                              0
                            );
                          }
                          filteredGrandTotal = filteredVehicles.reduce(
                            (sum, v) => sum + v.monthly_total,
                            0
                          );
                        } else {
                          // 没有搜索条件，使用原始汇总数据（创建副本）
                          filteredDailyTotals = { ...revenueMatrixData.daily_totals };
                          filteredGrandTotal = revenueMatrixData.grand_total;
                        }

                        return (
                          <>
                            {revenueSearchKeyword.trim() && (
                              <div style={{ marginBottom: 12, color: '#666', fontSize: '12px' }}>
                                共找到 {filteredVehicles.length} 辆车辆（共 {revenueMatrixData.vehicles.length} 辆）
                              </div>
                            )}
                            {filteredVehicles.length === 0 && revenueSearchKeyword.trim() ? (
                              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                                未找到匹配的车辆
                              </div>
                            ) : (
                              <Table
                                dataSource={[
                                  ...filteredVehicles.map((v) => ({
                                    key: v.vehicle_id,
                                    vehicle_id: v.vehicle_id,
                                    ...v.daily_revenues,
                                    monthly_total: v.monthly_total,
                                  })),
                                  {
                                    key: 'total',
                                    vehicle_id: '汇总',
                                    ...filteredDailyTotals,
                                    monthly_total: filteredGrandTotal,
                                  },
                                ]}
                        columns={[
                          {
                            title: '车辆',
                            dataIndex: 'vehicle_id',
                            width: 100,
                            fixed: 'left',
                            sorter: (a: any, b: any) => {
                              // 汇总行始终在最后
                              if (a.vehicle_id === '汇总') return 1;
                              if (b.vehicle_id === '汇总') return -1;
                              return a.vehicle_id.localeCompare(b.vehicle_id);
                            },
                            render: (value: string) => (
                              <span style={{ fontWeight: value === '汇总' ? 'bold' : 'normal' }}>{value}</span>
                            ),
                          },
                          ...Array.from({ length: revenueMatrixData.days_in_month }, (_, i) => i + 1).map((day) => ({
                            title: String(day),
                            dataIndex: String(day),
                            width: 80,
                            sorter: (a: any, b: any) => {
                              // 汇总行始终在最后
                              if (a.vehicle_id === '汇总') return 1;
                              if (b.vehicle_id === '汇总') return -1;
                              const aValue = a[String(day)] || 0;
                              const bValue = b[String(day)] || 0;
                              return aValue - bValue;
                            },
                            render: (value: number, record: any) => {
                              const isTotal = record.vehicle_id === '汇总';
                              if (value === 0 || value === undefined) return '';
                              return (
                                <span style={{ fontWeight: isTotal ? 'bold' : 'normal' }}>
                                  {formatAmount(value)}
                                </span>
                              );
                            },
                          })),
                          {
                            title: '汇总',
                            dataIndex: 'monthly_total',
                            width: 100,
                            fixed: 'right',
                            sorter: (a: any, b: any) => {
                              // 汇总行始终在最后
                              if (a.vehicle_id === '汇总') return 1;
                              if (b.vehicle_id === '汇总') return -1;
                              const aValue = a.monthly_total || 0;
                              const bValue = b.monthly_total || 0;
                              return aValue - bValue;
                            },
                            render: (value: number, record: any) => {
                              const isTotal = record.vehicle_id === '汇总';
                              if (value === 0 || value === undefined) return '';
                              return (
                                <span style={{ fontWeight: 'bold', color: isTotal ? '#1677ff' : undefined }}>
                                  {formatAmount(value)}
                                </span>
                              );
                            },
                          },
                        ]}
                                pagination={false}
                                scroll={{ x: Math.max(1200, revenueMatrixData.days_in_month * 80 + 200) }}
                                size="small"
                              />
                            )}
                          </>
                        );
                      })()
                    ) : (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无数据</div>
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
