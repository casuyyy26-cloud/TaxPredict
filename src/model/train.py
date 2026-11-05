"""
src/model/train.py

Upgraded training script for the TaxPredict model (Vercel + Local Compatible):
- Connects to PostgreSQL / Supabase database
- Normalizes Cabuyao's 18 barangays and RENEW/NEW business statuses
- Computes all 13 cohort features (including Std_Assessment, Min/Max_Assessment)
- Evaluates Random Forest vs. Gradient Boosting using 5-Fold Stratified CV
- Prints MAE, RMSE, and R² for both models and locks in the single best model
- Saves the winning model pipeline to /tmp (on Vercel) or src/model/ (locally)
"""

import os
import re
import joblib
import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL, make_url
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import StratifiedKFold, KFold, cross_validate

# Paths for saving and loading artifacts (Vercel /tmp compatible)
BASE_MODEL_DIR = os.path.dirname(__file__)
IS_VERCEL = os.environ.get("VERCEL") == "1" or not os.access(BASE_MODEL_DIR, os.W_OK)

MODEL_PATH = "/tmp/gb_model.pkl" if IS_VERCEL else os.path.join(BASE_MODEL_DIR, "gb_model.pkl")
ENCODER_PATH = "/tmp/gb_encoder.pkl" if IS_VERCEL else os.path.join(BASE_MODEL_DIR, "gb_encoder.pkl")

BUNDLED_MODEL_PATH = os.path.join(BASE_MODEL_DIR, "gb_model.pkl")
BUNDLED_ENCODER_PATH = os.path.join(BASE_MODEL_DIR, "gb_encoder.pkl")

# Feature definitions kept for compatibility with predict.py
CATEGORICAL_FEATURES = ["barangay", "business_size", "business_category", "quarter"]
NUMERIC_FEATURES = ["year"]

LOCAL_HOSTS = ("127.0.0.1", "localhost", "::1")


def get_database_engine():
    url = os.environ.get("DATABASE_URL")
    if url:
        url = url.strip()
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+psycopg2://", 1)
        elif url.startswith("postgresql://") and "+psycopg2" not in url:
            url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
        db_url = make_url(url)
    else:
        db_url = make_url(
            URL.create(
                "postgresql+psycopg2",
                username=os.environ.get("DB_USER", "postgres"),
                password=os.environ.get("DB_PASSWORD", ""),
                host=os.environ.get("DB_HOST", "db.atfxhnibxmjtcdlfxqux.supabase.co"),
                port=int(os.environ.get("DB_PORT", 5432)),
                database=os.environ.get("DB_NAME", "postgres"),
            )
        )

    return create_engine(
        db_url,
        pool_pre_ping=True,
        connect_args={
            "sslmode": "prefer" if db_url.host in LOCAL_HOSTS else "require",
            "connect_timeout": 10,
        },
    )


def normalize_cabuyao_barangay(val):
    if pd.isna(val):
        return "UNKNOWN"
    s = str(val).strip().upper()
    s = s.translate(str.maketrans("ΒΑΝΥ", "BANY"))
    s = re.sub(r"\s*\(P[O]?\s*$", "", s)
    s = re.sub(r"\s*\(\s*$", "", s).strip()
    s = re.sub(r"\s+", " ", s)
    mapping = {
        "BANAYBANAY": "BANAY-BANAY",
        "INIUGAN": "NIUGAN",
        "BARANGAY UNO": "BARANGAY UNO",
        "BARANGAY DOS": "BARANGAY DOS",
        "BARANGAY TRES": "BARANGAY TRES",
    }
    return mapping.get(s, s)


def normalize_permit_status(val):
    if pd.isna(val):
        return "RENEW"
    s = str(val).strip().upper()
    if "RENEW" in s or s in ("FULL", "PARTIAL"):
        return "RENEW"
    if "NEW" in s or s == "DELINQUENT":
        return "NEW"
    return "RENEW"


def load_trained_model():
    """Load model + encoder from /tmp first (if retrained on Vercel), else fallback to bundled .pkl."""
    m_path = MODEL_PATH if os.path.exists(MODEL_PATH) else BUNDLED_MODEL_PATH
    e_path = ENCODER_PATH if os.path.exists(ENCODER_PATH) else BUNDLED_ENCODER_PATH

    if not os.path.exists(m_path) or not os.path.exists(e_path):
        return None, None
    model = joblib.load(m_path)
    encoder = joblib.load(e_path)
    return model, encoder


