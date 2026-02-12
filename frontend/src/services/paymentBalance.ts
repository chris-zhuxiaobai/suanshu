import { request } from '@umijs/max';

/**
 * 收付平衡快照数据
 */
export interface PaymentBalanceSnapshotData {
  year: number;
  month: number;
  auto_average_income: number;
  manual_average_income: number | null;
  manager_salary: number;
  vehicle_details: VehiclePaymentDetail[];
  operator_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_saved: boolean;
}

/**
 * 车辆收付明细
 */
export interface VehiclePaymentDetail {
  vehicle_id: string;
  revenue: number;
  net_income: number;
  turn_count: number;
  fuel_subsidy: number;
  reward_penalty: number;
  conductor_id: string | null;
  payment_due_auto: number; // 应付款(自动)
  payment_receivable_auto: number; // 应收款(自动)
  payment_due_corrected: number; // 应付款(修正)
  payment_receivable_corrected: number; // 应收款(修正)
}

/**
 * 保存收付平衡数据请求
 */
export interface SavePaymentBalanceRequest {
  year: number;
  month: number;
  auto_average_income: number;
  manual_average_income?: number | null;
  manager_salary: number;
  vehicle_details: VehiclePaymentDetail[];
}

/**
 * 获取指定月份的收付平衡数据
 */
export async function getPaymentBalanceByMonth(
  year: number,
  month: number
): Promise<PaymentBalanceSnapshotData | null> {
  const data = await request<PaymentBalanceSnapshotData>(
    `/payment-balance/by-month/${year}/${month}`,
    {
      method: 'GET',
    }
  );
  return data ?? null;
}

/**
 * 预览收付平衡数据（不保存）
 */
export interface PreviewPaymentBalanceRequest {
  year: number;
  month: number;
  manager_salary: number;
  manual_average_income?: number | null;
}

export interface PreviewPaymentBalanceData {
  auto_average_income: number;
  vehicle_details: VehiclePaymentDetail[];
}

/**
 * 预览收付平衡数据
 */
export async function previewPaymentBalance(
  payload: PreviewPaymentBalanceRequest
): Promise<PreviewPaymentBalanceData> {
  const data = await request<PreviewPaymentBalanceData>(
    '/payment-balance/preview',
    {
      method: 'POST',
      data: payload,
    }
  );
  return data!;
}

/**
 * 保存收付平衡快照数据
 */
export async function savePaymentBalance(
  payload: SavePaymentBalanceRequest
): Promise<{ id: number; year: number; month: number }> {
  const data = await request<{ id: number; year: number; month: number }>(
    '/payment-balance',
    {
      method: 'POST',
      data: payload,
    }
  );
  return data!;
}
