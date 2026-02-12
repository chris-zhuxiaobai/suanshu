import { request } from '@umijs/max';

/**
 * 获取指定日期的统计数据
 */
export async function getStatisticsByDate(date: string): Promise<API.DailyStatisticsData> {
  return request<API.DailyStatisticsData>(`/daily-statistics/by-date/${date}`, {
    method: 'GET',
  });
}

/**
 * 获取统计数据列表（支持日期范围筛选）
 */
export async function listDailyStatistics(params?: {
  date?: string;
  start_date?: string;
  end_date?: string;
  per_page?: number;
  page?: number;
}) {
  return request<API.Response<API.DailyStatistics[]>>('/daily-statistics', {
    method: 'GET',
    params,
  });
}

/**
 * 重新计算指定日期的统计数据
 */
export async function recalculateStatistics(date: string) {
  return request<API.Response<API.DailyStatistics>>(`/daily-statistics/recalculate/${date}`, {
    method: 'POST',
  });
}
