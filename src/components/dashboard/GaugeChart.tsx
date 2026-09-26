'use client';
import React from 'react';
import { useChartTheme } from '@/hooks/useChartTheme';
import ReactECharts from 'echarts-for-react';

interface GaugeChartProps {
  score?: number;
}

export function GaugeChart({ score = 85 }: GaugeChartProps) {
  const ct = useChartTheme();
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
          lineStyle: { width: 14, color: ct.gaugeTrackColor as any }
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        title: { show: false },
        detail: { show: false },
        data: [{ value: score }]
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: 180, width: '100%', marginTop: '-20px' }} />;
}
