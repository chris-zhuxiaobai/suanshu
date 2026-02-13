import { App, Button, Col, Form, Input, InputNumber, Modal, Row, Select, Space } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useEffect, useState, useMemo } from 'react';
import dayjs from 'dayjs';
import { createDailyIncome, updateDailyIncome, type CreateDailyIncomeParams, type UpdateDailyIncomeParams } from '@/services/dailyIncomes';
import { getSchedulesByMonth } from '@/services/conductorSchedules';
import { listVehicles } from '@/services/vehicles';

interface IncomeEntryModalProps {
  open: boolean;
  vehicleId: string;
  date: string; // YYYY-MM-DD
  income: API.DailyIncome | null; // 如果已有收入数据，传入用于编辑；null表示新增
  onCancel: () => void;
  onSuccess: () => void;
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

  const [defaultConductor, setDefaultConductor] = useState<string>('');
  const [initialValuesReady, setInitialValuesReady] = useState(false);

  // 金额等字段用本地 state 管理，与 Entry 页一致，确保正确显示
  const [localAmounts, setLocalAmounts] = useState<{
    turn1_amount: number | null;
    turn2_amount: number | null;
    turn3_amount: number | null;
    turn4_amount: number | null;
    turn5_amount: number | null;
    wechat_amount: number;
    fuel_subsidy: number;
    reward_penalty: number;
  }>({
    turn1_amount: null,
    turn2_amount: null,
    turn3_amount: null,
    turn4_amount: null,
    turn5_amount: null,
    wechat_amount: 0,
    fuel_subsidy: 0,
    reward_penalty: 0,
  });

  // 表单初始值：已录入使用income数据，未录入使用默认值
  const formInitialValues = useMemo(() => {
    if (income && initialValuesReady) {
      // 编辑模式：使用已有数据，InputNumber 需要 undefined 而不是 null
      const processAmount = (val: any): number | undefined => {
        if (val === null || val === undefined || val === '') {
          return undefined;
        }
        const num = Number(val);
        return isNaN(num) ? undefined : num;
      };
      
      // 处理必填字段，确保有默认值
      const processRequiredAmount = (val: any): number => {
        if (val === null || val === undefined || val === '') {
          return 0;
        }
        const num = Number(val);
        return isNaN(num) ? 0 : num;
      };
      
      return {
        conductor_id: income.conductor_id || '',
        turn1_amount: processAmount(income.turn1_amount),
        turn2_amount: processAmount(income.turn2_amount),
        turn3_amount: processAmount(income.turn3_amount),
        turn4_amount: processAmount(income.turn4_amount),
        turn5_amount: processAmount(income.turn5_amount),
        wechat_amount: processRequiredAmount(income.wechat_amount),
        fuel_subsidy: processRequiredAmount(income.fuel_subsidy),
        reward_penalty: processRequiredAmount(income.reward_penalty),
        remark: income.remark || '',
      };
    }
    // 新增模式：使用默认售票员
    if (!income && defaultConductor !== undefined && initialValuesReady) {
      return {
        conductor_id: defaultConductor || '',
        turn1_amount: undefined,
        turn2_amount: undefined,
        turn3_amount: undefined,
        turn4_amount: undefined,
        turn5_amount: undefined,
        wechat_amount: 0,
        fuel_subsidy: 0,
        reward_penalty: 0,
        remark: '',
      };
    }
    return undefined;
  }, [
    income?.id,
    income?.conductor_id,
    income?.turn1_amount,
    income?.turn2_amount,
    income?.turn3_amount,
    income?.turn4_amount,
    income?.turn5_amount,
    income?.wechat_amount,
    income?.fuel_subsidy,
    income?.reward_penalty,
    income?.remark,
    defaultConductor,
    initialValuesReady,
  ]);

  // 同步 formInitialValues 到本地 state 和 form（conductor_id、remark 仍走 form）
  useEffect(() => {
    if (!open || !formInitialValues) return;
    setLocalAmounts({
      turn1_amount: formInitialValues.turn1_amount ?? null,
      turn2_amount: formInitialValues.turn2_amount ?? null,
      turn3_amount: formInitialValues.turn3_amount ?? null,
      turn4_amount: formInitialValues.turn4_amount ?? null,
      turn5_amount: formInitialValues.turn5_amount ?? null,
      wechat_amount: formInitialValues.wechat_amount ?? 0,
      fuel_subsidy: formInitialValues.fuel_subsidy ?? 0,
      reward_penalty: formInitialValues.reward_penalty ?? 0,
    });
    form.setFieldsValue({
      conductor_id: formInitialValues.conductor_id,
      remark: formInitialValues.remark,
    });
  }, [open, formInitialValues, form]);

  const updateLocalAmount = (field: keyof typeof localAmounts, value: number | null) => {
    setLocalAmounts((prev) => ({ ...prev, [field]: value }));
  };

  // 与 Entry 一致：0 或空显示为空
  const toDisplayValue = (v: number | null | undefined) =>
    v === 0 || v == null ? undefined : v;

  // 初始化数据
  useEffect(() => {
    if (!open) {
      form.resetFields();
      setInitialValuesReady(false);
      setDefaultConductor('');
      setLocalAmounts({
        turn1_amount: null,
        turn2_amount: null,
        turn3_amount: null,
        turn4_amount: null,
        turn5_amount: null,
        wechat_amount: 0,
        fuel_subsidy: 0,
        reward_penalty: 0,
      });
      return;
    }

    const initData = async () => {
      await loadConductorOptions();
      
      if (!income) {
        // 新增模式：加载默认售票员
        const conductor = await loadDefaultConductor();
        setDefaultConductor(conductor);
        setInitialValuesReady(true);
      } else {
        // 编辑模式：不需要加载默认售票员
        setDefaultConductor('');
        setInitialValuesReady(true);
      }
    };

    initData();
  }, [open, income?.id, vehicleId, date]);


