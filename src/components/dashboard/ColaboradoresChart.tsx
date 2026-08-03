'use client';
import React from 'react';
import ReactECharts from 'echarts-for-react';
import 'echarts-gl';

export interface ColaboradorRankData {
  nome: string;
  elogios: number;
}

interface ColaboradoresChartProps {
  data?: ColaboradorRankData[];
}

export function ColaboradoresChart({ data }: ColaboradoresChartProps) {
  const chartData = (data && data.length > 0)
    ? data.map(item => [item.nome, 0, item.elogios])
    : [
        ['Ricardo Marçal', 0, 77],
        ['Ana', 0, 19],
        ['Jonatan', 0, 5],
        ['Anne', 0, 4],
        ['Lucas', 0, 4]
      ];

  const categories = chartData.map(item => item[0] as string);
  const maxScore = Math.max(...chartData.map(item => Number(item[2]) || 10), 10);

  const option = {
    tooltip: {
      show: true,
      formatter: (params: any) => `<strong style="font-size:14px;">${params.value[0]}</strong><br/>👏 ${params.value[2]} elogios diretos`
    },
    visualMap: {
      max: maxScore,
      inRange: {
        color: [
          '#3b82f6', // blue
          '#8b5cf6', // purple
          '#10d9a0'  // teal
        ]
      },
      show: false
    },
    xAxis3D: {
      type: 'category',
      name: '',
      data: categories,
      axisLabel: { 
        color: '#334155', 
        fontSize: 13, 
        fontWeight: 'bold',
        interval: 0
      },
      axisLine: { lineStyle: { color: 'rgba(148,163,184,0.3)', width: 2 } }
    },
    yAxis3D: {
      type: 'category',
      name: '',
      data: ['Elogios'],
      axisLabel: { show: false },
      axisLine: { lineStyle: { color: 'rgba(148,163,184,0.3)' } }
    },
    zAxis3D: {
      type: 'value',
      name: '',
      axisLabel: { color: '#64748b', fontSize: 12, fontWeight: 'bold' },
      axisLine: { lineStyle: { color: 'rgba(148,163,184,0.3)', width: 2 } }
    },
    grid3D: {
      boxWidth: 280,
      boxHeight: 140,
      boxDepth: 60,
      viewControl: {
        alpha: 22,
        beta: 32,
        distance: 180,
        autoRotate: true,
        autoRotateSpeed: 4
      },
      light: {
        main: {
          intensity: 1.3,
          shadow: true
        },
        ambient: {
          intensity: 0.4
        }
      }
    },
    series: [
      {
        type: 'bar3D',
        data: chartData.map(item => ({
          name: item[0],
          value: [item[0], item[1], item[2]]
        })),
        shading: 'realistic',
        label: {
          show: true,
          formatter: (params: any) => params.value[2].toString(),
          textStyle: { fontSize: 14, fontWeight: 'bold', color: '#10b981', borderWidth: 1 }
        },
        itemStyle: {
          opacity: 0.95
        },
        emphasis: {
          label: {
            textStyle: { fontSize: 18, color: '#fff', fontWeight: 'bold' }
          },
          itemStyle: {
            color: '#f59e0b'
          }
        }
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: 440, width: '100%' }} />;
}
