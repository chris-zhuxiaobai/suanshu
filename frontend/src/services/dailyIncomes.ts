import { request } from '@umijs/max';

/**
 * 收入列表参数
 */
export interface DailyIncomeListParams {
  date?: string; // YYYY-MM-DD
  start_date?: string;
  end_date?: string;
  vehicle_id?: string;
  conductor_id?: string;
  operator_name?: string;
  is_overtime?: boolean;
  per_page?: number;
  page?: number;
}

/**
 * 创建收入参数
 */
export interface CreateDailyIncomeParams {
  date: string; // YYYY-MM-DD
  vehicle_id: string;
  conductor_id: string;
  turn1_amount?: number | null;
  turn2_amount?: number | null;
  turn3_amount?: number | null;
  turn4_amount?: number | null;
  turn5_amount?: number | null;
  wechat_amount?: number;
  fuel_subsidy?: number;
  reward_penalty?: number;
  is_overtime?: boolean;
  remark?: string;
}

/**
 * 批量创建收入参数中的单个收入项
 */
export interface DailyIncomeItem {
  vehicle_id: string;
  conductor_id: string;
  turn1_amount?: number | null;
  turn2_amount?: number | null;
  turn3_amount?: number | null;
  turn4_amount?: number | null;
  turn5_amount?: number | null;
  wechat_amount?: number;
  fuel_subsidy?: number;
  reward_penalty?: number;
  is_overtime?: boolean;
  remark?: string;
}

/**
 * 批量创建收入参数
 */
export interface BatchCreateDailyIncomeParams {
  date: string; // YYYY-MM-DD
  incomes: DailyIncomeItem[];
}

/**
 * 更新收入参数
 */
export interface UpdateDailyIncomeParams {
  conductor_id?: string;
  turn1_amount?: number | null;
  turn2_amount?: number | null;
  turn3_amount?: number | null;
  turn4_amount?: number | null;
  turn5_amount?: number | null;
  wechat_amount?: number;
  fuel_subsidy?: number;
  reward_penalty?: number;
  is_overtime?: boolean;
  remark?: string;
}

/**
 * 获取指定日期的所有车辆收入
 */
export async function getIncomesByDate(
  date: string
): Promise<{
  date: string;
  vehicles: Array<{
    vehicle_id: string;
    has_income: boolean;
    income: API.DailyIncome | null;
    is_rest: boolean;
  }>;
}> {
  return request(`/daily-incomes/by-date/${date}`, {
    method: 'GET',
  });
}

/**
 * 收入列表
 */
export async function listDailyIncomes(
  params?: DailyIncomeListParams
): Promise<API.PaginatedResponse<API.DailyIncome>> {
  return request<API.PaginatedResponse<API.DailyIncome>>('/daily-incomes', {
    method: 'GET',
    params,
  });
}

/**
 * 创建收入
 */
export async function createDailyIncome(
  data: CreateDailyIncomeParams
): Promise<API.DailyIncome> {
  return request<API.DailyIncome>('/daily-incomes', {
    method: 'POST',
    data,
  });
}

/**
 * 批量创建/更新收入
 */
export async function batchCreateDailyIncome(
  data: BatchCreateDailyIncomeParams
): Promise<API.DailyIncome[]> {
  return request<API.DailyIncome[]>('/daily-incomes/batch', {
    method: 'POST',
    data,
  });
}

/**
 * 更新收入
 */
export async function updateDailyIncome(
  id: number,
  data: UpdateDailyIncomeParams
): Promise<API.DailyIncome> {
  return request<API.DailyIncome>(`/daily-incomes/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除收入（不允许删除，返回错误）
 */
export async function deleteDailyIncome(id: number): Promise<void> {
  return request(`/daily-incomes/${id}`, {
    method: 'DELETE',
  });
}
