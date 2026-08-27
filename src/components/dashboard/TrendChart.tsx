'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

// Dynamically import ApexCharts to avoid SSR issues
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

export function TrendChart() {
  const options: ApexOptions = {
    chart: {
      type: 'area',
      fontFamily: 'inherit',
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
        animateGradually: { enabled: true, delay: 150 },
        dynamicAnimation: { enabled: true, speed: 350 }
      },
      dropShadow: {
        enabled: true,
        color: '#3b82f6',
        top: 18,
        left: 0,
        blur: 5,
        opacity: 0.1
      }
    },
    colors: ['#3b82f6', '#8b5cf6'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 3 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0.05,
        stops: [0, 100],
        colorStops: [
          [
            { offset: 0, color: 'rgba(59,130,246,0.4)', opacity: 1 },
            { offset: 100, color: 'rgba(59,130,246,0.01)', opacity: 1 }
          ],
          [
            { offset: 0, color: 'rgba(139,92,246,0.3)', opacity: 1 },
            { offset: 100, color: 'rgba(139,92,246,0.01)', opacity: 1 }
          ]
        ]
      }
    },
    grid: {
      borderColor: 'rgba(148,163,184,0.1)',
      strokeDashArray: 4,
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: true } }
    },
    xaxis: {
      categories: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
      labels: { style: { colors: '#94a3b8', fontSize: '12px' } },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: [
      {
        min: 3, max: 5,
        labels: { formatter: (v) => v.toFixed(1), style: { colors: '#94a3b8', fontSize: '12px' } }
      },
      {
        opposite: true,
        min: 0, max: 200,
        labels: { style: { colors: '#94a3b8', fontSize: '12px' } }
      }
    ],
    legend: { show: false },
    tooltip: {
      theme: 'dark',
      y: { formatter: (val) => val.toString() }
    }
  };

  const series = [
    { name: 'Nota Média', data: [4.2, 4.3, 4.1, 4.5, 4.4, 4.7] },
    { name: 'Volume', data: [120, 150, 95, 180, 160, 190] }
  ];

  return <Chart options={options} series={series} type="area" height={240} width="100%" />;
}