def train_and_save_model():
    print("🔗 Connecting to database...")
    engine = get_database_engine()

    with engine.begin() as conn:
        result = conn.execute(text("""
            SELECT business_id, barangay, business_size, business_category,
                   quarter, year, official_tax_due, tax_paid, compliance_status
            FROM businesses
        """))
        rows = [dict(row) for row in result.mappings()]

    if not rows:
        print("⚠️ No data found in businesses table.")
        return

    df = pd.DataFrame(rows)
    print(f"📊 Loaded {len(df):,} rows for training.")

    # Clean and normalize fields
    df["barangay"] = df["barangay"].apply(normalize_cabuyao_barangay)
    df["business_size"] = df["business_size"].astype(str).str.strip().str.upper()
    df["business_category"] = df["business_category"].astype(str).str.strip().str.upper()
    df["quarter"] = df["quarter"].astype(str).str.strip().str.upper()
    df["year"] = pd.to_numeric(df["year"], errors="coerce").fillna(2026).astype(int)
    df["official_tax_due"] = pd.to_numeric(df["official_tax_due"], errors="coerce").fillna(0.0)
    df["tax_paid"] = pd.to_numeric(df["tax_paid"], errors="coerce").fillna(0.0)
    df["status"] = df.get("compliance_status", pd.Series(["RENEW"] * len(df))).apply(normalize_permit_status)

    # Fit row-level encoder for legacy compatibility
    X_cat = df[CATEGORICAL_FEATURES].astype(str)
    encoder = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    encoder.fit(X_cat)

    # Build the 13-feature Cohort Dataset (1:1 with Google Colab)
    cohort_df = (
        df.groupby(["year", "quarter", "barangay", "business_size"])
        .agg(
            Business_Count=("business_id", "count"),
            Total_Assessment=("official_tax_due", "sum"),
            Mean_Assessment=("official_tax_due", "mean"),
            Min_Assessment=("official_tax_due", "min"),
            Max_Assessment=("official_tax_due", "max"),
            Std_Assessment=("official_tax_due", lambda x: float(np.std(x, ddof=0))),
            Synthetic_Collection=("tax_paid", "sum"),
            Status_New=("status", lambda x: (x == "NEW").sum()),
            Status_ReNew=("status", lambda x: (x == "RENEW").sum()),
        )
        .reset_index()
    )
    cohort_df["Log_Total_Assessment"] = np.log1p(cohort_df["Total_Assessment"])

    cohort_features = [
        "year",
        "quarter",
        "barangay",
        "business_size",
        "Business_Count",
        "Total_Assessment",
        "Mean_Assessment",
        "Min_Assessment",
        "Max_Assessment",
        "Std_Assessment",
        "Log_Total_Assessment",
        "Status_New",
        "Status_ReNew",
    ]
    cat_cols = ["quarter", "barangay", "business_size"]
    num_cols = [c for c in cohort_features if c not in cat_cols]

    X_cohort = cohort_df[cohort_features].copy()
    y_cohort = cohort_df["Synthetic_Collection"].copy()

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", Pipeline([("imputer", SimpleImputer(strategy="median"))]), num_cols),
            ("cat", Pipeline([
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("onehot", OneHotEncoder(handle_unknown="ignore"))
            ]), cat_cols),
        ]
    )

    candidate_models = {
        "Random Forest": RandomForestRegressor(
            n_estimators=300,
            max_depth=10,
            min_samples_leaf=1,
            random_state=42,
            n_jobs=-1,
        ),
        "Gradient Boosting": GradientBoostingRegressor(
            n_estimators=300,
            learning_rate=0.05,
            max_depth=4,
            min_samples_leaf=1,
            subsample=0.9,
            loss="squared_error",
            random_state=42,
        ),
    }

    best_name = "Random Forest"
    best_r2 = float("-inf")
    best_mae = float("inf")
    best_rmse = float("inf")

    if len(cohort_df) >= 10:
        n_splits = min(5, len(cohort_df))
        size_counts = cohort_df["business_size"].value_counts()
        if (size_counts >= n_splits).all():
            skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
            cv_splits = list(skf.split(X_cohort, cohort_df["business_size"]))
        else:
            kf = KFold(n_splits=n_splits, shuffle=True, random_state=42)
            cv_splits = list(kf.split(X_cohort))

        for name, m in candidate_models.items():
            pipe = Pipeline([("preprocessor", clone(preprocessor)), ("model", clone(m))])
            scores = cross_validate(
                pipe,
                X_cohort,
                y_cohort,
                cv=cv_splits,
                scoring={
                    "mae": "neg_mean_absolute_error",
                    "rmse": "neg_root_mean_squared_error",
                    "r2": "r2",
                },
                n_jobs=-1,
            )
            cv_mae = -scores["test_mae"].mean()
            cv_rmse = -scores["test_rmse"].mean()
            cv_r2 = scores["test_r2"].mean()
            print(
                f"   • {name} (5-Fold CV) -> MAE: ₱{cv_mae:,.2f} | RMSE: ₱{cv_rmse:,.2f} | R²: {cv_r2:.4f}"
            )
            if (cv_r2 > best_r2) or (np.isclose(cv_r2, best_r2) and cv_mae < best_mae):
                best_r2 = cv_r2
                best_mae = cv_mae
                best_rmse = cv_rmse
                best_name = name

    print(
        f"🏆 Selected Best Model: {best_name} "
        f"(MAE: ₱{best_mae:,.2f} | RMSE: ₱{best_rmse:,.2f} | R²: {best_r2:.4f})"
    )

    best_pipeline = Pipeline([
        ("preprocessor", clone(preprocessor)),
        ("model", clone(candidate_models[best_name])),
    ])
    best_pipeline.fit(X_cohort, y_cohort)

    joblib.dump(best_pipeline, MODEL_PATH)
    joblib.dump(encoder, ENCODER_PATH)
    print(f"✅ Upgraded Model ({best_name}) saved to {MODEL_PATH}")
    print(f"✅ Encoder saved to {ENCODER_PATH}")


if __name__ == "__main__":
    train_and_save_model()