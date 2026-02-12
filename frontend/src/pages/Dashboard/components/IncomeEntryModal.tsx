import { App, Button, Col, Form, Input, InputNumber, Modal, Row, Select, Space } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { createDailyIncome, updateDailyIncome, type CreateDailyIncomeParams, type UpdateDailyIncomeParams } from '@/services/dailyIncomes';
import { getSchedulesByMonth } from '@/services/conductorSchedules';
import { listVehicles } from '@/services/vehicles';

interface IncomeEntryModalProps {
  open: boolean;
  vehicleId: string;
  date: string; // YYYY-MM-DD
  income: API.DailyIncome | null; // 如果已有收入数据，传入用于编辑
  onCancel: () => void;
  onSuccess: () => void;
}

interface LocalIncomeData {
  conductor_id: string;
  turn1_amount: number | null;
  turn2_amount: number | null;
  turn3_amount: number | null;
  turn4_amount: number | null;
  turn5_amount: number | null;
  wechat_amount: number;
  fuel_subsidy: number;
  reward_penalty: number;
  remark?: string;
}

export default function IncomeEntryModal({
  open,
  vehicleId,
  date,
  income,
  onCancel,
  onSuccess,
}: IncomeEntryModalProps) {
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [conductorOptions, setConductorOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [localData, setLocalData] = useState<LocalIncomeData>({
    conductor_id: '',
    turn1_amount: null,
    turn2_amount: null,
    turn3_amount: null,
    turn4_amount: null,
    turn5_amount: null,
    wechat_amount: 0,
    fuel_subsidy: 0,
    reward_penalty: 0,
  });

  // 加载售票员选项（排除本车）
  const loadConductorOptions = async () => {
    try {
      const result = await listVehicles({ status: 'active', per_page: 100 });
      const options = result.data
        .filter((v) => v.id !== vehicleId)
        .map((v) => ({
          label: v.id,
          value: v.id,
        }));
      setConductorOptions(options);
    } catch (error) {
      console.error('加载售票员列表失败:', error);
    }
  };

  // 加载默认售票员（从排班中获取）
  const loadDefaultConductor = async () => {
    try {
      const dateObj = dayjs(date);
      const year = dateObj.year();
      const month = dateObj.month() + 1;
      const schedules = await getSchedulesByMonth(year, month);
      const schedule = schedules.vehicles.find((v) => v.vehicle_id === vehicleId);
      return schedule?.conductor_id || '';
    } catch (error) {
      console.error('加载售票员排班失败:', error);
      return '';
    }
  };

  // 初始化表单数据
  useEffect(() => {
    if (!open) return;

    const initData = async () => {
      await loadConductorOptions();
      
      if (income) {
        // 编辑模式：使用已有数据
        const data: LocalIncomeData = {
          conductor_id: income.conductor_id,
          turn1_amount: income.turn1_amount != null ? Number(income.turn1_amount) : null,
          turn2_amount: income.turn2_amount != null ? Number(income.turn2_amount) : null,
          turn3_amount: income.turn3_amount != null ? Number(income.turn3_amount) : null,
          turn4_amount: income.turn4_amount != null ? Number(income.turn4_amount) : null,
          turn5_amount: income.turn5_amount != null ? Number(income.turn5_amount) : null,
          wechat_amount: Number(income.wechat_amount) || 0,
          fuel_subsidy: Number(income.fuel_subsidy) || 0,
          reward_penalty: Number(income.reward_penalty) || 0,
          remark: income.remark,
        };
        setLocalData(data);
        form.setFieldsValue(data);
      } else {
        // 新增模式：使用默认售票员
        const defaultConductor = await loadDefaultConductor();
        const data: LocalIncomeData = {
          conductor_id: defaultConductor,
          turn1_amount: null,
          turn2_amount: null,
          turn3_amount: null,
          turn4_amount: null,
          turn5_amount: null,
          wechat_amount: 0,
          fuel_subsidy: 0,
          reward_penalty: 0,
        };
        setLocalData(data);
        form.setFieldsValue(data);
      }
    };

    initData();
  }, [open, income, vehicleId, date, form]);

  // 截断金额到一位小数（不四舍五入）
  const truncateAmount = (amount: number): number => {
    if (isNaN(amount) || !isFinite(amount)) {
      return 0;
    }
    return Math.floor(amount * 10) / 10;
  };

  // 格式化金额显示
  const formatAmount = (amount: number): string => {
    if (isNaN(amount) || !isFinite(amount)) {
      return '0';
    }
    const truncated = truncateAmount(amount);
    if (truncated % 1 === 0) {
      return truncated.toString();
    }
    return truncated.toFixed(1);
  };

  // 金额输入框格式化
  const amountFormatter = (value: number | undefined) => {
    if (value === undefined || value === null) return '';
    return value.toString();
  };

  const amountParser = (value: string | undefined): number => {
    if (!value) return 0;
    const parsed = value.replace(/[^\d.]/g, '');
    const parts = parsed.split('.');
    if (parts.length > 2) {
      const result = parts[0] + '.' + parts.slice(1).join('');
      return Number(result) || 0;
    }
    if (parts[1] && parts[1].length > 1) {
      const result = parts[0] + '.' + parts[1].substring(0, 1);
      return Number(result) || 0;
    }
    return parsed === '' ? 0 : Number(parsed) || 0;
  };

  // 奖罚金额解析器，允许负数
  const rewardPenaltyParser = (value: string | undefined): number => {
    if (!value) return 0;
    let parsed = value.replace(/[^-?\d.]/g, '');
    const hasNegative = parsed.startsWith('-');
    parsed = parsed.replace(/-/g, '');
    if (hasNegative && parsed) {
      parsed = '-' + parsed;
    }
    const parts = parsed.split('.');
    if (parts.length > 2) {
      parsed = parts[0] + '.' + parts.slice(1).join('');
    }
    if (parts.length === 2 && parts[1] && parts[1].length > 1) {
      parsed = parts[0] + '.' + parts[1].substring(0, 1);
    }
    if (parsed === '-' || parsed === '') return 0;
    const numValue = Number(parsed);
    return isNaN(numValue) ? 0 : numValue;
  };

  // 计算营业额
  const calculateRevenue = (data: LocalIncomeData): number => {
    let total = 0;
    for (let i = 1; i <= 5; i++) {
      const amount = data[`turn${i}_amount` as keyof LocalIncomeData] as number | null;
      if (amount !== null && amount !== undefined && !isNaN(amount)) {
        total += Number(amount);
      }
    }
    const wechatAmount = Number(data.wechat_amount) || 0;
    if (!isNaN(wechatAmount)) {
      total += wechatAmount;
    }
    return truncateAmount(total);
  };

  // 计算净收入
  const calculateNetIncome = (data: LocalIncomeData): number => {
    const revenue = calculateRevenue(data);
    const fuelSubsidy = Number(data?.fuel_subsidy) || 0;
    const rewardPenalty = Number(data?.reward_penalty) || 0;
    const netIncome = revenue - fuelSubsidy + rewardPenalty;
    const result = truncateAmount(netIncome);
    return isNaN(result) ? 0 : result;
  };

  // 计算转数
  const calculateTurnCount = (data: LocalIncomeData): number => {
    let count = 0;
    for (let i = 1; i <= 4; i++) {
      const amount = data[`turn${i}_amount` as keyof LocalIncomeData] as number | null;
      if (amount !== null && amount !== undefined && amount > 0) {
        count++;
      }
    }
    return count;
  };

  // 监听表单值变化，更新本地数据用于实时计算
  const handleFormValuesChange = (changedValues: any, allValues: any) => {
    const newData: LocalIncomeData = {
      conductor_id: allValues.conductor_id || localData.conductor_id,
      turn1_amount: allValues.turn1_amount ?? null,
      turn2_amount: allValues.turn2_amount ?? null,
      turn3_amount: allValues.turn3_amount ?? null,
      turn4_amount: allValues.turn4_amount ?? null,
      turn5_amount: allValues.turn5_amount ?? null,
      wechat_amount: allValues.wechat_amount ?? 0,
      fuel_subsidy: allValues.fuel_subsidy ?? 0,
      reward_penalty: allValues.reward_penalty ?? 0,
      remark: allValues.remark,
    };
    setLocalData(newData);
  };

  // 保存数据
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      if (!values.conductor_id) {
        messageApi.warning('请选择服务员');
        return;
      }

      setLoading(true);

      const incomeData: CreateDailyIncomeParams | UpdateDailyIncomeParams = {
        conductor_id: values.conductor_id,
        turn1_amount: values.turn1_amount ?? null,
        turn2_amount: values.turn2_amount ?? null,
        turn3_amount: values.turn3_amount ?? null,
        turn4_amount: values.turn4_amount ?? null,
        turn5_amount: values.turn5_amount ?? null,
        wechat_amount: values.wechat_amount ?? 0,
        fuel_subsidy: values.fuel_subsidy ?? 0,
        reward_penalty: values.reward_penalty ?? 0,
        remark: values.remark,
      };

      if (income) {
        // 更新
        await updateDailyIncome(income.id, incomeData);
        messageApi.success('更新成功');
      } else {
        // 创建
        await createDailyIncome({
          date,
          vehicle_id: vehicleId,
          ...incomeData,
        } as CreateDailyIncomeParams);
        messageApi.success('保存成功');
      }

      onSuccess();
      onCancel();
    } catch (error: any) {
      if (error?.errorFields) {
        // 表单验证错误
        return;
      }
      if (error?.response?.status === 403) return;
      const errorMessage = error?.response?.data?.message || error?.message || '保存失败';
      messageApi.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const revenue = calculateRevenue(localData);
  const netIncome = calculateNetIncome(localData);
  const turnCount = calculateTurnCount(localData);

  return (
    <Modal
      title={`${income ? '编辑' : '录入'}收入 - 车辆 ${vehicleId}`}
      open={open}
      onCancel={onCancel}
      width={800}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="save" type="primary" icon={<SaveOutlined />} loading={loading} onClick={handleSave}>
          保存
        </Button>,
      ]}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }} onValuesChange={handleFormValuesChange}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="服务员"
              name="conductor_id"
              rules={[{ required: true, message: '请选择服务员' }]}
            >
              <Select
                placeholder="请选择服务员"
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                }
                options={conductorOptions}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Form.Item label="5转收入">
              <Row gutter={12}>
                {[1, 2, 3, 4, 5].map((turn) => (
                  <Col key={turn}>
                    <Form.Item
                      label={`第${turn}转`}
                      style={{ marginBottom: 0 }}
                      name={`turn${turn}_amount`}
                      getValueFromEvent={(value) => value ?? null}
                    >
                      <Space.Compact>
                        <InputNumber
                          placeholder="收入"
                          min={0}
                          precision={1}
                          formatter={amountFormatter}
                          parser={amountParser}
                          style={{ width: 120 }}
                        />
                        <span
                          style={{
                            padding: '0 11px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            backgroundColor: '#fafafa',
                            border: '1px solid #d9d9d9',
                            borderLeft: 'none',
                            borderRadius: '0 6px 6px 0',
                            height: '32px',
                          }}
                        >
                          元
                        </span>
                      </Space.Compact>
                    </Form.Item>
                  </Col>
                ))}
              </Row>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              label="微信收入"
              name="wechat_amount"
              getValueFromEvent={(value) => value ?? 0}
            >
              <Space.Compact>
                <InputNumber
                  placeholder="收入"
                  min={0}
                  precision={1}
                  formatter={amountFormatter}
                  parser={amountParser}
                  style={{ width: 120 }}
                />
                <span
                  style={{
                    padding: '0 8px',
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#fafafa',
                    border: '1px solid #d9d9d9',
                    borderLeft: 'none',
                    borderRadius: '0 6px 6px 0',
                  }}
                >
                  元
                </span>
              </Space.Compact>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="补油款"
              name="fuel_subsidy"
              getValueFromEvent={(value) => value ?? 0}
            >
              <Space.Compact>
                <InputNumber
                  placeholder="金额"
                  min={0}
                  precision={1}
                  formatter={amountFormatter}
                  parser={amountParser}
                  style={{ width: 120 }}
                />
                <span
                  style={{
                    padding: '0 8px',
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#fafafa',
                    border: '1px solid #d9d9d9',
                    borderLeft: 'none',
                    borderRadius: '0 6px 6px 0',
                  }}
                >
                  元
                </span>
              </Space.Compact>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="奖罚"
              name="reward_penalty"
              getValueFromEvent={(value) => value ?? 0}
            >
              <Space.Compact>
                <InputNumber
                  placeholder="金额（可为负）"
                  precision={1}
                  formatter={amountFormatter}
                  parser={rewardPenaltyParser}
                  style={{ width: 120 }}
                />
                <span
                  style={{
                    padding: '0 8px',
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#fafafa',
                    border: '1px solid #d9d9d9',
                    borderLeft: 'none',
                    borderRadius: '0 6px 6px 0',
                  }}
                >
                  元
                </span>
              </Space.Compact>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Form.Item label="备注" name="remark">
              <Input.TextArea placeholder="备注信息" rows={2} maxLength={1000} showCount />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Space size="large" style={{ marginTop: 8 }}>
              {revenue !== 0 && (
                <span>
                  <strong>营业额：</strong>
                  <span style={{ color: '#1677ff', fontSize: '16px', fontWeight: 'bold' }}>
                    {formatAmount(revenue)}
                  </span>
                  <span style={{ marginLeft: '4px' }}>元</span>
                </span>
              )}
              {netIncome !== 0 && (
                <span>
                  <strong>实际分配金额：</strong>
                  <span style={{ color: '#52c41a', fontSize: '16px', fontWeight: 'bold' }}>
                    {formatAmount(netIncome)}
                  </span>
                  <span style={{ marginLeft: '4px' }}>元</span>
                </span>
              )}
              <span>
                <strong>转数：</strong>
                <span style={{ color: '#722ed1', fontSize: '16px', fontWeight: 'bold' }}>{turnCount}</span>
                <span style={{ marginLeft: '4px' }}>转</span>
              </span>
            </Space>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
