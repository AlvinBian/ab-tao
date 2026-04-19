import type {
	BarSeriesOption,
	HeatmapSeriesOption,
	ScatterSeriesOption,
	SunburstSeriesOption,
} from "echarts/charts";
import type {
	CalendarComponentOption,
	DataZoomComponentOption,
	GridComponentOption,
	LegendComponentOption,
	TitleComponentOption,
	TooltipComponentOption,
	VisualMapComponentOption,
} from "echarts/components";
import type { ComposeOption } from "echarts/core";

export type ECOption = ComposeOption<
	| BarSeriesOption
	| HeatmapSeriesOption
	| ScatterSeriesOption
	| SunburstSeriesOption
	| TitleComponentOption
	| TooltipComponentOption
	| GridComponentOption
	| LegendComponentOption
	| CalendarComponentOption
	| VisualMapComponentOption
	| DataZoomComponentOption
>;
