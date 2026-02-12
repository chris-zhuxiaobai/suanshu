import { request } from '@umijs/max';

/**
 * 获取指定月份的统计数据
 */
export async function getStatisticsByMonth(year: number, month: number): Promise<API.MonthlyStatisticsData> {
  return request<API.MonthlyStatisticsData>(`/monthly-statistics/by-month/${year}/${month}`, {
    method: 'GET',
  });
}

/**
 * 获取指定车辆在指定月份的每日收入记录详情
 */
export async function getVehicleMonthlyDetail(
  vehicleId: string,
  year: number,
  month: number
): Promise<API.VehicleMonthlyDetailData> {
  return request<API.VehicleMonthlyDetailData>(`/monthly-statistics/vehicle/${vehicleId}/by-month/${year}/${month}`, {
    method: 'GET',
  });
}

/**
 * 获取指定月份所有车辆的每日营业额数据（用于营收统计表格）
 */
export async function getRevenueMatrix(
  year: number,
  month: number
): Promise<API.RevenueMatrixData> {
  return request<API.RevenueMatrixData>(`/monthly-statistics/revenue-matrix/${year}/${month}`, {
    method: 'GET',
  });
}
