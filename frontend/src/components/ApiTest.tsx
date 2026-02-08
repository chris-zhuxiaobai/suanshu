import { useState } from 'react';
import {
  Card,
  Button,
  Typography,
  Space,
  Spin,
  Alert,
  Descriptions,
  Tag,
  Divider,
  List,
} from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import api, { ApiError } from '../utils/api';

const { Title, Text } = Typography;

interface ApiResponse {
  message: string;
  time: string;
}

interface TestResult {
  status: 'idle' | 'loading' | 'success' | 'error';
  data?: ApiResponse;
  error?: string;
  timestamp?: string;
  duration?: number; // 请求耗时（毫秒）
}

/**
 * API 连通性测试组件
 * 使用 Ant Design 组件，提供美观的 UI
 */
export default function ApiTest() {
  const [result, setResult] = useState<TestResult>({ status: 'idle' });
  const [endpoint] = useState('/test'); // 注意：不需要 /api 前缀，api.ts 会自动添加

  const testConnection = async () => {
    setResult({ status: 'loading' });

    try {
      const startTime = Date.now();
      
      // 使用统一的 API 客户端
      // 会自动添加认证 token、统一错误处理等
      const data = await api.get<ApiResponse>(endpoint);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      setResult({
        status: 'success',
        data,
        timestamp: new Date().toLocaleTimeString('zh-CN'),
        duration,
      });
    } catch (error) {
      // 统一的错误处理
      if (error instanceof ApiError) {
        setResult({
          status: 'error',
          error: `${error.message} (状态码: ${error.status})`,
          timestamp: new Date().toLocaleTimeString('zh-CN'),
        });
      } else {
        setResult({
          status: 'error',
          error: error instanceof Error ? error.message : '未知错误',
          timestamp: new Date().toLocaleTimeString('zh-CN'),
        });
      }
    }
  };

  return (
    <Card
      style={{ maxWidth: 800, margin: '0 auto' }}
      title={
        <Space>
          <ApiOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <Title level={4} style={{ margin: 0 }}>
            后端连通性测试
          </Title>
        </Space>
      }
      extra={
        <Tag color="blue">
          <Text code>/api{endpoint}</Text>
        </Tag>
      }
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 测试按钮 */}
        <Button
          type="primary"
          size="large"
          icon={<ThunderboltOutlined />}
          onClick={testConnection}
          loading={result.status === 'loading'}
          block
        >
          {result.status === 'loading' ? '测试中...' : '开始测试'}
        </Button>

        {/* 加载状态 */}
        {result.status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" tip="正在连接后端服务器..." />
          </div>
        )}

        {/* 成功状态 */}
        {result.status === 'success' && result.data && (
          <Alert
            message="连接成功！"
            description="后端服务响应正常"
            type="success"
            icon={<CheckCircleOutlined />}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* 错误状态 */}
        {result.status === 'error' && (
          <Alert
            message="连接失败"
            description={result.error}
            type="error"
            icon={<CloseCircleOutlined />}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* 结果显示 */}
        {result.status !== 'idle' && result.status !== 'loading' && (
          <>
            <Divider orientation="left">响应详情</Divider>
            
            {result.status === 'success' && result.data && (
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="消息">
                  <Text strong>{result.data.message}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="服务器时间">
                  <Text code>{result.data.time}</Text>
                </Descriptions.Item>
                {result.timestamp && (
                  <Descriptions.Item label="测试时间">
                    <Text>{result.timestamp}</Text>
                  </Descriptions.Item>
                )}
                {result.duration && (
                  <Descriptions.Item label="响应时间">
                    <Tag color="green">{result.duration}ms</Tag>
                  </Descriptions.Item>
                )}
              </Descriptions>
            )}

            {result.status === 'error' && (
              <>
                {result.timestamp && (
                  <Descriptions bordered column={1} size="small">
                    <Descriptions.Item label="测试时间">
                      <Text>{result.timestamp}</Text>
                    </Descriptions.Item>
                  </Descriptions>
                )}
                
                <Divider orientation="left">排查建议</Divider>
                <List
                  size="small"
                  dataSource={[
                    '检查后端服务是否正常运行',
                    '确认 Nginx 配置是否正确',
                    '查看浏览器控制台的网络请求详情',
                    '检查后端容器日志: docker logs suanshu-app',
                  ]}
                  renderItem={(item) => (
                    <List.Item>
                      <Text type="secondary">{item}</Text>
                    </List.Item>
                  )}
                />
              </>
            )}

            {/* 重新测试按钮 */}
            <Button
              icon={<ReloadOutlined />}
              onClick={testConnection}
              block
            >
              重新测试
            </Button>
          </>
        )}

        {/* 提示信息 */}
        {result.status === 'idle' && (
          <Alert
            message="提示"
            description="点击上方按钮开始测试后端 API 连通性。测试将自动添加认证 token 并统一处理错误响应。"
            type="info"
            showIcon
          />
        )}
      </Space>
    </Card>
  );
}
