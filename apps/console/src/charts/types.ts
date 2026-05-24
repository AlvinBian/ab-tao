import type {
  BarSeriesOption,
  GaugeSeriesOption,
  GraphSeriesOption,
  HeatmapSeriesOption,
  LineSeriesOption,
  PieSeriesOption,
  RadarSeriesOption,
  SankeySeriesOption,
  ScatterSeriesOption,
  SunburstSeriesOption,
  TreemapSeriesOption,
  TreeSeriesOption,
} from 'echarts/charts'
import type {
  CalendarComponentOption,
  DataZoomComponentOption,
  GridComponentOption,
  LegendComponentOption,
  RadarComponentOption,
  TitleComponentOption,
  TooltipComponentOption,
  VisualMapComponentOption,
} from 'echarts/components'
import type { ComposeOption } from 'echarts/core'

export type ECOption = ComposeOption<
  | BarSeriesOption
  | GaugeSeriesOption
  | GraphSeriesOption
  | HeatmapSeriesOption
  | LineSeriesOption
  | PieSeriesOption
  | RadarSeriesOption
  | SankeySeriesOption
  | ScatterSeriesOption
  | SunburstSeriesOption
  | TreeSeriesOption
  | TreemapSeriesOption
  | TitleComponentOption
  | TooltipComponentOption
  | GridComponentOption
  | LegendComponentOption
  | CalendarComponentOption
  | VisualMapComponentOption
  | DataZoomComponentOption
  | RadarComponentOption
>
