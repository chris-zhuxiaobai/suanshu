import { Typography, Tag, Space } from 'antd';
import dayjs from 'dayjs';
import { Solar, Lunar, HolidayUtil } from 'lunar-javascript';
import { useEffect, useState } from 'react';

interface DateInfoProps {
  date: dayjs.Dayjs;
  title: string;
}

export default function DateInfoCard({ date, title }: DateInfoProps) {
  // 获取星期几
  const getWeekday = (date: dayjs.Dayjs): string => {
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `星期${weekdays[date.day()]}`;
  };

  // 获取农历日期
  const getLunarDate = (date: dayjs.Dayjs): string => {
    try {
      const solar = Solar.fromYmd(date.year(), date.month() + 1, date.date());
      const lunar = solar.getLunar();
      const lunarYear = lunar.getYearInChinese();
      const lunarMonth = lunar.getMonthInChinese();
      const lunarDay = lunar.getDayInChinese();
      return `${lunarYear}年${lunarMonth}${lunarDay}`;
    } catch (error) {
      return '';
    }
  };


  // 判断是否周末
  const isWeekend = (date: dayjs.Dayjs): boolean => {
    const day = date.day();
    return day === 0 || day === 6; // 0是周日，6是周六
  };

  // 获取调休信息和节日
  const [holidayInfo, setHolidayInfo] = useState<{
    isHoliday: boolean;
    isWorkday: boolean;
    name?: string; // 法定假日名称（当isWorkday=false时作为节日显示）
    solarFestivals?: string[]; // 阳历节日列表
    lunarFestivals?: string[]; // 阴历节日列表
  } | null>(null);

  useEffect(() => {
    const getHolidayInfo = async () => {
      try {
        // 获取阳历和阴历节日
        let solarFestivals: string[] = [];
        let lunarFestivals: string[] = [];
        try {
          // 获取阳历节日
          const solar = Solar.fromYmd(date.year(), date.month() + 1, date.date());
          const solarFestivalsList = solar.getFestivals();
          if (solarFestivalsList && solarFestivalsList.length > 0) {
            solarFestivals = solarFestivalsList;
          }
          
          // 获取阴历节日：使用new Date()创建日期对象，然后转换为农历
          const dateObj = new Date(date.year(), date.month(), date.date());
          const solarFromDate = Solar.fromDate(dateObj);
          const lunarFromSolar = solarFromDate.getLunar();
          const lunarYear = lunarFromSolar.getYear();
          const lunarMonth = lunarFromSolar.getMonth();
          const lunarDay = lunarFromSolar.getDay();
          
          const lunar = Lunar.fromYmd(lunarYear, lunarMonth, lunarDay);
          const lunarFestivalsList = lunar.getFestivals();
          
          if (lunarFestivalsList && lunarFestivalsList.length > 0) {
            lunarFestivals = lunarFestivalsList;
          }
        } catch (error) {
          // 静默失败，不影响其他功能
        }

        // 尝试使用lunar-javascript的HolidayUtil获取法定假日
        let holidayData: {
          isHoliday: boolean;
          isWorkday: boolean;
          name?: string;
        } | null = null;

        // 尝试使用lunar-javascript的HolidayUtil获取法定假日
        try {
          if (HolidayUtil && typeof HolidayUtil.getHoliday === 'function') {
            const holiday = HolidayUtil.getHoliday(date.year(), date.month() + 1, date.date());
            if (holiday) {
              // Holiday对象有isRest()和isWork()方法
              const isRest = typeof holiday.isRest === 'function' ? holiday.isRest() : false;
              const isWork = typeof holiday.isWork === 'function' ? holiday.isWork() : true;
              const name = typeof holiday.getName === 'function' ? holiday.getName() : undefined;
              
              holidayData = {
                isHoliday: isRest,
                isWorkday: isWork,
                name: name,
              };
            }
          }
        } catch (error) {
          // HolidayUtil可能不存在或方法不同，静默失败，不影响其他功能
        }

        // 合并数据
        const weekend = isWeekend(date);
        
        // holidayData为空时，肯定不是法定节假日
        // 只有当holidayData存在时，才使用其isHoliday和isWorkday值
        setHolidayInfo({
          isHoliday: holidayData ? holidayData.isHoliday : false,
          isWorkday: holidayData ? holidayData.isWorkday : !weekend,
          // 当isWorkday=false时，name作为节日显示
          name: holidayData?.name && !holidayData.isWorkday ? holidayData.name : undefined,
          solarFestivals: solarFestivals.length > 0 ? solarFestivals : undefined,
          lunarFestivals: lunarFestivals.length > 0 ? lunarFestivals : undefined,
        });
      } catch (error) {
        // 默认值：根据周末判断
        const weekend = isWeekend(date);
        setHolidayInfo({
          isHoliday: weekend,
          isWorkday: !weekend,
        });
      }
    };

    getHolidayInfo();
  }, [date]);

  // 获取工作日状态
  const getWorkdayStatus = (date: dayjs.Dayjs): { isWeekend: boolean; isWorkday: boolean } => {
    const weekend = isWeekend(date);
    return {
      isWeekend: weekend,
      isWorkday: !weekend,
    };
  };

  const weekday = getWeekday(date);
  const lunarDate = getLunarDate(date);
  const workdayStatus = getWorkdayStatus(date);

  return (
    <div style={{ height: '100%' }}>
      <Typography.Title level={5} style={{ marginBottom: 16 }}>
        {title}
      </Typography.Title>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* 日期和星期 */}
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {date.format('YYYY年MM月DD日')}
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: '14px' }}>
            {weekday}
          </Typography.Text>
        </div>

        {/* 农历日期 */}
        {lunarDate && (
          <div>
            <Typography.Text type="secondary">农历：</Typography.Text>
            <Typography.Text>{lunarDate}</Typography.Text>
          </div>
        )}

        {/* 节日信息：合并显示阳历和阴历节日 */}
        {(() => {
          const allFestivals: string[] = [];
          
          // 当isWorkday=false时，添加法定假日名称
          if (holidayInfo?.name && !holidayInfo.isWorkday) {
            allFestivals.push(holidayInfo.name);
          }
          
          // 添加阳历节日
          if (holidayInfo?.solarFestivals && holidayInfo.solarFestivals.length > 0) {
            allFestivals.push(...holidayInfo.solarFestivals);
          }
          
          // 添加阴历节日
          if (holidayInfo?.lunarFestivals && holidayInfo.lunarFestivals.length > 0) {
            allFestivals.push(...holidayInfo.lunarFestivals);
          }
          
          // 去重
          const uniqueFestivals = Array.from(new Set(allFestivals));
          
          if (uniqueFestivals.length > 0) {
            return (
              <div>
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                  节日：
                </Typography.Text>
                <Space wrap size={[4, 4]}>
                  {uniqueFestivals.map((festival, index) => (
                    <Tag key={index} color="orange">
                      {festival}
                    </Tag>
                  ))}
                </Space>
              </div>
            );
          }
          return null;
        })()}

        {/* 日期类型：工作日/节假日/周末 */}
        <div>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
            日期类型：
          </Typography.Text>
          {(() => {
            // 优先判断法定节假日：只有当holidayInfo.isHoliday为true时才是法定节假日
            // holidayData为空时，isHoliday肯定为false，不会显示为节假日
            if (holidayInfo && holidayInfo.isHoliday && !holidayInfo.isWorkday) {
              return <Tag color="red">节假日</Tag>;
            }
            // 其次判断周末：如果是周末且不是调休上班，显示"周末"
            if (workdayStatus.isWeekend && holidayInfo?.isWorkday !== true) {
              return <Tag color="orange">周末</Tag>;
            }
            // 否则显示"工作日"
            return <Tag color="default">工作日</Tag>;
          })()}
        </div>

        {/* 是否调休：仅在需要调休时显示 */}
        {holidayInfo && holidayInfo.isWorkday && (workdayStatus.isWeekend || holidayInfo.isHoliday) && (
          <div>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
              调休：
            </Typography.Text>
            <Tag color="blue">是（需上班）</Tag>
          </div>
        )}
      </Space>
    </div>
  );
}
