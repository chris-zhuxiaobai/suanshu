import type { ProFormInstance } from '@ant-design/pro-components';
import { ModalForm, ProFormDigit, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { useRef } from 'react';
import type { CreateVehicleParams, UpdateVehicleParams } from '@/services/vehicles';

interface VehicleFormModalProps {
  open: boolean;
  vehicle: API.Vehicle | null;
  onCancel: () => void;
  onSubmit: (values: CreateVehicleParams | UpdateVehicleParams) => Promise<void>;
}

export default function VehicleFormModal({
  open,
  vehicle,
  onCancel,
  onSubmit,
}: VehicleFormModalProps) {
  const formRef = useRef<ProFormInstance | undefined>(undefined);

  const isEdit = !!vehicle;

  // 使用 key 确保编辑/新增切换时重新创建表单
  const formKey = vehicle?.id ? `edit-${vehicle.id}` : 'create';

  return (
    <ModalForm
      key={formKey}
      title={isEdit ? '编辑车辆' : '新增车辆'}
      open={open}
      formRef={formRef}
      modalProps={{
        onCancel,
        destroyOnHidden: true,
      }}
      onFinish={async (values) => {
        await onSubmit(values as CreateVehicleParams | UpdateVehicleParams);
      }}
      width={600}
    >
      {!isEdit && (
        <ProFormText
          name="id"
          label="车牌号"
          placeholder="请输入车牌后三位（纯数字）"
          rules={[
            { required: true, message: '请输入车牌号' },
            {
              pattern: /^\d{3}$/,
              message: '车牌号必须是3位纯数字',
            },
          ]}
          fieldProps={{
            maxLength: 3,
          }}
        />
      )}

      <ProFormDigit
        name="sort_order"
        label="排序"
        placeholder="数值越小越靠前"
        min={0}
        initialValue={vehicle?.sort_order ?? 0}
        fieldProps={{
          precision: 0,
        }}
      />

      <ProFormTextArea
        name="remark"
        label="备注"
        placeholder="请输入备注信息"
        initialValue={vehicle?.remark}
        fieldProps={{
          rows: 4,
          maxLength: 1000,
          showCount: true,
        }}
      />
    </ModalForm>
  );
}
