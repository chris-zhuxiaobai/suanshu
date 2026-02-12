import { Button, Modal, Space } from 'antd';
import { CalculatorOutlined } from '@ant-design/icons';
import { useState } from 'react';

interface CalculatorModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CalculatorModal({ open, onClose }: CalculatorModalProps) {
  const [display, setDisplay] = useState<string>('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);

  const handleNumber = (num: string) => {
    if (waitingForNewValue) {
      setDisplay(num);
      setWaitingForNewValue(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const handleOperation = (op: string) => {
    const currentValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(currentValue);
    } else if (operation) {
      const result = calculate(previousValue, currentValue, operation);
      setDisplay(String(result));
      setPreviousValue(result);
    }

    setWaitingForNewValue(true);
    setOperation(op);
  };

  const calculate = (prev: number, current: number, op: string): number => {
    switch (op) {
      case '+':
        return Math.floor((prev + current) * 10) / 10;
      case '-':
        return Math.floor((prev - current) * 10) / 10;
      case '*':
        return Math.floor((prev * current) * 10) / 10;
      case '/':
        return current === 0 ? 0 : Math.floor((prev / current) * 10) / 10;
      default:
        return current;
    }
  };

  const handleEquals = () => {
    if (previousValue !== null && operation) {
      const currentValue = parseFloat(display);
      const result = calculate(previousValue, currentValue, operation);
      setDisplay(String(result));
      setPreviousValue(null);
      setOperation(null);
      setWaitingForNewValue(true);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForNewValue(false);
  };

  const handleDecimal = () => {
    if (waitingForNewValue) {
      setDisplay('0.');
      setWaitingForNewValue(false);
    } else if (display.indexOf('.') === -1) {
      setDisplay(display + '.');
    }
  };

  const buttonStyle: React.CSSProperties = {
    width: '70px',
    height: '64px',
    fontSize: '20px',
    fontWeight: 'bold',
  };

  return (
    <Modal
      title="计算器"
      open={open}
      onCancel={onClose}
      footer={null}
      width={360}
      style={{ top: 100 }}
      zIndex={9999}
    >
      <div style={{ padding: '16px 0' }}>
        {/* 显示屏 */}
        <div
          style={{
            width: '100%',
            height: '70px',
            backgroundColor: '#f5f5f5',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 20px',
            fontSize: '28px',
            fontWeight: 'bold',
            marginBottom: '20px',
            fontFamily: 'monospace',
          }}
        >
          {display}
        </div>

        {/* 按钮区域 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* 第一行：清除（占满整行） */}
          <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
            <Button style={{ ...buttonStyle, flex: 1 }} onClick={handleClear}>
              C
            </Button>
            <Button style={{ ...buttonStyle, flex: 1 }} onClick={() => handleOperation('/')}>
              ÷
            </Button>
            <Button style={{ ...buttonStyle, flex: 1 }} onClick={() => handleOperation('*')}>
              ×
            </Button>
            <Button style={{ ...buttonStyle, flex: 1 }} onClick={() => handleOperation('-')}>
              −
            </Button>
          </div>

          {/* 第二行：7 8 9 + */}
          <div style={{ display: 'flex', gap: '10px', position: 'relative' }}>
            <Button style={buttonStyle} onClick={() => handleNumber('7')}>
              7
            </Button>
            <Button style={buttonStyle} onClick={() => handleNumber('8')}>
              8
            </Button>
            <Button style={buttonStyle} onClick={() => handleNumber('9')}>
              9
            </Button>
            <Button
              style={{
                ...buttonStyle,
                height: '138px',
                position: 'absolute',
                right: 0,
                backgroundColor: '#13c2c2',
                borderColor: '#13c2c2',
                color: '#fff',
              }}
              onClick={() => handleOperation('+')}
            >
              +
            </Button>
          </div>

          {/* 第三行：4 5 6 */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button style={buttonStyle} onClick={() => handleNumber('4')}>
              4
            </Button>
            <Button style={buttonStyle} onClick={() => handleNumber('5')}>
              5
            </Button>
            <Button style={buttonStyle} onClick={() => handleNumber('6')}>
              6
            </Button>
            <div style={{ width: '70px' }} /> {/* 占位，对齐 + 号 */}
          </div>

          {/* 第四行：1 2 3 = */}
          <div style={{ display: 'flex', gap: '10px', position: 'relative' }}>
            <Button style={buttonStyle} onClick={() => handleNumber('1')}>
              1
            </Button>
            <Button style={buttonStyle} onClick={() => handleNumber('2')}>
              2
            </Button>
            <Button style={buttonStyle} onClick={() => handleNumber('3')}>
              3
            </Button>
            <Button
              style={{
                ...buttonStyle,
                height: '138px',
                position: 'absolute',
                right: 0,
                backgroundColor: '#13c2c2',
                borderColor: '#13c2c2',
                color: '#fff',
              }}
              onClick={handleEquals}
            >
              =
            </Button>
          </div>

          {/* 第五行：0 . */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button style={{ ...buttonStyle, width: '138px' }} onClick={() => handleNumber('0')}>
              0
            </Button>
            <Button style={buttonStyle} onClick={handleDecimal}>
              .
            </Button>
            <div style={{ width: '70px' }} /> {/* 占位，对齐 = 号 */}
          </div>
        </div>
      </div>
    </Modal>
  );
}
