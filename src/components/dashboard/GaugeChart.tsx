'use client';
import React from 'react';
import ReactECharts from 'echarts-for-react';

export function GaugeChart() {
  const option = {
    series: [
      {
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        splitNumber: 1,
        itemStyle: {
          color: '#3b82f6',
          shadowColor: 'rgba(59,130,246,0.4)',
          shadowBlur: 10,
          shadowOffsetX: 2,
          shadowOffsetY: 2
        },
        progress: {
          show: true,
          roundCap: true,
          width: 14
        },
        pointer: { show: false },
        axisLine: {
          roundCap: true,
          lineStyle: { width: 14, color: [[1, 'rgba(148,163,184,0.15)']] }
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        title: { show: false },
        detail: { show: false },
        data: [{ value: 82 }]
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: 180, width: '100%', marginTop: '-20px' }} />;
}
