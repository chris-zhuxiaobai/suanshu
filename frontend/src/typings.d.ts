declare namespace API {
  interface CurrentUser {
    id: number;
    name: string;
    username: string;
    role: string;
    token_source?: string;
  }

  interface LoginResult {
    token: string;
    user: CurrentUser;
  }

  interface Vehicle {
    id: string; // 车牌后三位
    sort_order: number;
    status: 'active' | 'inactive';
    remark?: string;
    created_at: string;
    updated_at: string;
  }

  interface VehicleSchedule {
    id: number;
    date: string; // YYYY-MM-DD
    vehicle_id: string;
    status: 'rest' | 'operate';
    created_at: string;
    updated_at: string;
    vehicle?: Vehicle;
  }

  interface ConductorSchedule {
    id: number;
    year: number;
    month: number;
    vehicle_id: string;
    conductor_id: string;
    created_at: string;
    updated_at: string;
    vehicle?: Vehicle;
    conductor?: Vehicle;
  }

  interface DailyIncome {
    id: number;
    date: string; // YYYY-MM-DD
    vehicle_id: string;
    conductor_id: string;
    turn1_amount?: number | null;
    turn2_amount?: number | null;
    turn3_amount?: number | null;
    turn4_amount?: number | null;
    turn5_amount?: number | null;
    wechat_amount: number;
    fuel_subsidy: number;
    reward_penalty: number;
    revenue: number; // 营业额
    net_income: number; // 净收入
    turn_count: number; // 转数
    is_overtime: boolean;
    operator_name: string;
    remark?: string;
    created_at: string;
    updated_at: string;
    vehicle?: Vehicle;
    conductor?: Vehicle;
  }

  interface DailyStatistics {
    id: number;
    date: string; // YYYY-MM-DD
    total_revenue: number; // 总营业额
    total_net_income: number; // 总净收入
    vehicle_count: number; // 录入收入的车辆数量
    average_revenue: number; // 平均营业额
    average_net_income: number; // 平均净收入
    created_at: string;
    updated_at: string;
  }

  interface DailyStatisticsData {
    statistics: {
      date: string;
      total_revenue: number;
      total_net_income: number;
      vehicle_count: number; // 已录入的车辆数量
      total_vehicle_count: number; // 所有在册车辆总数
      rest_vehicle_count: number; // 今日休息的车辆数量
      average_revenue: number;
      average_net_income: number;
    };
    vehicles: Array<{
      vehicle_id: string;
      vehicle: Vehicle | null;
      conductor_id: string | null; // 服务员ID
      revenue: number;
      net_income: number;
      turn_count: number; // 转数（第1-4转中有收入的转数）
      turn_total?: number; // 现金收入（5转合计）
      turn1_amount?: number;
      turn2_amount?: number;
      turn3_amount?: number;
      turn4_amount?: number;
      turn5_amount?: number;
      wechat_amount?: number;
      fuel_subsidy?: number;
      reward_penalty?: number;
      payment_amount: number; // 收付款金额（平均净收入 - 当前车辆净收入）
      remark?: string; // 备注
      has_income: boolean; // 是否已录入收入
      is_rest: boolean; // 是否休息
      is_overtime: boolean; // 是否加班
    }>;
  }

  interface PaginatedResponse<T> {
    data: T[];
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    from?: number;
    to?: number;
  }
}

// 允许导入静态资源（如 webp 图片）
declare module '*.webp' {
  const src: string;
  export default src;
}
