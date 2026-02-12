import {
  Button,
  Card,
  Checkbox,
  Col,
  Dropdown,
  Radio,
  Row,
  Space,
  Table,
  Tag,
} from 'antd';
import { DownloadOutlined, SettingOutlined } from '@ant-design/icons';
import { App } from 'antd';
import * as ExcelJSLib from 'exceljs';
import { useMemo, useState } from 'react';

/** 仅用于导出时单元格样式，与 exceljs Fill 结构一致 */
interface ExcelFill {
  type: 'pattern';
  pattern: 'solid';
  fgColor: { argb: string };
}

/** 从 exceljs 取 Workbook（兼容命名导出与 default 导出，避免 MF/Webpack 下 "is not a constructor"） */
function getExcelJSWorkbook(): typeof ExcelJSLib.Workbook | null {
  const W = (ExcelJSLib as any).Workbook ?? (ExcelJSLib as any).default?.Workbook ?? (ExcelJSLib as any).default;
  return typeof W === 'function' ? W : null;
}

const COLUMN_OPTIONS: { key: string; label: string }[] = [
  { key: 'vehicle_id', label: '车辆' },
  { key: 'conductor_id', label: '服务员' },
  { key: 'turn_total', label: '现金收入' },
  { key: 'wechat_amount', label: '微信收入' },
  { key: 'revenue', label: '营业额' },
  { key: 'fuel_subsidy', label: '补油款' },
  { key: 'reward_penalty', label: '奖罚' },
  { key: 'net_income', label: '实际分配金额' },
  { key: 'turn_count', label: '转数' },
  { key: 'turn1_amount', label: '第1转' },
  { key: 'turn2_amount', label: '第2转' },
  { key: 'turn3_amount', label: '第3转' },
  { key: 'turn4_amount', label: '第4转' },
  { key: 'turn5_amount', label: '第5转' },
  { key: 'remark', label: '备注' },
  { key: 'payment_amount', label: '收付款' },
  { key: 'vehicle_id_right', label: '车辆(右)' },
];

function defaultFormatAmount(amount: number): string {
  if (isNaN(amount) || !isFinite(amount)) return '0';
  const truncated = Math.floor(amount * 10) / 10;
  return truncated % 1 === 0 ? truncated.toString() : truncated.toFixed(1);
}

export interface DailyStatisticsViewProps {
  /** 统计数据，null 时显示空状态 */
  data: API.DailyStatisticsData | null;
  /** 加载中 */
  loading?: boolean;
  /** 导出文件名用日期，如 2025-02-11 */
  exportDate?: string;
  /** 是否显示导出按钮 */
  showExport?: boolean;
  /** 金额格式化，默认整数不显示小数 */
  formatAmount?: (amount: number) => string;
  /** localStorage 键前缀，用于区分不同页面的列/密度配置 */
  storageKeyPrefix?: string;
}

type TableSize = 'small' | 'middle' | 'large';

