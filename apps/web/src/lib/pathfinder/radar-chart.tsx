'use client';

import { useRef, useEffect } from 'react';
import {
  Chart,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface RadarBenefit {
  label: string;
  current: number;
  target_3m: number;
  target_6m: number;
}

interface RadarChartProps {
  benefits: RadarBenefit[];
  locale: 'ar' | 'en';
  height?: number;
}

export function RadarChart({ benefits, locale, height = 350 }: RadarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const isAr = locale === 'ar';

  useEffect(() => {
    if (!canvasRef.current || benefits.length === 0) return;

    // Destroy previous chart instance before creating new one
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'radar',
      data: {
        labels: benefits.map(b => b.label),
        datasets: [
          {
            label: isAr ? 'الآن' : 'Current',
            data: benefits.map(b => b.current),
            borderColor: '#474099',
            backgroundColor: 'rgba(71, 64, 153, 0.08)',
            borderWidth: 2,
            borderDash: [5, 5],
            pointBackgroundColor: '#474099',
            pointRadius: 4,
          },
          {
            label: isAr ? 'بعد ٣ أشهر' : '3-Month Target',
            data: benefits.map(b => b.target_3m),
            borderColor: '#E4601E',
            backgroundColor: 'rgba(228, 96, 30, 0.1)',
            borderWidth: 2.5,
            pointBackgroundColor: '#E4601E',
            pointRadius: 4,
          },
          {
            label: isAr ? 'بعد ٦ أشهر' : '6-Month Target',
            data: benefits.map(b => b.target_6m),
            borderColor: '#25D366',
            backgroundColor: 'rgba(37, 211, 102, 0.08)',
            borderWidth: 2,
            pointBackgroundColor: '#25D366',
            pointRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 16,
              usePointStyle: true,
              pointStyle: 'circle',
              font: { size: 12 },
            },
          },
        },
        scales: {
          r: {
            min: 0,
            max: 10,
            ticks: {
              stepSize: 2,
              font: { size: 10 },
              backdropColor: 'transparent',
            },
            pointLabels: {
              font: { size: 11 },
              padding: 8,
            },
            grid: { color: 'rgba(0,0,0,0.06)' },
            angleLines: { color: 'rgba(0,0,0,0.06)' },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [benefits, isAr]);

  if (benefits.length === 0) return null;

  return (
    <div style={{ height, position: 'relative' }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
