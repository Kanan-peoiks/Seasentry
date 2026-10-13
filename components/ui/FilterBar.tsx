"use client";

import { Search } from "lucide-react";

export type FilterOption = { value: string; label: string };

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: {
    id: string;
    label: string;
    value: string;
    options: FilterOption[];
    onChange: (value: string) => void;
  }[];
  trailing?: React.ReactNode;
};

export default function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  filters = [],
  trailing,
}: Props) {
  const controlStyle: React.CSSProperties = {
    background: "var(--bg-base)",
    border: "1px solid var(--glass-border)",
    borderRadius: 8,
    color: "var(--text-primary)",
    fontSize: 13,
    padding: "8px 12px",
    fontFamily: "inherit",
  };

  return (
    <div className="filter-bar"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "center",
        padding: "12px 14px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--glass-border)",
        borderRadius: 10,
      }}
    >
      <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
        <Search
          aria-hidden="true"
          size={14}
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-tertiary)",
            pointerEvents: "none",
          }}
        />
        <input
          type="search"
          name="search"
          aria-label={searchPlaceholder}
          autoComplete="off"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          style={{
            ...controlStyle,
            width: "100%",
            paddingLeft: 34,
          }}
        />
      </div>

      {filters.map((f) => (
        <label
          key={f.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: "var(--text-secondary)",
          }}
        >
          <span style={{ whiteSpace: "nowrap" }}>{f.label}</span>
          <select
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            style={{
              ...controlStyle,
              minWidth: 130,
              cursor: "pointer",
            }}
          >
            {f.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      ))}

      {trailing && <div style={{ marginLeft: "auto" }}>{trailing}</div>}
    </div>
  );
}