export default function DailyStatisticsView({
  data,
  loading = false,
  exportDate,
  showExport = true,
  formatAmount = defaultFormatAmount,
  storageKeyPrefix = 'income',
}: DailyStatisticsViewProps) {
  const { message: messageApi } = App.useApp();

  const columnsKey = `${storageKeyPrefix}.statsTableColumns`;
  const sizeKey = `${storageKeyPrefix}.statsTableSize`;

  const [columnsVisible, setColumnsVisible] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(columnsKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        const out: Record<string, boolean> = {};
        COLUMN_OPTIONS.forEach(({ key }) => { out[key] = parsed[key] !== false; });
        return out;
      }
    } catch (_) {}
    return Object.fromEntries(COLUMN_OPTIONS.map(({ key }) => [key, true]));
  });

  const [tableSize, setTableSize] = useState<TableSize>(() => {
    try {
      const raw = localStorage.getItem(sizeKey);
      if (raw === 'small' || raw === 'middle' || raw === 'large') return raw;
    } catch (_) {}
    return 'small';
  });

  const persistColumns = (next: Record<string, boolean>) => {
    setColumnsVisible(next);
    try { localStorage.setItem(columnsKey, JSON.stringify(next)); } catch (_) { /* ignore */ }
  };

  const persistSize = (size: TableSize) => {
    setTableSize(size);
    try { localStorage.setItem(sizeKey, size); } catch (_) { /* ignore */ }
  };

  const tableColumnsConfig = useMemo(() => {
    const cols: Array<{
      key: string;
      title: string;
      dataIndex: string;
      width: number;
      align?: 'left' | 'right' | 'center';
      fixed?: 'left' | 'right';
      ellipsis?: boolean;
      sorter?: (a: any, b: any) => number;
      render: (value: any, record: any) => React.ReactNode;
    }> = [
      {
        key: 'vehicle_id',
        title: '车辆',
        dataIndex: 'vehicle_id',
        width: 100,
        fixed: 'left',
        sorter: (a, b) => a.vehicle_id.localeCompare(b.vehicle_id),
        render: (value: string, record: any) => (
          <Space>
            <span>{value}</span>
            {record.is_rest ? <Tag color="warning">休息</Tag> : !record.has_income && <Tag color="default">未录入</Tag>}
            {record.has_income && record.is_overtime && <Tag color="orange">加班</Tag>}
          </Space>
        ),
      },
      { key: 'conductor_id', title: '服务员', dataIndex: 'conductor_id', width: 100, fixed: 'left', render: (v: string | null) => v || '-' },
      { key: 'turn_total', title: '现金收入', dataIndex: 'turn_total', width: 100, align: 'right', sorter: (a, b) => (a.turn_total ?? 0) - (b.turn_total ?? 0), render: (value: number, record: any) => (record.has_income && value != null ? formatAmount(value) : '') },
      { key: 'wechat_amount', title: '微信收入', dataIndex: 'wechat_amount', width: 100, align: 'right', sorter: (a, b) => (a.wechat_amount ?? 0) - (b.wechat_amount ?? 0), render: (value: number, record: any) => (record.has_income && value != null ? formatAmount(value) : '') },
      { key: 'revenue', title: '营业额', dataIndex: 'revenue', width: 120, align: 'right', sorter: (a, b) => a.revenue - b.revenue, render: (value: number) => (value > 0 ? formatAmount(value) : '') },
      { key: 'fuel_subsidy', title: '补油款', dataIndex: 'fuel_subsidy', width: 100, align: 'right', sorter: (a, b) => (a.fuel_subsidy ?? 0) - (b.fuel_subsidy ?? 0), render: (value: number, record: any) => (record.has_income && value != null && value !== 0 ? formatAmount(value) : '') },
      {
        key: 'reward_penalty',
        title: '奖罚',
        dataIndex: 'reward_penalty',
        width: 100,
        align: 'right',
        sorter: (a, b) => (a.reward_penalty ?? 0) - (b.reward_penalty ?? 0),
        render: (value: number, record: any) => {
          if (!record.has_income || value == null || value === 0) return '';
          const color = value > 0 ? '#52c41a' : '#ff4d4f';
          return <span style={{ color }}>{value > 0 ? '+' : ''}{formatAmount(value)}</span>;
        },
      },
      { key: 'net_income', title: '实际分配金额', dataIndex: 'net_income', width: 120, align: 'right', sorter: (a, b) => a.net_income - b.net_income, render: (value: number) => (value > 0 ? formatAmount(value) : '') },
      { key: 'turn_count', title: '转数', dataIndex: 'turn_count', width: 80, align: 'center', sorter: (a, b) => a.turn_count - b.turn_count, render: (value: number, record: any) => (!record.has_income ? '-' : value > 0 ? value.toString() : '') },
      { key: 'turn1_amount', title: '第1转', dataIndex: 'turn1_amount', width: 90, align: 'right', sorter: (a, b) => (a.turn1_amount ?? 0) - (b.turn1_amount ?? 0), render: (value: number, record: any) => (record.has_income && value != null && value !== 0 ? formatAmount(value) : '') },
      { key: 'turn2_amount', title: '第2转', dataIndex: 'turn2_amount', width: 90, align: 'right', sorter: (a, b) => (a.turn2_amount ?? 0) - (b.turn2_amount ?? 0), render: (value: number, record: any) => (record.has_income && value != null && value !== 0 ? formatAmount(value) : '') },
      { key: 'turn3_amount', title: '第3转', dataIndex: 'turn3_amount', width: 90, align: 'right', sorter: (a, b) => (a.turn3_amount ?? 0) - (b.turn3_amount ?? 0), render: (value: number, record: any) => (record.has_income && value != null && value !== 0 ? formatAmount(value) : '') },
      { key: 'turn4_amount', title: '第4转', dataIndex: 'turn4_amount', width: 90, align: 'right', sorter: (a, b) => (a.turn4_amount ?? 0) - (b.turn4_amount ?? 0), render: (value: number, record: any) => (record.has_income && value != null && value !== 0 ? formatAmount(value) : '') },
      { key: 'turn5_amount', title: '第5转', dataIndex: 'turn5_amount', width: 90, align: 'right', sorter: (a, b) => (a.turn5_amount ?? 0) - (b.turn5_amount ?? 0), render: (value: number, record: any) => (record.has_income && value != null && value !== 0 ? formatAmount(value) : '') },
      { key: 'remark', title: '备注', dataIndex: 'remark', width: 140, ellipsis: true, render: (value: string | null | undefined, record: any) => (record.has_income && value ? value : '') },
      {
        key: 'payment_amount',
        title: '收付款',
        dataIndex: 'payment_amount',
        width: 120,
        align: 'right',
        fixed: 'right',
        sorter: (a, b) => a.payment_amount - b.payment_amount,
        render: (value: number) => {
          if (value === 0) return <span style={{ color: '#999' }}>0</span>;
          const color = value > 0 ? '#52c41a' : '#ff4d4f';
          return <span style={{ color, fontWeight: 'bold' }}>{value > 0 ? '+' : ''}{formatAmount(value)}</span>;
        },
      },
      { key: 'vehicle_id_right', title: '车辆', dataIndex: 'vehicle_id', width: 100, fixed: 'right', render: (value: string) => value },
    ];
    return cols;
  }, [formatAmount]);

  const tableColumns = useMemo(() => {
    return tableColumnsConfig
      .filter((col) => columnsVisible[col.key] !== false)
      .map(({ key, title, dataIndex, width, align, fixed, ellipsis, sorter, render }) => ({
        key,
        title,
        dataIndex,
        width,
        align: align as 'left' | 'right' | 'center' | undefined,
        fixed,
        ellipsis,
        sorter,
        render,
      }));
  }, [tableColumnsConfig, columnsVisible]);

  const scrollX = useMemo(() => tableColumns.reduce((sum, c) => sum + (c.width ?? 0), 0), [tableColumns]);

  const handleExport = async () => {
    if (!data) {
      messageApi.warning('暂无统计数据可导出');
      return;
    }
    const WorkbookClass = getExcelJSWorkbook();
    if (!WorkbookClass) {
      messageApi.error('导出库加载失败，请刷新后重试');
      return;
    }
    const wb = new WorkbookClass();
    const { statistics } = data;
    const pendingCount = Math.max(0, statistics.total_vehicle_count - statistics.rest_vehicle_count - statistics.vehicle_count);
    const sheet = wb.addWorksheet('日收入统计', { views: [{ rightToLeft: false }] });

    const headerFill: ExcelFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    const overviewTitleFill: ExcelFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
    const overviewTitleFont = { bold: true, size: 12 };
    const overviewLabelFont = { bold: true, size: 10 };
    const restRowFill: ExcelFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    const alignLeft = { horizontal: 'left' as const, vertical: 'middle' as const };
    const alignCenter = { horizontal: 'center' as const, vertical: 'middle' as const };
    const fontGreen = { color: { argb: 'FF00B050' } };
    const fontRed = { color: { argb: 'FFFF0000' } };
    const rowHeight = 21;

    sheet.addRow(['统计概览']);
    const overviewTitleRow = sheet.lastRow!;
    overviewTitleRow.height = rowHeight;
    overviewTitleRow.getCell(1).fill = overviewTitleFill;
    overviewTitleRow.getCell(1).font = overviewTitleFont;
    overviewTitleRow.getCell(1).alignment = alignLeft;

    sheet.addRow(['日期', statistics.date]);
    const rDate = sheet.lastRow!;
    rDate.height = rowHeight;
    rDate.getCell(1).font = overviewLabelFont;
    rDate.getCell(1).alignment = alignLeft;
    rDate.getCell(2).alignment = alignLeft;

    sheet.addRow(['总营业额', formatAmount(statistics.total_revenue), '实际分配', formatAmount(statistics.total_net_income)]);
    const rTotal = sheet.lastRow!;
    rTotal.height = rowHeight;
    [1, 2, 3, 4].forEach((i) => { rTotal.getCell(i).alignment = alignLeft; });
    rTotal.getCell(1).font = overviewLabelFont;
    rTotal.getCell(3).font = overviewLabelFont;

    sheet.addRow(['均营业额', formatAmount(statistics.average_revenue), '均净收', formatAmount(statistics.average_net_income)]);
    const rAvg = sheet.lastRow!;
    rAvg.height = rowHeight;
    [1, 2, 3, 4].forEach((i) => { rAvg.getCell(i).alignment = alignLeft; });
    rAvg.getCell(1).font = overviewLabelFont;
    rAvg.getCell(3).font = overviewLabelFont;

    sheet.addRow(['在册车辆', statistics.total_vehicle_count, '已录入', statistics.vehicle_count, '待录入', pendingCount, '休息', statistics.rest_vehicle_count]);
    const rOther = sheet.lastRow!;
    rOther.height = rowHeight;
    [1, 2, 3, 4, 5, 6, 7, 8].forEach((i) => { rOther.getCell(i).alignment = alignLeft; });
    rOther.getCell(1).font = overviewLabelFont;
    rOther.getCell(3).font = overviewLabelFont;
    rOther.getCell(5).font = overviewLabelFont;
    rOther.getCell(7).font = overviewLabelFont;
    sheet.addRow([]);

    const detailCols = tableColumnsConfig.filter((c) => c.key !== 'vehicle_id_right');
    const shortTitle: Record<string, string> = { net_income: '净收' };
    const exportTitle = (title: string, key: string) => (key === 'vehicle_id' ? '车号' : (title.length > 5 ? (shortTitle[key] ?? title) : title));
    const detailHeaders = [...detailCols.map((c) => exportTitle(c.title, c.key)), '状态'];
    const rewardPenaltyColIndex = detailCols.findIndex((c) => c.key === 'reward_penalty');
    const paymentAmountColIndex = detailCols.findIndex((c) => c.key === 'payment_amount');

    const headerRow = sheet.addRow(detailHeaders);
    headerRow.height = rowHeight;
    for (let i = 0; i <= detailCols.length; i++) {
      const cell = headerRow.getCell(i + 1);
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = alignCenter;
    }

    const vehicles = data.vehicles || [];
    const amountKeys = new Set(['turn_total', 'wechat_amount', 'revenue', 'fuel_subsidy', 'reward_penalty', 'net_income', 'payment_amount', 'turn1_amount', 'turn2_amount', 'turn3_amount', 'turn4_amount', 'turn5_amount']);
    vehicles.forEach((row: any) => {
      const statusText = [row.is_rest ? '休息' : '', !row.has_income && !row.is_rest ? '未录入' : '', row.has_income && row.is_overtime ? '加班' : ''].filter(Boolean).join(' ');
      const cells: (string | number)[] = [];
      detailCols.forEach((col) => {
        if (col.key === 'vehicle_id') { cells.push(row.vehicle_id); return; }
        const v = row[col.dataIndex];
        if (col.dataIndex === 'conductor_id') { cells.push(v || '-'); return; }
        if (col.dataIndex === 'turn_count') { cells.push(!row.has_income ? '-' : (v > 0 ? String(v) : '')); return; }
        if (col.dataIndex === 'remark') { cells.push(row.has_income && v ? String(v) : ''); return; }
        if (amountKeys.has(col.key) && typeof v === 'number') {
          if (!row.has_income && col.key !== 'payment_amount') { cells.push(''); return; }
          if (col.key === 'reward_penalty' && v !== 0) { cells.push((v > 0 ? '+' : '') + formatAmount(v)); return; }
          if (v === 0 && col.key !== 'payment_amount') { cells.push(''); return; }
          cells.push(formatAmount(v));
          return;
        }
        cells.push(v != null && v !== '' ? (typeof v === 'number' ? v : String(v)) : '');
      });
      cells.push(statusText);
      const dataRow = sheet.addRow(cells);
      dataRow.height = rowHeight;
      const numCols = detailCols.length + 1;
      for (let i = 0; i < numCols; i++) dataRow.getCell(i + 1).alignment = alignCenter;
      if (row.is_rest) for (let i = 0; i < numCols; i++) dataRow.getCell(i + 1).fill = restRowFill;
      if (rewardPenaltyColIndex >= 0 && row.reward_penalty != null && row.reward_penalty !== 0) {
        dataRow.getCell(rewardPenaltyColIndex + 1).font = row.reward_penalty > 0 ? fontGreen : fontRed;
      }
      if (paymentAmountColIndex >= 0 && row.payment_amount != null && row.payment_amount !== 0) {
        dataRow.getCell(paymentAmountColIndex + 1).font = row.payment_amount > 0 ? fontGreen : fontRed;
      }
    });

    const colWidths = [8, 6.8, 7.6, 7.6, ...Array(10).fill(7.1), 10, 9.2, 9.2];
    sheet.columns = colWidths.map((w) => ({ width: w }));

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `日收入统计_${exportDate ?? statistics.date}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    messageApi.success('导出成功');
  };

  return (
    <Card loading={loading}>
      {data ? (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Card
            size="small"
            style={{ backgroundColor: '#fafafa' }}
            extra={showExport && (
              <Button type="primary" size="small" icon={<DownloadOutlined />} onClick={handleExport}>
                导出
              </Button>
            )}
          >
            <Row gutter={24}>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>总营业额</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1677ff' }}>{formatAmount(data.statistics.total_revenue)} 元</div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>总实际分配金额</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>{formatAmount(data.statistics.total_net_income)} 元</div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>平均营业额</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#722ed1' }}>{formatAmount(data.statistics.average_revenue)} 元</div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>平均实际分配金额</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fa8c16' }}>{formatAmount(data.statistics.average_net_income)} 元</div>
                </div>
              </Col>
            </Row>
            <div style={{ marginTop: '16px', textAlign: 'center', color: '#999', fontSize: '12px' }}>
              共 {data.statistics.total_vehicle_count} 辆在册车辆，已录入 {data.statistics.vehicle_count} 辆，待录入 {Math.max(0, data.statistics.total_vehicle_count - data.statistics.rest_vehicle_count - data.statistics.vehicle_count)} 辆，休息 {data.statistics.rest_vehicle_count} 辆
            </div>
            <div style={{ marginTop: '8px', textAlign: 'center', color: '#999', fontSize: '11px' }}>
              营业额=5转收入+微信收入；实际分配金额=营业额−补油款+奖罚
            </div>
          </Card>

          {data.vehicles && data.vehicles.length > 0 ? (
            <Card
              title="车辆收入详情"
              size="small"
              extra={
                <Space>
                  <Dropdown
                    trigger={['click']}
                    popupRender={() => (
                      <div style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 6px 16px rgba(0,0,0,0.08)', padding: '12px 16px', minWidth: 180 }}>
                        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>显示列</div>
                        <Checkbox.Group
                          value={COLUMN_OPTIONS.filter(({ key }) => columnsVisible[key] !== false).map(({ key }) => key)}
                          style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                          onChange={(checkedValues) => {
                            const next = { ...columnsVisible };
                            COLUMN_OPTIONS.forEach(({ key }) => { next[key] = (checkedValues as string[]).includes(key); });
                            persistColumns(next);
                          }}
                        >
                          {COLUMN_OPTIONS.map(({ key, label }) => (
                            <Checkbox key={key} value={key}>{label}</Checkbox>
                          ))}
                        </Checkbox.Group>
                      </div>
                    )}
                  >
                    <Button type="text" size="small" icon={<SettingOutlined />}>列显示</Button>
                  </Dropdown>
                  <Dropdown
                    trigger={['click']}
                    popupRender={() => (
                      <div style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 6px 16px rgba(0,0,0,0.08)', padding: '12px 16px', minWidth: 140 }}>
                        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>表格密度</div>
                        <Radio.Group
                          value={tableSize}
                          onChange={(e) => persistSize(e.target.value)}
                          options={[
                            { value: 'small', label: '紧凑' },
                            { value: 'middle', label: '默认' },
                            { value: 'large', label: '宽松' },
                          ]}
                        />
                      </div>
                    )}
                  >
                    <Button type="text" size="small">表格密度</Button>
                  </Dropdown>
                </Space>
              }
            >
              <Table
                rowKey="vehicle_id"
                size={tableSize}
                columns={tableColumns}
                dataSource={data.vehicles}
                pagination={false}
                scroll={{ x: scrollX }}
              />
            </Card>
          ) : (
            <Card title="车辆收入详情" size="small">
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无车辆收入数据</div>
            </Card>
          )}
        </Space>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无统计数据</div>
      )}
    </Card>
  );
}
