import { contentTypes, platforms, contentTypeLabels, platformLabels } from '../lib/labels';
import type { ContentType, Platform } from '../lib/types';

type FilterBarProps = {
  platform: Platform | '';
  contentType: ContentType | '';
  onPlatformChange: (value: Platform | '') => void;
  onContentTypeChange: (value: ContentType | '') => void;
  onClear: () => void;
};

export function FilterBar({
  platform,
  contentType,
  onPlatformChange,
  onContentTypeChange,
  onClear,
}: FilterBarProps) {
  return (
    <div className="filter-bar" aria-label="تصفية المواعيد">
      <label className="filter-field">
        <span>المنصة</span>
        <select value={platform} onChange={(event) => onPlatformChange(event.target.value as Platform | '')}>
          <option value="">كل المنصات</option>
          {platforms.map((item) => <option key={item} value={item}>{platformLabels[item]}</option>)}
        </select>
      </label>
      <label className="filter-field">
        <span>النوع</span>
        <select
          value={contentType}
          onChange={(event) => onContentTypeChange(event.target.value as ContentType | '')}
        >
          <option value="">كل الأنواع</option>
          {contentTypes.map((item) => <option key={item} value={item}>{contentTypeLabels[item]}</option>)}
        </select>
      </label>
      {(platform || contentType) && (
        <button className="button button-quiet button-small filter-clear" type="button" onClick={onClear}>
          مسح الفلاتر
        </button>
      )}
    </div>
  );
}
