import { request } from '@umijs/max';

/**
 * 车辆列表参数
 */
export interface VehicleListParams {
  search?: string;
  status?: 'active' | 'inactive';
  per_page?: number;
  page?: number;
}

/**
 * 创建车辆参数
 */
export interface CreateVehicleParams {
  id: string; // 车牌后三位
  sort_order?: number;
  status?: 'active' | 'inactive';
  remark?: string;
}

/**
 * 更新车辆参数
 */
export interface UpdateVehicleParams {
  sort_order?: number;
  status?: 'active' | 'inactive';
  remark?: string;
}

/**
 * 车辆列表
 */
export async function listVehicles(
  params?: VehicleListParams
): Promise<API.PaginatedResponse<API.Vehicle>> {
  return request<API.PaginatedResponse<API.Vehicle>>('/vehicles', {
    method: 'GET',
    params,
  });
}

/**
 * 车辆详情
 */
export async function getVehicle(id: string): Promise<API.Vehicle> {
  return request<API.Vehicle>(`/vehicles/${id}`, {
    method: 'GET',
  });
}

/**
 * 创建车辆
 */
export async function createVehicle(
  data: CreateVehicleParams
): Promise<API.Vehicle> {
  return request<API.Vehicle>('/vehicles', {
    method: 'POST',
    data,
  });
}

/**
 * 更新车辆
 */
export async function updateVehicle(
  id: string,
  data: UpdateVehicleParams
): Promise<API.Vehicle> {
  return request<API.Vehicle>(`/vehicles/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除车辆
 */
export async function deleteVehicle(id: string): Promise<void> {
  return request(`/vehicles/${id}`, {
    method: 'DELETE',
  });
}
