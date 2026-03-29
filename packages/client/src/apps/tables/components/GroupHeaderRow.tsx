import { ChevronRight, ChevronDown } from 'lucide-react';
import type { GroupHeaderRow as GroupHeaderRowType } from '../hooks/use-row-grouping';
import { getTagColor } from '../../../lib/tag-colors';

interface GroupHeaderRendererProps {
  data: GroupHeaderRowType;
  context: {
    toggleGroup?: (groupKey: string) => void;
    groupByColumnType?: string;
  };
}

export function GroupHeaderRenderer({ data, context }: GroupHeaderRendererProps) {
  const { _groupValue, _groupCount, _collapsed, _groupKey, _groupAggregations } = data;
  const { toggleGroup, groupByColumnType } = context;

  const isSelectType = groupByColumnType === 'singleSelect' || groupByColumnType === 'multiSelect';
  const tagColor = isSelectType && _groupValue !== '(empty)' ? getTagColor(_groupValue) : null;

  // Show first aggregation if available
  const aggs = _groupAggregations ? Object.values(_groupAggregations) : [];
  const firstAgg = aggs.length > 0 ? aggs[0] : null;

  return (
    <div
      className="group-header-row"
      onClick={() => toggleGroup?.(_groupKey)}
    >
      <span className="group-header-chevron">
        {_collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </span>
      {tagColor ? (
        <span
          className="tables-cell-tag"
          style={{ background: tagColor.bg, color: tagColor.text }}
        >
          {_groupValue}
        </span>
      ) : (
        <span className="group-header-value">{_groupValue}</span>
      )}
      <span className="group-header-count">({_groupCount})</span>
      {firstAgg && firstAgg.count > 0 && (
        <span className="group-header-agg">
          Sum: {firstAgg.sum} · Avg: {firstAgg.avg}
        </span>
      )}
    </div>
  );
}
