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
  const rawList = (data && data.length > 0)
    ? data
    : [
        { nome: 'Ricardo Marçal', elogios: 77 },
        { nome: 'Ana', elogios: 19 },
        { nome: 'Jonatan', elogios: 5 },
        { nome: 'Anne', elogios: 4 },
        { nome: 'Lucas', elogios: 4 }
      ];

  const chartData = rawList.map(item => [item.nome, 0, item.elogios]);
  const categories = chartData.map(item => item[0] as string);
  const maxScore = Math.max(...rawList.map(item => item.elogios || 10), 10);

  const option = {
    tooltip: {
      show: true,
      formatter: (params: any) => `<strong style="font-size:14px; color:#1e293b;">${params.value[0]}</strong><br/><span style="color:#10b981; font-weight:700;">👏 ${params.value[2]} elogios diretos</span>`
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
        color: '#1e293b', 
        fontSize: 13, 
        fontWeight: '700',
        interval: 0
      },
      axisLine: { lineStyle: { color: 'rgba(148,163,184,0.4)', width: 2 } }
    },
    yAxis3D: {
      type: 'category',
      name: '',
      data: ['Elogios'],
      axisLabel: { show: false },
      axisLine: { lineStyle: { color: 'rgba(148,163,184,0.4)' } }
    },
    zAxis3D: {
      type: 'value',
      name: '',
      axisLabel: { color: '#475569', fontSize: 12, fontWeight: 'bold' },
      axisLine: { lineStyle: { color: 'rgba(148,163,184,0.4)', width: 2 } }
    },
    grid3D: {
      boxWidth: 380,
      boxHeight: 200,
      boxDepth: 70,
      viewControl: {
        alpha: 22,
        beta: 28,
        distance: 210,
        autoRotate: true,
        autoRotateSpeed: 4
      },
      light: {
        main: {
          intensity: 1.4,
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
          textStyle: { fontSize: 15, fontWeight: '800', color: '#10b981', borderWidth: 1 }
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '16px' }}>
      {/* 🏆 MINI LEADERBOARD EM CARDS SUPERIORES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginTop: '12px' }}>
        {rawList.map((col, idx) => {
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
          const badgeBg = idx === 0 ? '#dcfce7' : idx === 1 ? '#eff6ff' : '#f8fafc';
          const badgeBorder = idx === 0 ? '#86efac' : idx === 1 ? '#bfdbfe' : '#e2e8f0';
          const textColor = idx === 0 ? '#15803d' : idx === 1 ? '#1d4ed8' : '#334155';

          return (
            <div 
              key={idx} 
              style={{ 
                background: badgeBg, 
                border: `1px solid ${badgeBorder}`, 
                borderRadius: '10px', 
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                alignItems: 'center',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>{medal} Rank</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                {col.nome}
              </div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#16a34a', marginTop: '2px' }}>
                {col.elogios} 👏
              </div>
            </div>
          );
        })}
      </div>

      {/* 📊 GRÁFICO 3D EXPANDIDO PREENCHENDO A ÁREA */}
      <div style={{ width: '100%', marginTop: '4px' }}>
        <ReactECharts option={option} style={{ height: 480, width: '100%' }} />
      </div>
    </div>
  );
}
