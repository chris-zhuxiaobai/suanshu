import { Typography, Space } from 'antd';
import ApiTest from './components/ApiTest'
import './App.css'

const { Title, Text } = Typography;

function App() {
  return (
    <div style={{ 
      padding: '24px', 
      minHeight: '100vh',
      maxWidth: '1200px',
      margin: '0 auto',
      width: '100%'
    }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }} align="center">
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Title level={2}>算数平台 - 开发环境</Title>
          <Text type="secondary">
            前端开发服务器运行中，代码修改会自动热加载
          </Text>
        </div>
        <ApiTest />
      </Space>
    </div>
  )
}

export default App
