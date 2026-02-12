import { request } from '@umijs/max';

/**
 * 排班列表参数
 */
export interface VehicleScheduleListParams {
  date?: string; // YYYY-MM-DD
  start_date?: string;
  end_date?: string;
  vehicle_id?: string;
  status?: 'rest' | 'operate';
  per_page?: number;
  page?: number;
}

/**
 * 创建排班参数
 */
export interface CreateVehicleScheduleParams {
  date: string; // YYYY-MM-DD
  vehicle_id: string;
  status: 'rest' | 'operate';
}

/**
 * 批量创建排班参数
 */
export interface BatchCreateVehicleScheduleParams {
  date: string; // YYYY-MM-DD
  vehicle_ids: string[];
  status: 'rest' | 'operate';
}

/**
 * 更新排班参数
 */
export interface UpdateVehicleScheduleParams {
  status: 'rest' | 'operate';
}

/**
 * 获取指定日期的所有车辆排班
 */
export async function getSchedulesByDate(
  date: string
): Promise<{
  date: string;
  vehicles: Array<{
    vehicle_id: string;
    vehicle_sort_order: number;
    status: 'rest' | 'operate';
    has_schedule: boolean;
  }>;
}> {
  return request(`/vehicle-schedules/by-date/${date}`, {
    method: 'GET',
  });
}

/**
 * 排班列表
 */
export async function listVehicleSchedules(
  params?: VehicleScheduleListParams
): Promise<API.PaginatedResponse<API.VehicleSchedule>> {
  return request<API.PaginatedResponse<API.VehicleSchedule>>('/vehicle-schedules', {
    method: 'GET',
    params,
  });
}

/**
 * 创建排班
 */
export async function createVehicleSchedule(
  data: CreateVehicleScheduleParams
): Promise<API.VehicleSchedule> {
  return request<API.VehicleSchedule>('/vehicle-schedules', {
    method: 'POST',
    data,
  });
}

/**
 * 批量创建排班
 */
export async function batchCreateVehicleSchedule(
  data: BatchCreateVehicleScheduleParams
): Promise<API.VehicleSchedule[]> {
  return request<API.VehicleSchedule[]>('/vehicle-schedules/batch', {
    method: 'POST',
    data,
  });
}

/**
 * 更新排班
 */
export async function updateVehicleSchedule(
  id: number,
  data: UpdateVehicleScheduleParams
): Promise<API.VehicleSchedule> {
  return request<API.VehicleSchedule>(`/vehicle-schedules/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除排班
 */
export async function deleteVehicleSchedule(id: number): Promise<void> {
  return request(`/vehicle-schedules/${id}`, {
    method: 'DELETE',
  });
}
