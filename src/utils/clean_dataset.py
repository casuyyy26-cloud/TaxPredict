import pandas as pd
import io

def read_uploaded_file(file_storage):
    """Reads an uploaded file into a pandas DataFrame."""
    filename = file_storage.filename.lower()
    if filename.endswith('.csv'):
        return pd.read_csv(file_storage)
    elif filename.endswith(('.xls', '.xlsx')):
        return pd.read_excel(file_storage)
    else:
        raise ValueError("Unsupported file format. Please upload a CSV or Excel file.")

def normalize_status_value(val):
    """Maps raw or legacy status values to RENEW or NEW."""
    if val is None or pd.isna(val):
        return "RENEW"
    s = str(val).strip().upper()
    if "RENEW" in s or s in ("FULL", "PARTIAL"):
        return "RENEW"
    if "NEW" in s or s == "DELINQUENT":
        return "NEW"
    return "RENEW"

def clean_dataset(df):
    """Standardizes column names to match the database schema."""
    df.columns = [str(col).strip().lower().replace(" ", "_") for col in df.columns]
    
    # Capitalize categorical fields to match database ENUMs
    if 'business_size' in df.columns:
        df['business_size'] = df['business_size'].astype(str).str.upper()
    if 'business_category' in df.columns:
        df['business_category'] = df['business_category'].astype(str).str.upper()
    if 'barangay' in df.columns:
        df['barangay'] = df['barangay'].astype(str).str.upper()
    if 'quarter' in df.columns:
        df['quarter'] = df['quarter'].astype(str).str.upper()
    if 'compliance_status' in df.columns:
        df['compliance_status'] = df['compliance_status'].apply(normalize_status_value)
    elif 'status' in df.columns:
        df['compliance_status'] = df['status'].apply(normalize_status_value)
        
    return df

def validate_dataset(df):
    """Checks if all required columns for the database exist."""
    required_cols = [
        "business_id", "business_size", "business_category", "barangay",
        "year", "quarter", "official_tax_due", "tax_paid", "compliance_status"
    ]
    errors = []
    for col in required_cols:
        if col not in df.columns:
            errors.append(f"Missing required column: {col}")
    return errors

def build_stats(df):
    """Generates comprehensive upload statistics for the frontend."""
    if "compliance_status" in df.columns:
        df["compliance_status"] = df["compliance_status"].apply(normalize_status_value)
        by_compliance = df["compliance_status"].value_counts().to_dict()
    else:
        by_compliance = {}
    
    # Build the Barangay vs Size matrix
    matrix = []
    if {"barangay", "business_size"}.issubset(df.columns):
        table = pd.crosstab(df["barangay"], df["business_size"])
        valid_sizes = ["MICRO", "SMALL", "MEDIUM", "LARGE"]
        for size in valid_sizes:
            if size not in table.columns:
                table[size] = 0
        table["total"] = table[valid_sizes].sum(axis=1)
        for brgy, row in table.sort_values("total", ascending=False).iterrows():
            matrix.append({
                "barangay": brgy, 
                **{k: int(row.get(k, 0)) for k in valid_sizes}, 
                "total": int(row["total"])
            })

    # Return keys matching RENEW / NEW statistics
    return {
        "total": int(len(df)),
        "renew": int(by_compliance.get("RENEW", 0)),
        "new_business": int(by_compliance.get("NEW", 0)),
        "full": int(by_compliance.get("RENEW", 0)),
        "partial": int(by_compliance.get("NEW", 0)),
        "delinquent": 0,
        "by_size": {str(k): int(v) for k, v in df["business_size"].value_counts().items()} if "business_size" in df.columns else {},
        "by_category": {str(k): int(v) for k, v in df["business_category"].value_counts().items()} if "business_category" in df.columns else {},
        "by_barangay": {str(k): int(v) for k, v in df["barangay"].value_counts().items()} if "barangay" in df.columns else {},
        "barangay_size_matrix": matrix,
    }