  // 格式化金额显示
  const formatAmount = (amount: number): string => {
    if (isNaN(amount) || !isFinite(amount)) {
      return '0';
    }
    const truncated = Math.floor(amount * 10) / 10;
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
        turn1_amount: localAmounts.turn1_amount,
        turn2_amount: localAmounts.turn2_amount,
        turn3_amount: localAmounts.turn3_amount,
        turn4_amount: localAmounts.turn4_amount,
        turn5_amount: localAmounts.turn5_amount,
        wechat_amount: localAmounts.wechat_amount,
        fuel_subsidy: localAmounts.fuel_subsidy,
        reward_penalty: localAmounts.reward_penalty,
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

  // 显示计算值：已录入使用income中的值，未录入不显示（后端会计算）
  const displayStats = useMemo(() => {
    if (income) {
      // 编辑模式：使用后端返回的计算值
      return {
        revenue: Number(income.revenue) || 0,
        netIncome: Number(income.net_income) || 0,
        turnCount: Number(income.turn_count) || 0,
      };
    }
    // 新增模式：不显示实时计算
    return null;
  }, [income]);

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
      destroyOnHidden
    >
      {initialValuesReady && formInitialValues && (
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 16 }}
          key={`${income?.id || 'new'}-${vehicleId}-${date}-${open}`}
          preserve={false}
        >
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
                    <Form.Item label={`第${turn}转`} style={{ marginBottom: 0 }}>
                      <Space.Compact>
                        <InputNumber
                          placeholder="收入"
                          min={0}
                          precision={1}
                          formatter={amountFormatter}
                          parser={amountParser}
                          style={{ width: 120 }}
                          value={toDisplayValue(localAmounts[`turn${turn}_amount` as keyof typeof localAmounts])}
                          onChange={(v) => updateLocalAmount(`turn${turn}_amount` as keyof typeof localAmounts, v ?? null)}
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

        <Row gutter={12} style={{ display: 'flex', flexWrap: 'wrap' }}>
          <Col flex="none">
            <Form.Item label="微信收入" style={{ marginBottom: 0 }}>
              <Space.Compact>
                <InputNumber
                  placeholder="收入"
                  min={0}
                  precision={1}
                  formatter={amountFormatter}
                  parser={amountParser}
                  style={{ width: 120 }}
                  value={toDisplayValue(localAmounts.wechat_amount)}
                  onChange={(v) => updateLocalAmount('wechat_amount', v ?? 0)}
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
          <Col flex="none">
            <Form.Item label="补油款" style={{ marginBottom: 0 }}>
              <Space.Compact>
                <InputNumber
                  placeholder="金额"
                  min={0}
                  precision={1}
                  formatter={amountFormatter}
                  parser={amountParser}
                  style={{ width: 120 }}
                  value={toDisplayValue(localAmounts.fuel_subsidy)}
                  onChange={(v) => updateLocalAmount('fuel_subsidy', v ?? 0)}
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
          <Col xs={24} sm={24} flex="none" style={{ width: '100%' }}>
            <Form.Item label="奖罚" style={{ marginBottom: 0 }}>
              <Space.Compact>
                <InputNumber
                  placeholder="金额（可为负）"
                  precision={1}
                  formatter={amountFormatter}
                  parser={rewardPenaltyParser}
                  style={{ width: 120 }}
                  value={toDisplayValue(localAmounts.reward_penalty)}
                  onChange={(v) => updateLocalAmount('reward_penalty', v ?? 0)}
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
        </Row>

        <Row gutter={16}>
          <Col span={24}>
            <Form.Item label="备注" name="remark">
              <Input.TextArea placeholder="备注信息" rows={2} maxLength={1000} showCount />
            </Form.Item>
          </Col>
        </Row>

        {/* 仅编辑模式显示计算值 */}
        {displayStats && (
          <Row gutter={16}>
            <Col span={24}>
              <Space size="large" style={{ marginTop: 8 }}>
                {displayStats.revenue !== 0 && (
                  <span>
                    <strong>营业额：</strong>
                    <span style={{ color: '#1677ff', fontSize: '16px', fontWeight: 'bold' }}>
                      {formatAmount(displayStats.revenue)}
                    </span>
                    <span style={{ marginLeft: '4px' }}>元</span>
                  </span>
                )}
                {displayStats.netIncome !== 0 && (
                  <span>
                    <strong>实际分配金额：</strong>
                    <span style={{ color: '#52c41a', fontSize: '16px', fontWeight: 'bold' }}>
                      {formatAmount(displayStats.netIncome)}
                    </span>
                    <span style={{ marginLeft: '4px' }}>元</span>
                  </span>
                )}
                <span>
                  <strong>转数：</strong>
                  <span style={{ color: '#722ed1', fontSize: '16px', fontWeight: 'bold' }}>
                    {displayStats.turnCount}
                  </span>
                  <span style={{ marginLeft: '4px' }}>转</span>
                </span>
              </Space>
            </Col>
          </Row>
        )}
        </Form>
      )}
    </Modal>
  );
}
