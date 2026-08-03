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
      formatter: (params: any) => `${params.value[0]}: ${params.value[2]} elogios`
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
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(148,163,184,0.2)' } }
    },
    yAxis3D: {
      type: 'category',
      name: '',
      data: ['Elogios'],
      axisLabel: { show: false },
      axisLine: { lineStyle: { color: 'rgba(148,163,184,0.2)' } }
    },
    zAxis3D: {
      type: 'value',
      name: '',
      axisLabel: { color: '#94a3b8' },
      axisLine: { lineStyle: { color: 'rgba(148,163,184,0.2)' } }
    },
    grid3D: {
      boxWidth: 200,
      boxDepth: 40,
      viewControl: {
        alpha: 20,
        beta: 30,
        distance: 250,
        autoRotate: true,
        autoRotateSpeed: 5
      },
      light: {
        main: {
          intensity: 1.2,
          shadow: true
        },
        ambient: {
          intensity: 0.3
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
          textStyle: { fontSize: 12, borderWidth: 1 }
        },
        itemStyle: {
          opacity: 0.9
        },
        emphasis: {
          label: {
            textStyle: { fontSize: 16, color: '#fff' }
          },
          itemStyle: {
            color: '#f59e0b'
          }
        }
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: 250, width: '100%' }} />;
}
