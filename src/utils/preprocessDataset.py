import pandas as pd
from difflib import get_close_matches

# Valid ENUM lists from your schema
valid_sizes = ["MICRO", "SMALL", "MEDIUM", "LARGE"]
valid_compliance = ["FULL", "PARTIAL", "DELINQUENT"]
valid_quarters = ["Q1", "Q2", "Q3", "Q4"]
valid_barangays = [
    "BACLARAN", "BANAY-BANAY", "BANLIC", "BIGAA", "BUTONG", "CASILE", "DIEZMO", "GULOD",
    "MAMATID", "MARINIG", "NIUGAN", "PITTLAND", "PULO", "SALA", "SAN ISIDRO",
    "BARANGAY UNO", "BARANGAY DOS", "BARANGAY TRES",
]


# Generic normalizer for ENUMs
def normalize(value, valid_list):
    if pd.isna(value):
        return None
    upper = str(value).strip().upper()
    match = get_close_matches(upper, valid_list, n=1, cutoff=0.7)
    return match[0] if match else upper


# Barangay-specific normalizer with typo handling
def normalize_barangay(value):
    if pd.isna(value):
        return None
    upper = str(value).strip().upper()
    match = get_close_matches(upper, valid_barangays, n=1, cutoff=0.7)
    if match:
        if upper != match[0]:
            print(f"Mapped '{upper}' -> '{match[0]}'")
        return match[0]
    return upper


# Main preprocessing function
def preprocess_dataset(file_path: str) -> pd.DataFrame:
    # Parse CSV or XLSX (case-insensitive extension)
    lower = file_path.lower()
    if lower.endswith(".csv"):
        df = pd.read_csv(file_path)
    elif lower.endswith(".xlsx"):
        df = pd.read_excel(file_path)
    else:
        raise ValueError("Unsupported file format")

    # FIX 1: make header names match the code below ("Business Size" -> "BUSINESS_SIZE")
    df.columns = df.columns.astype(str).str.strip().str.upper().str.replace(" ", "_")

    # FIX 2: uppercase text, but keep blanks as real blanks
    # (astype(str) turned missing values into the text "NAN", so pd.isna never caught them)
    for col in df.select_dtypes(include="object").columns:
        df[col] = df[col].where(df[col].isna(), df[col].astype(str).str.strip().str.upper())

    # Normalize ENUM fields
    if "BUSINESS_SIZE" in df.columns:
        df["BUSINESS_SIZE"] = df["BUSINESS_SIZE"].apply(lambda x: normalize(x, valid_sizes))
    if "COMPLIANCE_STATUS" in df.columns:
        df["COMPLIANCE_STATUS"] = df["COMPLIANCE_STATUS"].apply(lambda x: normalize(x, valid_compliance))
    if "QUARTER" in df.columns:
        df["QUARTER"] = df["QUARTER"].apply(lambda x: normalize(x, valid_quarters))
    if "BARANGAY" in df.columns:
        df["BARANGAY"] = df["BARANGAY"].apply(normalize_barangay)

    # Default category if missing
    if "BUSINESS_CATEGORY" in df.columns:
        df["BUSINESS_CATEGORY"] = df["BUSINESS_CATEGORY"].replace("", "UNKNOWN").fillna("UNKNOWN")

    # Format peso values to 2 decimals
    for col in ["OFFICIAL_TAX_DUE", "TAX_PAID"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").round(2)

    # Add tax_gap
    if {"COMPLIANCE_STATUS", "OFFICIAL_TAX_DUE", "TAX_PAID"}.issubset(df.columns):
        df["TAX_GAP"] = 0.00
        mask = df["COMPLIANCE_STATUS"].isin(["PARTIAL", "DELINQUENT"])
        df.loc[mask, "TAX_GAP"] = df["OFFICIAL_TAX_DUE"] - df["TAX_PAID"]

    return df


# ------------------------------------------------------------------
# NEW: filters from the Data Ingestion page
# Each value is "ALL" (no filter) or one value, e.g. business_size="SMALL".
# ------------------------------------------------------------------
def filter_dataset(df, business_size="ALL", business_category="ALL",
                   barangay="ALL", compliance_status="ALL") -> pd.DataFrame:
    wanted = {
        "BUSINESS_SIZE": business_size,
        "BUSINESS_CATEGORY": business_category,
        "BARANGAY": barangay,
        "COMPLIANCE_STATUS": compliance_status,
    }
    for col, value in wanted.items():
        if value and str(value).upper() != "ALL" and col in df.columns:
            df = df[df[col] == str(value).strip().upper()]
    return df


# ------------------------------------------------------------------
# NEW: the numbers the "Data & Stats" screen shows (already filtered df)
# ------------------------------------------------------------------
def _counts(series):
    return {str(k): int(v) for k, v in series.dropna().value_counts().items()}


def build_stats(df: pd.DataFrame) -> dict:
    by_compliance = _counts(df["COMPLIANCE_STATUS"]) if "COMPLIANCE_STATUS" in df.columns else {}

    matrix = []
    if {"BARANGAY", "BUSINESS_SIZE"}.issubset(df.columns) and len(df):
        table = pd.crosstab(df["BARANGAY"], df["BUSINESS_SIZE"])
        for size in valid_sizes:
            if size not in table.columns:
                table[size] = 0
        table["total"] = table[valid_sizes].sum(axis=1)
        for brgy, row in table.sort_values("total", ascending=False).iterrows():
            matrix.append({"barangay": brgy, **{k: int(row[k]) for k in valid_sizes}, "total": int(row["total"])})

    return {
        "total": int(len(df)),
        "full": by_compliance.get("FULL", 0),
        "partial": by_compliance.get("PARTIAL", 0),
        "delinquent": by_compliance.get("DELINQUENT", 0),
        "by_size": _counts(df["BUSINESS_SIZE"]) if "BUSINESS_SIZE" in df.columns else {},
        "by_category": _counts(df["BUSINESS_CATEGORY"]) if "BUSINESS_CATEGORY" in df.columns else {},
        "by_barangay": _counts(df["BARANGAY"]) if "BARANGAY" in df.columns else {},
        "by_compliance": by_compliance,
        "barangay_size_matrix": matrix,
    }