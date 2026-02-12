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

  interface MonthlyStatisticsData {
    statistics: {
      year: number;
      month: number;
      total_revenue: number;
      total_net_income: number;
      vehicle_count: number; // 该月有收入的车辆总数（去重）
      total_vehicle_count: number; // 所有在册车辆总数
      income_record_count: number; // 入账记录数（整个月的收入记录总数）
      total_rest_count: number; // 总休息车次（整个月所有休息的车次总数）
      total_overtime_count: number; // 总加班车次（整个月所有加班的记录总数）
      average_revenue: number;
      average_net_income: number;
    };
    overtime_vehicles: Array<{
      vehicle_id: string;
      dates: string[]; // 该车辆加班的日期列表
    }>;
    vehicles: Array<{
      vehicle_id: string;
      vehicle: Vehicle | null;
      conductor_id: string | null; // 服务员ID
      revenue: number;
      net_income: number;
      turn_count: number; // 转数（整个月的转数合计）
      turn_total?: number; // 现金收入（5转合计）
      turn1_amount?: number; // 单转最高金额（取整个月的最大值）
      turn1_date?: string | null; // 单转最高金额对应的日期
      turn2_amount?: number;
      turn2_date?: string | null;
      turn3_amount?: number;
      turn3_date?: string | null;
      turn4_amount?: number;
      turn4_date?: string | null;
      turn5_amount?: number;
      turn5_date?: string | null;
      wechat_amount?: number;
      fuel_subsidy?: number;
      reward_penalty?: number; // 整个月的奖罚合计
      payment_amount: number; // 收付款金额（平均净收入 - 当前车辆净收入）
      remark?: string; // 备注
      has_income: boolean; // 是否已录入收入
      is_rest: boolean; // 月统计不区分休息状态，始终为false
      is_overtime: boolean; // 是否加班（整个月是否有过加班）
    }>;
    reward_penalty_ranking: Array<{
      date: string; // 记录日期
      vehicle_id: string;
      conductor_id: string | null;
      reward_penalty: number;
      is_overtime: boolean;
      rank: number;
      isEllipsis?: boolean; // 是否为省略号标记
    }>;
  }

  interface VehicleMonthlyDetailData {
    vehicle_id: string;
    year: number;
    month: number;
    records: Array<{
      date: string; // 日期
      vehicle_id: string;
      conductor_id: string | null;
      revenue: number;
      net_income: number;
      turn_count: number;
      turn_total: number;
      turn1_amount: number;
      turn2_amount: number;
      turn3_amount: number;
      turn4_amount: number;
      turn5_amount: number;
      wechat_amount: number;
      fuel_subsidy: number;
      reward_penalty: number;
      payment_amount: number;
      remark: string;
      is_overtime: boolean;
    }>;
  }

  interface RevenueMatrixData {
    year: number;
    month: number;
    days_in_month: number;
    vehicles: Array<{
      vehicle_id: string;
      daily_revenues: Record<number, number>; // day => revenue
      monthly_total: number;
    }>;
    daily_totals: Record<number, number>; // day => total_revenue
    grand_total: number;
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
