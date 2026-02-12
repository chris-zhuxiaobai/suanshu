import { PlusOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { App, Button, Space } from 'antd';
import { useRef, useState } from 'react';
import {
  createVehicle,
  deleteVehicle,
  listVehicles,
  updateVehicle,
  type CreateVehicleParams,
  type UpdateVehicleParams,
} from '@/services/vehicles';
import VehicleFormModal from './components/VehicleFormModal';

export default function VehiclesPage() {
  const { message, modal } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<API.Vehicle | null>(null);

  const handleCreate = () => {
    setEditingVehicle(null);
    setFormModalOpen(true);
  };

  const handleEdit = (record: API.Vehicle) => {
    setEditingVehicle(record);
    setFormModalOpen(true);
  };

  const handleDelete = (record: API.Vehicle) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除车辆 ${record.id} 吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteVehicle(record.id);
          message.success('删除成功');
          actionRef.current?.reload();
        } catch (error: any) {
          if (error?.response?.status === 403) return; // 已在全局统一提示
          message.error(error?.message || '删除失败');
        }
      },
    });
  };

  const handleFormSubmit = async (values: CreateVehicleParams | UpdateVehicleParams) => {
    try {
      // 启用功能暂时屏蔽，默认全部启用
      const payload = { ...values, status: 'active' as const };
      if (editingVehicle) {
        await updateVehicle(editingVehicle.id, payload);
        message.success('更新成功');
      } else {
        await createVehicle(payload as CreateVehicleParams);
        message.success('创建成功');
      }
      setFormModalOpen(false);
      setEditingVehicle(null);
      actionRef.current?.reload();
    } catch (error: any) {
      if (error?.response?.status === 403) return; // 已在全局统一提示
      const errorMessage =
        error?.response?.data?.data?.[Object.keys(error?.response?.data?.data || {})[0]]?.[0] ||
        error?.message ||
        '操作失败';
      message.error(errorMessage);
      throw error;
    }
  };

  const columns: ProColumns<API.Vehicle>[] = [
    {
      title: '车牌号',
      dataIndex: 'id',
      width: 100,
      fixed: 'left',
      copyable: true,
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      width: 80,
      sorter: true,
      defaultSortOrder: 'ascend',
    },
    {
      title: '备注',
      dataIndex: 'remark',
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 180,
      hideInSearch: true,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      valueType: 'dateTime',
      width: 180,
      hideInSearch: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_: any, record: API.Vehicle) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button
            type="link"
            danger
            size="small"
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer>
      <ProTable<API.Vehicle>
        headerTitle="车辆管理"
        actionRef={actionRef}
        rowKey="id"
        search={{
          labelWidth: 'auto',
        }}
        toolBarRender={() => [
          <Button
            type="primary"
            key="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新增车辆
          </Button>,
        ]}
        request={async (params) => {
          const { current = 1, pageSize = 15, ...rest } = params;
          const result = await listVehicles({
            ...rest,
            page: current,
            per_page: pageSize,
          });
          return {
            data: result.data,
            success: true,
            total: result.total,
          };
        }}
        columns={columns}
        scroll={{ x: 1200 }}
      />

      <VehicleFormModal
        open={formModalOpen}
        vehicle={editingVehicle}
        onCancel={() => {
          setFormModalOpen(false);
          setEditingVehicle(null);
        }}
        onSubmit={handleFormSubmit}
      />
    </PageContainer>
  );
}
