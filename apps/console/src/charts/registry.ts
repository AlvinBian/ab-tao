/**
 * ECharts tree-shake registry — 只註冊用到的圖型，最小化 bundle。
 * 所有圖表元件必須在 main.ts 之前執行此模組（或在第一個使用前 import）。
 */

// 圖型
import {
  BarChart,
  GaugeChart,
  GraphChart,
  HeatmapChart,
  LineChart,
  PieChart,
  RadarChart,
  SankeyChart,
  ScatterChart,
  SunburstChart,
  TreeChart,
  TreemapChart,
} from 'echarts/charts'
// 元件
import {
  CalendarComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

use([
  CanvasRenderer,
  BarChart,
  GaugeChart,
  GraphChart,
  HeatmapChart,
  LineChart,
  PieChart,
  RadarChart,
  SankeyChart,
  ScatterChart,
  SunburstChart,
  TreeChart,
  TreemapChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CalendarComponent,
  VisualMapComponent,
  DataZoomComponent,
  RadarComponent,
])
