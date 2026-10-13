"use client";

import { useId } from "react";
import { Search } from "lucide-react";

export type FilterOption = { value: string; label: string };

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** Visible label for the search field; defaults to the placeholder text. */
  searchLabel?: string;
  filters?: {
    id: string;
    label: string;
    value: string;
    options: FilterOption[];
    onChange: (value: string) => void;
  }[];
  trailing?: React.ReactNode;
};

export default function FilterBar({ search, onSearchChange, searchPlaceholder = "Search…", searchLabel, filters = [], trailing }: Props) {
  const id = useId();
  return (
    <div className="filter-bar" role="search">
      <label className="filter-field filter-field--search" htmlFor={`${id}-search`}>
        <span>{searchLabel ?? searchPlaceholder}</span>
        <span className="filter-search">
          <Search aria-hidden="true" size={16} />
          <input id={`${id}-search`} type="search" name="search" autoComplete="off" spellCheck={false} value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder={searchPlaceholder} />
        </span>
      </label>
      {filters.map((f) => (
        <label key={f.id} className="filter-field" htmlFor={`${id}-${f.id}`}>
          <span>{f.label}</span>
          <select id={`${id}-${f.id}`} name={f.id} value={f.value} onChange={(e) => f.onChange(e.target.value)}>
            {f.options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </label>
      ))}
      {trailing && <div className="filter-trailing">{trailing}</div>}
    </div>
  );
}
