import { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Filler,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';
import { Bar, Line, Pie, Scatter, Radar, Bubble } from 'react-chartjs-2';
import {
  BarChart3, TrendingUp, PieChart, Activity, Radar as RadarIcon,
  Target, CircleDot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import type { DataRow, Column } from '@/types';
import type { ChartType } from '@/types';
import { CHART_COLORS, getColor, prepareBarChart, prepareLineChart, prepareScatterData, preparePieChart, prepareHistogram, prepareRadarChart, prepareBoxPlotData, prepareBubbleData } from '@/lib/chartData';
import { linearRegression, getCorrelationMatrix } from '@/lib/stats';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, RadialLinearScale, Filler,
  Tooltip, Legend, Title
);

interface Props {
  data: DataRow[];
  columns: Column[];
}

const chartTypes: { id: ChartType; label: string; icon: React.ElementType }[] = [
  { id: 'bar', label: 'Bar', icon: BarChart3 },
  { id: 'line', label: 'Line', icon: TrendingUp },
  { id: 'area', label: 'Area', icon: TrendingUp },
  { id: 'scatter', label: 'Scatter', icon: CircleDot },
  { id: 'pie', label: 'Pie / Donut', icon: PieChart },
  { id: 'histogram', label: 'Histogram', icon: Activity },
  { id: 'radar', label: 'Radar', icon: RadarIcon },
  { id: 'boxplot', label: 'Box Plot', icon: Target },
  { id: 'heatmap', label: 'Correlation', icon: Activity },
  { id: 'bubble', label: 'Bubble', icon: CircleDot },
];

export default function ChartsView({ data, columns }: Props) {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [xCol, setXCol] = useState('');
  const [yCol, setYCol] = useState('');
  const [colorCol, setColorCol] = useState('');
  const [rCol, setRCol] = useState('');
  const [showTrendline, setShowTrendline] = useState(false);

  const numericCols = columns.filter((c) => c.type === 'number');
  const allColNames = columns.map((c) => c.key);

  // Auto-select defaults
  useMemo(() => {
    if (!xCol && allColNames.length > 0) setXCol(allColNames[0]);
    if (!yCol && numericCols.length > 0) setYCol(numericCols[0]?.key || allColNames[0]);
  }, [allColNames.length, numericCols.length]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const, labels: { font: { size: 11 }, boxWidth: 12 } },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: { size: 12 },
        bodyFont: { size: 11 },
        padding: 10,
        cornerRadius: 6,
      },
    },
    scales: {
      x: { grid: { color: 'rgba(148, 163, 184, 0.1)' }, ticks: { font: { size: 11 } } },
      y: { grid: { color: 'rgba(148, 163, 184, 0.1)' }, ticks: { font: { size: 11 } } },
    },
  }), []);

  const renderChart = () => {
    if (!xCol || !yCol) return null;

    switch (chartType) {
      case 'bar': {
        const chartData = prepareBarChart(data, xCol, yCol);
        return <Bar data={chartData} options={chartOptions} />;
      }
      case 'line': {
        const chartData = prepareLineChart(data, xCol, yCol);
        return <Line
          data={{
            labels: chartData.labels,
            datasets: [{
              ...chartData.datasets[0],
              borderColor: CHART_COLORS[0],
              backgroundColor: 'transparent',
              borderWidth: 2,
              tension: 0.1,
              pointRadius: 3,
              pointHoverRadius: 5,
            }],
          }}
          options={chartOptions}
        />;
      }
      case 'area': {
        const chartData = prepareLineChart(data, xCol, yCol);
        return <Line
          data={{
            labels: chartData.labels,
            datasets: [{
              ...chartData.datasets[0],
              borderColor: CHART_COLORS[0],
              backgroundColor: getColor(0, 0.15),
              borderWidth: 2,
              tension: 0.3,
              fill: true,
              pointRadius: 0,
              pointHoverRadius: 4,
            }],
          }}
          options={chartOptions}
        />;
      }
      case 'scatter': {
        const chartData = prepareScatterData(data, xCol, yCol, colorCol || undefined);

        // Add trendline if requested
        if (showTrendline && !colorCol) {
          const nums = data.map((row) => ({
            x: Number(String(row[xCol]).replace(/,/g, '')) || 0,
            y: Number(String(row[yCol]).replace(/,/g, '')) || 0,
          })).filter((p) => !isNaN(p.x) && !isNaN(p.y));

          if (nums.length >= 2) {
            const reg = linearRegression(nums.map((p) => p.x), nums.map((p) => p.y));
            const minX = Math.min(...nums.map((p) => p.x));
            const maxX = Math.max(...nums.map((p) => p.x));
            chartData.datasets.push({
              label: `Trend (R²=${reg.r2.toFixed(3)})`,
              data: [{ x: minX, y: reg.intercept + reg.slope * minX }, { x: maxX, y: reg.intercept + reg.slope * maxX }],
              backgroundColor: '#ef4444',
            });
          }
        }

        return <Scatter
          data={chartData}
          options={{
            ...chartOptions,
            plugins: {
              ...chartOptions.plugins,
              legend: { position: 'bottom' as const, labels: { font: { size: 11 }, boxWidth: 12 } },
            },
            scales: {
              x: { type: 'linear' as const, position: 'bottom', grid: { color: 'rgba(148, 163, 184, 0.1)' }, ticks: { font: { size: 11 } } },
              y: { grid: { color: 'rgba(148, 163, 184, 0.1)' }, ticks: { font: { size: 11 } } },
            },
          }}
        />;
      }
      case 'pie': {
        const pieData = preparePieChart(data, xCol);
        return (
          <div className="flex items-center justify-center h-full">
            <div className="w-full max-w-md">
              <Pie
                data={{
                  labels: pieData.labels,
                  datasets: [{ data: pieData.data, backgroundColor: pieData.colors, borderWidth: 1 }],
                }}
                options={{ ...chartOptions, cutout: '40%' }}
              />
            </div>
          </div>
        );
      }
      case 'histogram': {
        const histData = prepareHistogram(data, xCol, 20);
        return <Bar
          data={{
            labels: histData.labels,
            datasets: [{
              label: 'Frequency',
              data: histData.data,
              backgroundColor: getColor(0, 0.7),
              borderColor: CHART_COLORS[0],
              borderWidth: 1,
            }],
          }}
          options={chartOptions}
        />;
      }
      case 'radar': {
        const radarCols = numericCols.slice(0, 8).map((c) => c.key);
        if (radarCols.length < 3) return <div className="text-center ds-text-tertiary py-10">Need at least 3 numeric columns for radar chart</div>;
        const radarData = prepareRadarChart(data, radarCols);
        return <Radar
          data={radarData}
          options={{
            ...chartOptions,
            scales: {
              r: {
                beginAtZero: true,
                max: 100,
                ticks: { stepSize: 20, font: { size: 10 } },
              },
            },
          }}
        />;
      }
      case 'boxplot': {
        const boxCols = numericCols.slice(0, 10).map((c) => c.key);
        if (boxCols.length === 0) return <div className="text-center ds-text-tertiary py-10">Need numeric columns</div>;

        // Custom box plot using grouped bars
        const boxData = prepareBoxPlotData(data, boxCols);
        const colors = boxCols.map((_, i) => getColor(i, 0.7));

        return <Bar
          data={{
            labels: boxData.labels,
            datasets: [
              {
                label: 'Min → Q1',
                data: boxData.datasets[0].data.map((d) => d.q1 - d.min),
                backgroundColor: colors.map((c) => c.replace(/[^,]+\)/, '0.3)')),
                base: boxData.datasets[0].data.map((d) => d.min),
              },
              {
                label: 'Q1 → Median',
                data: boxData.datasets[0].data.map((d) => d.median - d.q1),
                backgroundColor: colors,
                base: boxData.datasets[0].data.map((d) => d.q1),
              },
              {
                label: 'Median → Q3',
                data: boxData.datasets[0].data.map((d) => d.q3 - d.median),
                backgroundColor: colors.map((c) => c.replace(/[^,]+\)/, '0.5)')),
                base: boxData.datasets[0].data.map((d) => d.median),
              },
              {
                label: 'Q3 → Max',
                data: boxData.datasets[0].data.map((d) => d.max - d.q3),
                backgroundColor: colors.map((c) => c.replace(/[^,]+\)/, '0.3)')),
                base: boxData.datasets[0].data.map((d) => d.q3),
              },
            ],
          }}
          options={{
            ...chartOptions,
            plugins: {
              ...chartOptions.plugins,
              tooltip: {
                callbacks: {
                  label: (ctx: any) => {
                    const d = boxData.datasets[0].data[ctx.dataIndex];
                    return [`Min: ${d.min.toFixed(2)}`, `Q1: ${d.q1.toFixed(2)}`, `Median: ${d.median.toFixed(2)}`, `Q3: ${d.q3.toFixed(2)}`, `Max: ${d.max.toFixed(2)}`];
                  },
                },
              },
            },
          }}
        />;
      }
      case 'heatmap': {
        const numCols = numericCols.map((c) => c.key);
        if (numCols.length < 2) return <div className="text-center ds-text-tertiary py-10">Need at least 2 numeric columns</div>;
        const matrix = getCorrelationMatrix(data, numCols);

        const cellSize = Math.max(40, Math.min(80, 400 / numCols.length));

        return (
          <div className="flex items-center justify-center h-full">
            <div className="overflow-auto">
              <div style={{ display: 'grid', gridTemplateColumns: `auto repeat(${numCols.length}, ${cellSize}px)`, gap: 1 }}>
                <div />
                {numCols.map((c) => (
                  <div key={c} className="text-[10px] font-medium text-center ds-text-secondary truncate px-1" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                    {c}
                  </div>
                ))}
                {numCols.map((row, i) => (
                  <>
                    <div key={`label-${i}`} className="text-[10px] font-medium ds-text-secondary truncate pr-2 flex items-center justify-end">{row}</div>
                    {numCols.map((_, j) => {
                      const v = matrix[i][j];
                      const intensity = Math.abs(v);
                      const r = v < 0 ? Math.round(239 + (16 - 239) * intensity) : Math.round(16 + (239 - 16) * intensity);
                      const g = v < 0 ? Math.round(68 + (68 - 68) * intensity) : Math.round(68 + (68 - 68) * intensity);
                      const b = v < 0 ? Math.round(68 + (229 - 68) * intensity) : Math.round(229 + (229 - 68) * intensity);
                      return (
                        <div
                          key={`${i}-${j}`}
                          className="flex items-center justify-center text-[9px] font-mono font-medium rounded-sm"
                          style={{
                            width: cellSize,
                            height: cellSize,
                            backgroundColor: i === j ? 'rgba(148,163,184,0.15)' : `rgba(${r},${g},${b},${0.15 + intensity * 0.55})`,
                            color: intensity > 0.5 ? 'white' : 'inherit',
                          }}
                          title={`${row} vs ${numCols[j]}: ${v.toFixed(3)}`}
                        >
                          {v.toFixed(2)}
                        </div>
                      );
                    })}
                  </>
                ))}
              </div>
            </div>
          </div>
        );
      }
      case 'bubble': {
        if (!rCol) return <div className="text-center ds-text-tertiary py-10">Select a size column for bubble chart</div>;
        const bubbleData = prepareBubbleData(data, xCol, yCol, rCol);
        return <Bubble
          data={bubbleData}
          options={{
            ...chartOptions,
            scales: {
              x: { type: 'linear' as const, position: 'bottom', grid: { color: 'rgba(148, 163, 184, 0.1)' } },
              y: { grid: { color: 'rgba(148, 163, 184, 0.1)' } },
            },
          }}
        />;
      }
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col overflow-auto">
      {/* Chart Controls */}
      <div className="flex-shrink-0 border-b ds-border-color p-4 space-y-4">
        {/* Chart Type Selection */}
        <div className="flex flex-wrap gap-1.5">
          {chartTypes.map((t) => (
            <Button
              key={t.id}
              variant={chartType === t.id ? 'default' : 'ghost'}
              size="sm"
              className={`text-xs gap-1.5 h-8 ${chartType === t.id ? '' : 'ds-text-secondary'}`}
              onClick={() => setChartType(t.id)}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </Button>
          ))}
        </div>

        {/* Axis Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider ds-text-tertiary">X:</span>
            <Select value={xCol} onValueChange={setXCol}>
              <SelectTrigger className="h-8 text-xs w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allColNames.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider ds-text-tertiary">Y:</span>
            <Select value={yCol} onValueChange={setYCol}>
              <SelectTrigger className="h-8 text-xs w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allColNames.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {(chartType === 'scatter' || chartType === 'bubble') && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider ds-text-tertiary">Group:</span>
              <Select value={colorCol} onValueChange={setColorCol}>
                <SelectTrigger className="h-8 text-xs w-36">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="" className="text-xs">None</SelectItem>
                  {allColNames.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {chartType === 'bubble' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider ds-text-tertiary">Size:</span>
              <Select value={rCol} onValueChange={setRCol}>
                <SelectTrigger className="h-8 text-xs w-36">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {numericCols.map((c) => <SelectItem key={c.key} value={c.key} className="text-xs">{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {chartType === 'scatter' && (
            <Button
              variant={showTrendline ? 'default' : 'ghost'}
              size="sm"
              className="text-xs h-8 gap-1.5"
              onClick={() => setShowTrendline(!showTrendline)}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Trendline
            </Button>
          )}
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 p-4 overflow-auto">
        <Card className="h-full">
          <CardContent className="p-4 h-full">
            <div className="chart-container">
              {renderChart()}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
