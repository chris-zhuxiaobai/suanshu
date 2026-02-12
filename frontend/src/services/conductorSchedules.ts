import { request } from '@umijs/max';

/**
 * 排班列表参数
 */
export interface ConductorScheduleListParams {
  year?: number;
  month?: number;
  vehicle_id?: string;
  conductor_id?: string;
  per_page?: number;
  page?: number;
}

/**
 * 创建排班参数
 */
export interface CreateConductorScheduleParams {
  year: number;
  month: number;
  vehicle_id: string;
  conductor_id: string;
}

/**
 * 批量创建排班参数中的单个排班项
 */
export interface ConductorScheduleItem {
  vehicle_id: string;
  conductor_id: string;
}

/**
 * 批量创建排班参数
 */
export interface BatchCreateConductorScheduleParams {
  year: number;
  month: number;
  schedules: ConductorScheduleItem[];
}

/**
 * 更新排班参数
 */
export interface UpdateConductorScheduleParams {
  conductor_id: string;
}

/**
 * 获取指定年月的所有车辆售票员排班
 */
export async function getSchedulesByMonth(
  year: number,
  month: number
): Promise<{
  year: number;
  month: number;
  vehicles: Array<{
    vehicle_id: string;
    conductor_id: string | null;
    has_schedule: boolean;
  }>;
}> {
  return request(`/conductor-schedules/by-month/${year}/${month}`, {
    method: 'GET',
  });
}

/**
 * 排班列表
 */
export async function listConductorSchedules(
  params?: ConductorScheduleListParams
): Promise<API.PaginatedResponse<API.ConductorSchedule>> {
  return request<API.PaginatedResponse<API.ConductorSchedule>>('/conductor-schedules', {
    method: 'GET',
    params,
  });
}

/**
 * 创建排班
 */
export async function createConductorSchedule(
  data: CreateConductorScheduleParams
): Promise<API.ConductorSchedule> {
  return request<API.ConductorSchedule>('/conductor-schedules', {
    method: 'POST',
    data,
  });
}

/**
 * 批量创建/更新排班
 */
export async function batchCreateConductorSchedule(
  data: BatchCreateConductorScheduleParams
): Promise<API.ConductorSchedule[]> {
  return request<API.ConductorSchedule[]>('/conductor-schedules/batch', {
    method: 'POST',
    data,
  });
}

/**
 * 更新排班
 */
export async function updateConductorSchedule(
  id: number,
  data: UpdateConductorScheduleParams
): Promise<API.ConductorSchedule> {
  return request<API.ConductorSchedule>(`/conductor-schedules/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除排班
 */
export async function deleteConductorSchedule(id: number): Promise<void> {
  return request(`/conductor-schedules/${id}`, {
    method: 'DELETE',
  });
}
