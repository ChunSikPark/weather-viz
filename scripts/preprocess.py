"""
Preprocessing pipeline: raw simulation CSVs → aggregated JSON data files.

Reads wide-format wind/solar CSVs with 6 metadata header rows,
aggregates by State and ISO region, downsamples to multiple time
granularities, and writes partitioned JSON files for the visualization.
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd

# ── Paths ────────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
MONTHLY_DIR = DATA_DIR / "monthly"
DAILY_DIR = DATA_DIR / "daily"
HOURLY_DIR = DATA_DIR / "hourly"

# States to exclude (non-contiguous US)
EXCLUDE_STATES = {"AK", "HI"}

# Number of metadata rows after the header
N_META_ROWS = 6
META_LABELS = ["ISO", "PV / Wind", "PV / Wind Types", "Gen Max MW", "State", "Utility"]


# ── CSV Parsing ──────────────────────────────────────────────────────────────

def parse_csv(csv_path: str) -> tuple[dict, pd.DataFrame]:
    """
    Parse a simulation CSV into generator metadata and a time series DataFrame.

    Returns:
        metadata: dict mapping column_name → {iso, type, subtype, max_mw, state, utility}
        ts_df:    DataFrame with UTC DatetimeIndex, one column per generator (MW values)
    """
    print(f"Parsing {csv_path}...")

    # Read just the first 7 rows (1 header + 6 metadata)
    meta_df = pd.read_csv(csv_path, nrows=N_META_ROWS, dtype=str)
    gen_columns = meta_df.columns[1:]  # skip DateTimeUTCExcelFormat column

    # Build metadata dict
    metadata = {}
    for col in gen_columns:
        col_stripped = col.strip()
        metadata[col_stripped] = {
            "iso": meta_df.iloc[0][col].strip() if pd.notna(meta_df.iloc[0][col]) else "Unknown",
            "type": meta_df.iloc[1][col].strip() if pd.notna(meta_df.iloc[1][col]) else "",
            "subtype": meta_df.iloc[2][col].strip() if pd.notna(meta_df.iloc[2][col]) else "",
            "max_mw": float(meta_df.iloc[3][col]) if pd.notna(meta_df.iloc[3][col]) else 0.0,
            "state": meta_df.iloc[4][col].strip() if pd.notna(meta_df.iloc[4][col]) else "",
            "utility": meta_df.iloc[5][col].strip() if pd.notna(meta_df.iloc[5][col]) else "",
        }

    # Read time series data (skip the 6 metadata rows)
    ts_df = pd.read_csv(csv_path, skiprows=range(1, N_META_ROWS + 1))
    ts_df.columns = [c.strip() for c in ts_df.columns]

    # Parse timestamps
    time_col = ts_df.columns[0]
    ts_df[time_col] = pd.to_datetime(ts_df[time_col], utc=True)
    ts_df = ts_df.set_index(time_col)
    ts_df.index.name = "timestamp"

    # Convert all generator columns to float
    for col in ts_df.columns:
        ts_df[col] = pd.to_numeric(ts_df[col], errors="coerce")

    # Filter out excluded states
    cols_to_keep = [c for c in ts_df.columns if metadata.get(c, {}).get("state", "") not in EXCLUDE_STATES]
    excluded_count = len(ts_df.columns) - len(cols_to_keep)
    ts_df = ts_df[cols_to_keep]

    # Also remove excluded generators from metadata
    metadata = {k: v for k, v in metadata.items() if v["state"] not in EXCLUDE_STATES}

    print(f"  Loaded {len(ts_df)} timestamps, {len(ts_df.columns)} generators "
          f"(excluded {excluded_count} in AK/HI)")
    return metadata, ts_df


# ── Aggregation ──────────────────────────────────────────────────────────────

def aggregate(metadata: dict, ts_df: pd.DataFrame) -> dict:
    """
    Aggregate generator-level data by State, ISO, and National total.

    Returns dict with keys: 'by_state', 'by_iso', 'national'
    Each contains 'mw' (DataFrame) and 'max_mw' (dict of capacities).
    """
    print("Aggregating...")

    # Group columns by state
    state_groups = {}
    for col, meta in metadata.items():
        if col not in ts_df.columns:
            continue
        state = meta["state"]
        state_groups.setdefault(state, []).append(col)

    # Group columns by ISO (exclude Unknown from ISO aggregation)
    iso_groups = {}
    for col, meta in metadata.items():
        if col not in ts_df.columns:
            continue
        iso = meta["iso"]
        if iso and iso != "Unknown":
            iso_groups.setdefault(iso, []).append(col)

    # Aggregate by state
    state_mw = pd.DataFrame(index=ts_df.index)
    state_max_mw = {}
    for state, cols in sorted(state_groups.items()):
        state_mw[state] = ts_df[cols].sum(axis=1)
        state_max_mw[state] = sum(metadata[c]["max_mw"] for c in cols)

    # Aggregate by ISO
    iso_mw = pd.DataFrame(index=ts_df.index)
    iso_max_mw = {}
    for iso, cols in sorted(iso_groups.items()):
        iso_mw[iso] = ts_df[cols].sum(axis=1)
        iso_max_mw[iso] = sum(metadata[c]["max_mw"] for c in cols)

    # National total
    national_mw = ts_df.sum(axis=1).to_frame("national")
    national_max_mw = sum(m["max_mw"] for m in metadata.values() if m["state"] not in EXCLUDE_STATES)

    print(f"  States: {len(state_groups)}, ISOs: {len(iso_groups)}")

    return {
        "by_state": {"mw": state_mw, "max_mw": state_max_mw},
        "by_iso": {"mw": iso_mw, "max_mw": iso_max_mw},
        "national": {"mw": national_mw, "max_mw": national_max_mw},
    }


# ── Downsampling ─────────────────────────────────────────────────────────────

def downsample(mw_df: pd.DataFrame, freq: str) -> pd.DataFrame:
    """Resample a MW DataFrame to given frequency using mean."""
    return mw_df.resample(freq).mean()


# ── JSON Output ──────────────────────────────────────────────────────────────

def build_json_payload(agg: dict, mw_df_states, mw_df_isos, mw_df_national,
                       energy_type: str, granularity: str, period: str) -> dict:
    """Build the JSON structure per spec 02."""
    def series_to_list(series):
        return [round(v, 4) if not np.isnan(v) else 0.0 for v in series.values]

    def capacity_factor_list(mw_series, max_mw):
        if max_mw <= 0:
            return [0.0] * len(mw_series)
        return [round(v / max_mw, 4) if not np.isnan(v) else 0.0 for v in mw_series.values]

    timestamps = [t.strftime("%Y-%m-%dT%H:%M:%SZ") for t in mw_df_states.index]

    states_dict = {}
    for state in mw_df_states.columns:
        max_mw = agg["by_state"]["max_mw"].get(state, 0)
        states_dict[state] = {
            "mw": series_to_list(mw_df_states[state]),
            "cf": capacity_factor_list(mw_df_states[state], max_mw),
        }

    isos_dict = {}
    for iso in mw_df_isos.columns:
        max_mw = agg["by_iso"]["max_mw"].get(iso, 0)
        isos_dict[iso] = {
            "mw": series_to_list(mw_df_isos[iso]),
            "cf": capacity_factor_list(mw_df_isos[iso], max_mw),
        }

    nat_max = agg["national"]["max_mw"]
    national_dict = {
        "mw": series_to_list(mw_df_national["national"]),
        "cf": capacity_factor_list(mw_df_national["national"], nat_max),
    }

    return {
        "meta": {
            "type": energy_type,
            "granularity": granularity,
            "period": period,
            "generated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
        "timestamps": timestamps,
        "states": states_dict,
        "isos": isos_dict,
        "national": national_dict,
    }


def write_json(payload: dict, filepath: Path):
    """Write JSON payload to file."""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, "w") as f:
        json.dump(payload, f, separators=(",", ":"))
    size_kb = filepath.stat().st_size / 1024
    print(f"  Wrote {filepath.name} ({size_kb:.1f} KB)")


# ── Partitioned Output ───────────────────────────────────────────────────────

def generate_partitioned_files(agg: dict, energy_type: str):
    """Generate monthly, daily, and hourly JSON files from aggregated data."""
    state_mw = agg["by_state"]["mw"]
    iso_mw = agg["by_iso"]["mw"]
    nat_mw = agg["national"]["mw"]

    # Determine year range
    years = sorted(state_mw.index.year.unique())
    now_year = datetime.utcnow().year
    hourly_cutoff_year = now_year - 2  # hourly data for recent 2 years

    print(f"\nGenerating {energy_type} files for years: {years[0]}–{years[-1]}")

    # Monthly files (all years)
    print("  Monthly files...")
    monthly_states = downsample(state_mw, "ME")
    monthly_isos = downsample(iso_mw, "ME")
    monthly_nat = downsample(nat_mw, "ME")

    for year in years:
        mask = monthly_states.index.year == year
        if not mask.any():
            continue
        payload = build_json_payload(
            agg,
            monthly_states[mask], monthly_isos[mask], monthly_nat[mask],
            energy_type, "monthly", str(year),
        )
        write_json(payload, MONTHLY_DIR / f"{energy_type}_monthly_{year}.json")

    # Daily files (all years)
    print("  Daily files...")
    daily_states = downsample(state_mw, "D")
    daily_isos = downsample(iso_mw, "D")
    daily_nat = downsample(nat_mw, "D")

    for year in years:
        mask = daily_states.index.year == year
        if not mask.any():
            continue
        payload = build_json_payload(
            agg,
            daily_states[mask], daily_isos[mask], daily_nat[mask],
            energy_type, "daily", str(year),
        )
        write_json(payload, DAILY_DIR / f"{energy_type}_daily_{year}.json")

    # Hourly files (recent 2 years only, partitioned by month)
    print("  Hourly files...")
    for year in years:
        if year < hourly_cutoff_year:
            continue
        for month in range(1, 13):
            mask = (state_mw.index.year == year) & (state_mw.index.month == month)
            if not mask.any():
                continue
            payload = build_json_payload(
                agg,
                state_mw[mask], iso_mw[mask], nat_mw[mask],
                energy_type, "hourly", f"{year}-{month:02d}",
            )
            write_json(payload, HOURLY_DIR / f"{energy_type}_hourly_{year}_{month:02d}.json")


# ── Manifest ─────────────────────────────────────────────────────────────────

def generate_manifest():
    """Scan data/ directory and build manifest.json."""
    print("\nGenerating manifest.json...")
    manifest = {
        "generated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "files": [],
        "available_states": [],
        "available_isos": [],
        "date_range": {"start": None, "end": None},
    }

    states_set = set()
    isos_set = set()
    min_ts = None
    max_ts = None

    for subdir in ["monthly", "daily", "hourly"]:
        dir_path = DATA_DIR / subdir
        if not dir_path.exists():
            continue
        for filepath in sorted(dir_path.glob("*.json")):
            with open(filepath) as f:
                data = json.load(f)
            meta = data.get("meta", {})
            timestamps = data.get("timestamps", [])
            states_set.update(data.get("states", {}).keys())
            isos_set.update(data.get("isos", {}).keys())

            if timestamps:
                ts_start = timestamps[0]
                ts_end = timestamps[-1]
                if min_ts is None or ts_start < min_ts:
                    min_ts = ts_start
                if max_ts is None or ts_end > max_ts:
                    max_ts = ts_end

            rel_path = f"data/{subdir}/{filepath.name}"
            manifest["files"].append({
                "path": rel_path,
                "type": meta.get("type", ""),
                "granularity": meta.get("granularity", ""),
                "period": meta.get("period", ""),
                "size_kb": round(filepath.stat().st_size / 1024, 1),
            })

    manifest["available_states"] = sorted(states_set)
    manifest["available_isos"] = sorted(isos_set)
    manifest["date_range"] = {"start": min_ts, "end": max_ts}

    manifest_path = DATA_DIR / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"  Wrote manifest.json ({len(manifest['files'])} files)")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Preprocess simulation CSVs into visualization JSON.")
    parser.add_argument("--wind-csv", type=str, help="Path to wind CSV file")
    parser.add_argument("--solar-csv", type=str, help="Path to solar CSV file")
    args = parser.parse_args()

    # Default paths
    wind_csv = args.wind_csv or str(PROJECT_ROOT / "EIA860_wind_ts_results_ISO.csv")
    solar_csv = args.solar_csv or str(PROJECT_ROOT / "EIA860_solar_ts_results_ISO.csv")

    # Ensure output dirs exist
    for d in [MONTHLY_DIR, DAILY_DIR, HOURLY_DIR]:
        d.mkdir(parents=True, exist_ok=True)

    # Process wind
    if os.path.exists(wind_csv):
        print("\n" + "=" * 60)
        print("PROCESSING WIND DATA")
        print("=" * 60)
        wind_meta, wind_ts = parse_csv(wind_csv)
        wind_agg = aggregate(wind_meta, wind_ts)
        generate_partitioned_files(wind_agg, "wind")
    else:
        print(f"Wind CSV not found: {wind_csv}")

    # Process solar
    if os.path.exists(solar_csv):
        print("\n" + "=" * 60)
        print("PROCESSING SOLAR DATA")
        print("=" * 60)
        solar_meta, solar_ts = parse_csv(solar_csv)
        solar_agg = aggregate(solar_meta, solar_ts)
        generate_partitioned_files(solar_agg, "solar")
    else:
        print(f"Solar CSV not found: {solar_csv}")

    # Generate manifest
    generate_manifest()

    print("\nDone!")


if __name__ == "__main__":
    main()
