import sys
import os
import json
from urllib.parse import quote_plus
import pandas as pd
from dotenv import load_dotenv

# Fix for ModuleNotFoundError: Add the root 'taxpredict' folder to Python's path
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(current_dir, '../../'))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

# Load the .env file from the root folder
load_dotenv(os.path.join(root_dir, ".env"))

from flask import Flask, request, jsonify
from flask_cors import CORS
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL, make_url
from werkzeug.security import check_password_hash, generate_password_hash

from src.model.predict import run_predictions
from src.utils.clean_dataset import clean_dataset, validate_dataset, build_stats, read_uploaded_file


app = Flask(__name__)
CORS(app)


# ------------------------------------------------------------------
# DATABASE CONNECTION (VERCEL + LOCAL COMPATIBLE, PSYCOPG2 & V3 SAFE)
# ------------------------------------------------------------------
LOCAL_HOSTS = ("127.0.0.1", "localhost", "::1")


def _get_driver_scheme():
    try:
        import psycopg2  # noqa: F401
        return "postgresql+psycopg2"
    except ImportError:
        return "postgresql+psycopg"


def build_database_url():
    scheme = _get_driver_scheme()
    url = os.environ.get("DATABASE_URL")
    if url:
        url = url.strip().strip('"').strip("'")
        if "://" in url:
            _, rest = url.split("://", 1)
        else:
            rest = url

        # Safely encode special characters (like '?') inside the password
        if "@" in rest:
            userinfo, hostinfo = rest.rsplit("@", 1)
            if ":" in userinfo:
                user, raw_pw = userinfo.split(":", 1)
                if "?" in raw_pw or "#" in raw_pw or "@" in raw_pw:
                    raw_pw = quote_plus(raw_pw)
                userinfo = f"{user}:{raw_pw}"
            rest = f"{userinfo}@{hostinfo}"

        return f"{scheme}://{rest}"

    password = os.environ.get("DB_PASSWORD")
    if password:
        return URL.create(
            scheme,
            username=os.environ.get("DB_USER", "postgres"),
            password=password,
            host=os.environ.get("DB_HOST", "db.atfxhnibxmjtcdlfxqux.supabase.co"),
            port=int(os.environ.get("DB_PORT", 5432)),
            database=os.environ.get("DB_NAME", "postgres"),
        )
    raise RuntimeError(
        "DATABASE_URL or DB_PASSWORD is missing. Add DATABASE_URL in Vercel Environment Variables or .env."
    )


DATABASE_URL = make_url(build_database_url())

engine = create_engine(
    DATABASE_URL,
    echo=os.environ.get("SQL_ECHO") == "1",
    pool_size=2,
    max_overflow=1,
    pool_timeout=30,
    pool_recycle=60,
    pool_pre_ping=True,
    connect_args={
        "sslmode": "prefer" if DATABASE_URL.host in LOCAL_HOSTS else "require",
        "connect_timeout": 10,
    },
)
print(f"Database: {DATABASE_URL.host}:{DATABASE_URL.port}/{DATABASE_URL.database} as {DATABASE_URL.username}")


# ------------------------------------------------------------------
# ROLE & PERMISSION DEFAULTS + AUTO-SEEDING
# ------------------------------------------------------------------
DEFAULT_ROLE_PERMISSIONS = {
    "admin": ["analytics", "districts", "ingestion", "heatmap", "reports", "about", "accounts"],
    "officer": ["analytics", "districts", "ingestion", "heatmap", "reports", "about"],
    "guest": ["analytics", "districts", "heatmap", "about"],
}


def normalize_role(role_str):
    if not role_str:
        return "guest"
    r = str(role_str).strip().lower()
    if r in ("admin", "administrator"):
        return "admin"
    if r in ("officer", "bplo_officer", "bplo officer", "lgu officer", "lgu_officer", "bplo"):
        return "officer"
    return "guest"


def normalize_business_status_value(val):
    """Maps legacy FULL/PARTIAL/DELINQUENT and raw Status strings to RENEW or NEW."""
    if val is None or pd.isna(val):
        return "RENEW"
    s = str(val).strip().upper()
    if "RENEW" in s or s in ("FULL", "PARTIAL"):
        return "RENEW"
    if "NEW" in s or s == "DELINQUENT":
        return "NEW"
    return "RENEW"


def _get_user_permissions(conn, user_id, role):
    rows = conn.execute(
        text("SELECT page_name FROM user_permissions WHERE user_id = :uid ORDER BY id"),
        {"uid": user_id}
    ).scalars().all()
    if rows:
        return list(rows)
    return DEFAULT_ROLE_PERMISSIONS.get(normalize_role(role), DEFAULT_ROLE_PERMISSIONS["guest"])


def _set_user_permissions(conn, user_id, page_names):
    conn.execute(text("DELETE FROM user_permissions WHERE user_id = :uid"), {"uid": user_id})
    clean_pages = sorted(set(str(p).strip() for p in (page_names or []) if str(p).strip()))
    for page in clean_pages:
        conn.execute(
            text("INSERT INTO user_permissions (user_id, page_name) VALUES (:uid, :page)"),
            {"uid": user_id, "page": page}
        )
    return clean_pages


def seed_default_accounts():
    """Seeds default Admin and BPLO Officer accounts if the users table is empty."""
    try:
        with engine.begin() as conn:
            count = conn.execute(text("SELECT COUNT(*) FROM users")).scalar()
            if count == 0:
                print(">>> Seeding default Admin & BPLO Officer accounts...")
                admin_id = conn.execute(text("""
                    INSERT INTO users (
                        role, full_name, email, password_hash, address,
                        postal_code, barangay, employee_id, position
                    ) VALUES (
                        'admin', 'System Administrator', 'admin@cabuyao.gov.ph', :pw,
                        'Cabuyao City Hall', '4025', 'Poblacion Uno', 'ADM-2026-001', 'IT / System Admin'
                    ) RETURNING user_id
                """), {"pw": generate_password_hash("Admin@123")}).scalar()
                _set_user_permissions(conn, admin_id, DEFAULT_ROLE_PERMISSIONS["admin"])

                officer_id = conn.execute(text("""
                    INSERT INTO users (
                        role, full_name, email, password_hash, address,
                        postal_code, barangay, employee_id, position
                    ) VALUES (
                        'officer', 'Juan Dela Cruz', 'officer@cabuyao.gov.ph', :pw,
                        'Cabuyao City Hall', '4025', 'Sala', 'BPLO-2024-001', 'BPLO Assessment Officer'
                    ) RETURNING user_id
                """), {"pw": generate_password_hash("Officer@123")}).scalar()
                _set_user_permissions(conn, officer_id, DEFAULT_ROLE_PERMISSIONS["officer"])
                print(">>> Seed complete! Admin: ADM-2026-001 (Admin@123) | Officer: BPLO-2024-001 (Officer@123)")
    except Exception as e:
        print(f">>> Warning: Could not auto-seed users table: {e}")


seed_default_accounts()


REQUIRED_FIELDS = [
    "business_id", "business_size", "business_category", "barangay",
    "year", "quarter", "official_tax_due", "tax_paid", "compliance_status",
]


@app.route("/api/health", methods=["GET"])
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return jsonify({"status": "ok", "database": "connected"}), 200
    except Exception as e:
        app.logger.exception("Database connection failed")
        reason = str(getattr(e, "orig", e)).strip()
        return jsonify({"status": "error", "database": "unreachable", "message": reason}), 503


def _paginated_query(base_select, engine, page, limit, count_sql, params=None):
    with engine.begin() as conn:
        if limit is not None:
            offset = (page - 1) * limit
            result = conn.execute(
                text(f"{base_select} LIMIT :limit OFFSET :offset"),
                {**(params or {}), "limit": limit, "offset": offset},
            )
        else:
            result = conn.execute(text(base_select), params or {})
        rows = [dict(row) for row in result.mappings()]
        total = conn.execute(text(count_sql), params or {}).scalar()
    return rows, total


def _error(e, status=500):
    app.logger.exception("Request failed")
    return jsonify({"message": str(getattr(e, "orig", e)).strip()}), status


# ------------------------------------------------------------------
# AUTHENTICATION & ACCOUNT MANAGEMENT ENDPOINTS
# ------------------------------------------------------------------
@app.route("/api/login", methods=["POST"])
def login():
    try:
        data = request.get_json(silent=True) or {}
        identifier = (data.get("identifier") or data.get("username") or data.get("email") or data.get("employee_id") or "").strip()
        password = data.get("password") or ""
        requested_role = normalize_role(data.get("role")) if data.get("role") else None

        # Allow 1-click Guest access or registered Guest login
        if requested_role == "guest" and not identifier:
            return jsonify({
                "status": "success",
                "user": {
                    "user_id": 0,
                    "role": "guest",
                    "full_name": "Guest Evaluator",
                    "email": "guest@taxpredict.local",
                    "employee_id": "GUEST",
                    "position": "Public / Guest Viewer",
                    "barangay": "All",
                    "permissions": DEFAULT_ROLE_PERMISSIONS["guest"],
                }
            }), 200

        if not identifier or not password:
            return jsonify({"status": "error", "message": "Please enter your Employee ID / Email and password."}), 400

        with engine.begin() as conn:
            user = conn.execute(text("""
                SELECT user_id, role, full_name, email, password_hash,
                       address, postal_code, barangay, employee_id, position
                FROM users
                WHERE LOWER(email) = LOWER(:ident)
                   OR LOWER(employee_id) = LOWER(:ident)
                LIMIT 1
            """), {"ident": identifier}).mappings().first()

            if not user or not check_password_hash(user["password_hash"], password):
                return jsonify({"status": "error", "message": "Invalid Employee ID/Email or password."}), 401

            actual_role = normalize_role(user["role"])

            if requested_role and requested_role != actual_role:
                role_labels = {"admin": "Admin", "officer": "LGU / BPLO Officer", "guest": "Guest"}
                return jsonify({
                    "status": "error",
                    "message": f"This account belongs to the '{role_labels.get(actual_role, actual_role)}' portal. Please switch tabs."
                }), 403

            permissions = _get_user_permissions(conn, user["user_id"], actual_role)

        return jsonify({
            "status": "success",
            "role": actual_role,
            "user": {
                "user_id": user["user_id"],
                "role": actual_role,
                "full_name": user["full_name"],
                "email": user["email"],
                "employee_id": user["employee_id"],
                "position": user["position"],
                "barangay": user["barangay"],
                "address": user["address"],
                "postal_code": user["postal_code"],
                "permissions": permissions,
            }
        }), 200
    except Exception as e:
        app.logger.exception("Login failed")
        return _error(e)


@app.route("/api/register", methods=["POST"])
def register():
    """Allows self-registration (for Guests/Officers) or account creation."""
    try:
        data = request.get_json(silent=True) or {}
        role = normalize_role(data.get("role", "guest"))
        full_name = (data.get("full_name") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        employee_id = (data.get("employee_id") or "").strip() or None
        position = (data.get("position") or ("BPLO Officer" if role == "officer" else "Guest Evaluator")).strip()
        barangay = (data.get("barangay") or "").strip()
        address = (data.get("address") or "").strip()
        postal_code = (data.get("postal_code") or "4025").strip()

        if not full_name or not email or not password:
            return jsonify({"status": "error", "message": "Full name, email, and password are required."}), 400

        if len(password) < 6:
            return jsonify({"status": "error", "message": "Password must be at least 6 characters."}), 400

        with engine.begin() as conn:
            existing = conn.execute(text("""
                SELECT user_id FROM users
                WHERE LOWER(email) = LOWER(:email)
                   OR (:emp_id IS NOT NULL AND LOWER(employee_id) = LOWER(:emp_id))
            """), {"email": email, "emp_id": employee_id}).first()

            if existing:
                return jsonify({"status": "error", "message": "An account with this Email or Employee ID already exists."}), 409

            new_user_id = conn.execute(text("""
                INSERT INTO users (
                    role, full_name, email, password_hash, address,
                    postal_code, barangay, employee_id, position
                ) VALUES (
                    :role, :full_name, :email, :password_hash, :address,
                    :postal_code, :barangay, :employee_id, :position
                ) RETURNING user_id
            """), {
                "role": role,
                "full_name": full_name,
                "email": email,
                "password_hash": generate_password_hash(password),
                "address": address,
                "postal_code": postal_code,
                "barangay": barangay,
                "employee_id": employee_id,
                "position": position,
            }).scalar()

            requested_perms = data.get("permissions") or DEFAULT_ROLE_PERMISSIONS.get(role, DEFAULT_ROLE_PERMISSIONS["guest"])
            saved_perms = _set_user_permissions(conn, new_user_id, requested_perms)

        return jsonify({
            "status": "success",
            "message": "Account created successfully.",
            "user": {
                "user_id": new_user_id,
                "role": role,
                "full_name": full_name,
                "email": email,
                "employee_id": employee_id,
                "position": position,
                "barangay": barangay,
                "address": address,
                "postal_code": postal_code,
                "permissions": saved_perms,
            }
        }), 201
    except Exception as e:
        return _error(e)


@app.route("/api/users", methods=["GET"])
def list_users():
    """Returns all users and their page permissions for the Admin Account Management panel."""
    try:
        with engine.begin() as conn:
            users_res = conn.execute(text("""
                SELECT user_id, role, full_name, email, address,
                       postal_code, barangay, employee_id, position
                FROM users
                ORDER BY user_id ASC
            """)).mappings().all()

            perms_res = conn.execute(text("SELECT user_id, page_name FROM user_permissions ORDER BY id")).mappings().all()

        perms_by_user = {}
        for p in perms_res:
            perms_by_user.setdefault(p["user_id"], []).append(p["page_name"])

        users_list = []
        for u in users_res:
            u_dict = dict(u)
            norm_role = normalize_role(u_dict.get("role"))
            u_dict["role"] = norm_role
            u_dict["permissions"] = perms_by_user.get(
                u_dict["user_id"],
                DEFAULT_ROLE_PERMISSIONS.get(norm_role, DEFAULT_ROLE_PERMISSIONS["guest"])
            )
            users_list.append(u_dict)

        return jsonify({"status": "success", "users": users_list}), 200
    except Exception as e:
        return _error(e)


@app.route("/api/users", methods=["POST"])
def create_user():
    """Admin endpoint to create a new user with custom permissions."""
    return register()


@app.route("/api/users/<int:user_id>", methods=["PUT"])
def update_user(user_id):
    """Admin endpoint to update user details, role, password, and page permissions."""
    try:
        data = request.get_json(silent=True) or {}
        with engine.begin() as conn:
            existing = conn.execute(
                text("SELECT * FROM users WHERE user_id = :uid"),
                {"uid": user_id}
            ).mappings().first()

            if not existing:
                return jsonify({"status": "error", "message": "User not found."}), 404

            role = normalize_role(data.get("role", existing["role"]))
            full_name = (data.get("full_name") if "full_name" in data else existing["full_name"]) or ""
            email = (data.get("email") if "email" in data else existing["email"]) or ""
            employee_id = data.get("employee_id") if "employee_id" in data else existing["employee_id"]
            position = data.get("position") if "position" in data else existing["position"]
            barangay = data.get("barangay") if "barangay" in data else existing["barangay"]
            address = data.get("address") if "address" in data else existing["address"]
            postal_code = data.get("postal_code") if "postal_code" in data else existing["postal_code"]

            new_password = (data.get("password") or "").strip()
            password_hash = generate_password_hash(new_password) if new_password else existing["password_hash"]

            conn.execute(text("""
                UPDATE users
                SET role = :role,
                    full_name = :full_name,
                    email = :email,
                    password_hash = :password_hash,
                    employee_id = :employee_id,
                    position = :position,
                    barangay = :barangay,
                    address = :address,
                    postal_code = :postal_code
                WHERE user_id = :uid
            """), {
                "role": role,
                "full_name": full_name,
                "email": email,
                "password_hash": password_hash,
                "employee_id": employee_id,
                "position": position,
                "barangay": barangay,
                "address": address,
                "postal_code": postal_code,
                "uid": user_id,
            })

            if "permissions" in data and isinstance(data["permissions"], list):
                saved_perms = _set_user_permissions(conn, user_id, data["permissions"])
            else:
                saved_perms = _get_user_permissions(conn, user_id, role)

        return jsonify({
            "status": "success",
            "message": "User account and permissions updated.",
            "user": {
                "user_id": user_id,
                "role": role,
                "full_name": full_name,
                "email": email,
                "employee_id": employee_id,
                "position": position,
                "barangay": barangay,
                "address": address,
                "postal_code": postal_code,
                "permissions": saved_perms,
            }
        }), 200
    except Exception as e:
        return _error(e)


@app.route("/api/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    """Admin endpoint to delete a user and their permissions."""
    try:
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM user_permissions WHERE user_id = :uid"), {"uid": user_id})
            res = conn.execute(text("DELETE FROM users WHERE user_id = :uid"), {"uid": user_id})
            if res.rowcount == 0:
                return jsonify({"status": "error", "message": "User not found."}), 404
        return jsonify({"status": "success", "message": "User deleted successfully."}), 200
    except Exception as e:
        return _error(e)


# ------------------------------------------------------------------
# BUSINESS & PREDICTION ENDPOINTS
# ------------------------------------------------------------------
def _parse_filter(value):
    if not value:
        return []
    if isinstance(value, list):
        items = [str(v) for v in value]
    else:
        text_value = str(value).strip()
        if text_value.startswith("["):
            try:
                items = [str(v) for v in json.loads(text_value)]
            except ValueError:
                items = []
        elif "," in text_value:
            items = text_value.split(",")
        else:
            items = [text_value]
    items = [i.strip().upper() for i in items if i.strip()]
    return [] if (not items or "ALL" in items) else items


@app.route("/api/businesses", methods=["GET"])
def get_businesses():
    try:
        page = int(request.args.get("page", 1))
        limit_param = request.args.get("limit")
        limit = int(limit_param) if limit_param is not None else None

        rows, total = _paginated_query(
            "SELECT * FROM businesses ORDER BY business_id, year, quarter",
            engine, page, limit,
            "SELECT COUNT(*) FROM businesses",
        )
        for r in rows:
            r["compliance_status"] = normalize_business_status_value(r.get("compliance_status"))
        return jsonify({"rows": rows, "page": page, "limit": limit, "total": total}), 200
    except Exception as e:
        return _error(e)


@app.route("/api/businesses/stats-summary", methods=["GET", "POST"])
def get_businesses_stats_summary():
    try:
        with engine.begin() as conn:
            result = conn.execute(text("SELECT * FROM businesses"))
            rows = [dict(row) for row in result.mappings()]
        if not rows:
            return jsonify({"status": "success", "stats": {}, "total": 0}), 200

        df = pd.DataFrame(rows)
        df["compliance_status"] = df["compliance_status"].apply(normalize_business_status_value)

        payload = request.get_json(silent=True) or {}
        size_filter = _parse_filter(request.args.get("business_size") or payload.get("business_size"))
        cat_filter = _parse_filter(request.args.get("business_category") or payload.get("business_category"))
        brgy_filter = _parse_filter(request.args.get("barangay") or payload.get("barangay"))
        status_filter = _parse_filter(
            request.args.get("compliance_status")
            or request.args.get("status")
            or payload.get("compliance_status")
            or payload.get("status")
        )
        status_filter = [normalize_business_status_value(s) for s in status_filter]

        if size_filter and "business_size" in df.columns:
            df = df[df["business_size"].astype(str).str.upper().isin(size_filter)]
        if cat_filter and "business_category" in df.columns:
            df = df[df["business_category"].astype(str).str.upper().isin(cat_filter)]
        if brgy_filter and "barangay" in df.columns:
            df = df[df["barangay"].astype(str).str.upper().isin(brgy_filter)]
        if status_filter and "compliance_status" in df.columns:
            df = df[df["compliance_status"].isin(status_filter)]

        stats = build_stats(df)
        return jsonify({"status": "success", "stats": stats, "total": int(len(df))}), 200
    except Exception as e:
        return _error(e)


def _upsert_businesses(rows):
    skipped = []
    valid_rows = []

    for i, row in enumerate(rows):
        row["compliance_status"] = normalize_business_status_value(row.get("compliance_status"))
        missing = [f for f in REQUIRED_FIELDS if row.get(f) in (None, "")]
        if missing:
            skipped.append({"row": i, "missing": missing})
        else:
            valid_rows.append(row)

    inserted = 0
    if valid_rows:
        chunk_size = 250
        for i in range(0, len(valid_rows), chunk_size):
            chunk = valid_rows[i:i + chunk_size]
            with engine.begin() as conn:
                conn.execute(text("""
                    INSERT INTO businesses (
                        business_id, business_size, business_category, barangay,
                        year, quarter, official_tax_due, tax_paid, compliance_status
                    ) VALUES (
                        :business_id, :business_size, :business_category, :barangay,
                        :year, :quarter, :official_tax_due, :tax_paid, :compliance_status
                    )
                    ON CONFLICT (business_id, year, quarter)
                    DO UPDATE SET
                        business_size = EXCLUDED.business_size,
                        business_category = EXCLUDED.business_category,
                        barangay = EXCLUDED.barangay,
                        official_tax_due = EXCLUDED.official_tax_due,
                        tax_paid = EXCLUDED.tax_paid,
                        compliance_status = EXCLUDED.compliance_status
                """), chunk)
            inserted += len(chunk)
            print(f">>> Chunk uploaded... ({inserted} rows saved so far)")

    return inserted, skipped


@app.route("/api/businesses/import", methods=["POST"])
def import_businesses():
    try:
        payload = request.get_json(silent=True)
        if not payload:
            return jsonify({"message": "No data received"}), 400
        rows = payload.get("businesses") if isinstance(payload, dict) else payload
        if not rows or not isinstance(rows, list):
            return jsonify({"message": "No business records found"}), 400

        inserted, skipped = _upsert_businesses(rows)

        return jsonify({
            "status": "success",
            "message": f"{inserted} records saved. {len(skipped)} skipped.",
            "rows_uploaded": inserted,
            "rows_skipped": skipped,
        }), 200
    except Exception as e:
        return _error(e)


@app.route("/api/businesses/preview", methods=["POST"])
def preview_businesses_file():
    try:
        if "file" not in request.files:
            return jsonify({"message": "No file uploaded."}), 400

        file_storage = request.files["file"]
        if not file_storage.filename:
            return jsonify({"message": "No file selected."}), 400

        raw_df = read_uploaded_file(file_storage)
        cleaned_df = clean_dataset(raw_df)

        return jsonify({
            "status": "success",
            "total_rows": int(len(cleaned_df)),
            "available_sizes": sorted(cleaned_df["business_size"].dropna().unique().tolist()),
            "available_categories": sorted(cleaned_df["business_category"].dropna().unique().tolist()),
            "available_statuses": ["RENEW", "NEW"],
            "size_category_pairs": cleaned_df[["business_size", "business_category"]].to_dict(orient="records"),
        }), 200
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        return _error(e)


@app.route("/api/businesses/upload", methods=["POST"])
def upload_businesses_file():
    print("\n>>> 1. NEW UPLOAD REQUEST RECEIVED FROM FRONTEND")
    try:
        if "file" not in request.files:
            return jsonify({"message": "No file uploaded."}), 400

        file_storage = request.files["file"]
        print(f">>> 2. Reading Excel file: {file_storage.filename}")

        raw_status_filter = _parse_filter(
            request.form.get("compliance_status") or request.form.get("business_status") or request.form.get("status")
        )
        norm_status_filter = [normalize_business_status_value(s) for s in raw_status_filter]

        filters = {
            "business_size": _parse_filter(request.form.get("business_size")),
            "business_category": _parse_filter(request.form.get("business_category")),
            "barangay": _parse_filter(request.form.get("barangay")),
            "compliance_status": norm_status_filter,
        }

        raw_df = read_uploaded_file(file_storage)
        cleaned_df = clean_dataset(raw_df)
        cleaned_df["compliance_status"] = cleaned_df["compliance_status"].apply(normalize_business_status_value)
        print(">>> 3. File parsed and cleaned successfully")

        for column, values in filters.items():
            if values and column in cleaned_df.columns:
                cleaned_df = cleaned_df[cleaned_df[column].isin(values)]

        if cleaned_df.empty:
            return jsonify({"message": "No rows match the selected filters."}), 400

        validation_errors = validate_dataset(cleaned_df)
        if validation_errors:
            return jsonify({
                "status": "error",
                "message": "Dataset validation failed.",
                "errors": validation_errors[:200],
            }), 400

        rows = cleaned_df.to_dict(orient="records")
        for row in rows:
            for k, v in row.items():
                if pd.isna(v):
                    row[k] = None

            row["year"] = int(row["year"]) if row.get("year") else None
            for key in ("official_tax_due", "tax_paid"):
                if row.get(key) is not None:
                    row[key] = float(row[key])

        print(">>> 4. Attempting database insert...")
        inserted, skipped = _upsert_businesses(rows)
        print(f">>> 5. DATABASE INSERT SUCCESS! {inserted} rows saved.")

        stats = build_stats(cleaned_df)

        return jsonify({
            "status": "success",
            "message": f"{inserted} records cleaned, saved, and ready.",
            "rows_uploaded": inserted,
            "rows_skipped": skipped,
            "stats": stats,
        }), 200
    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        print(f">>> !!! CRASH ERROR: {e}")
        return _error(e)


@app.route("/api/businesses/<business_id>", methods=["DELETE"])
def delete_business(business_id):
    try:
        year = request.args.get("year")
        quarter = request.args.get("quarter")

        if year and quarter:
            sql = text("""
                DELETE FROM businesses
                WHERE business_id = :business_id AND year = :year AND quarter = :quarter
            """)
            params = {"business_id": business_id, "year": int(year), "quarter": quarter}
        else:
            sql = text("DELETE FROM businesses WHERE business_id = :business_id")
            params = {"business_id": business_id}

        with engine.begin() as conn:
            result = conn.execute(sql, params)

        return jsonify({
            "status": "success",
            "message": f"Deleted {result.rowcount} record(s) for {business_id}.",
            "rows_deleted": result.rowcount,
        }), 200
    except Exception as e:
        return _error(e)


@app.route("/api/predictions/generate", methods=["POST"])
def generate_predictions():
    print("\n>>> [1/3] ML PREDICTION TRIGGERED: Starting model training...")
    try:
        from src.model.train import train_and_save_model
        train_and_save_model()

        print(">>> [2/3] Executing pipeline and processing forecasts...")
        result = run_predictions()
        print(">>> [3/3] SUCCESS: Predictions computed and saved to database.")
        return jsonify({"status": "success", **result}), 200
    except Exception as e:
        app.logger.exception("Prediction run failed")
        return jsonify({"status": "error", "message": str(getattr(e, "orig", e)).strip()}), 500


@app.route("/api/predictions", methods=["GET"])
def get_predictions():
    try:
        page = int(request.args.get("page", 1))
        limit_param = request.args.get("limit")
        limit = int(limit_param) if limit_param is not None else None

        year = request.args.get("year")
        quarter = request.args.get("quarter")
        business_size = request.args.get("business_size")

        base_select = "SELECT * FROM predictions WHERE 1=1"
        count_sql = "SELECT COUNT(*) FROM predictions WHERE 1=1"
        params = {}

        if year:
            base_select += " AND year = :year"
            count_sql += " AND year = :year"
            params["year"] = int(year)

        if quarter:
            base_select += " AND quarter = :quarter"
            count_sql += " AND quarter = :quarter"
            params["quarter"] = quarter

        if business_size:
            base_select += " AND business_size = :business_size"
            count_sql += " AND business_size = :business_size"
            params["business_size"] = business_size.upper()

        base_select += " ORDER BY prediction_id"

        rows, total = _paginated_query(base_select, engine, page, limit, count_sql, params)

        return jsonify({
            "rows": rows, "predictions": rows,
            "page": page, "limit": limit, "total": total,
        }), 200
    except Exception as e:
        return _error(e)


@app.route("/api/districts", methods=["GET"])
def get_districts():
    try:
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 50))
        offset = (page - 1) * limit

        year = request.args.get("year")
        quarter = request.args.get("quarter")
        business_size = request.args.get("business_size")

        base_sql = """
            SELECT
                p.barangay,
                COUNT(DISTINCT p.business_id) AS businesses,
                SUM(p.actual_tax_gap) / 1000000.0 AS actual_tax_gap,
                SUM(p.actual_collected) / 1000000.0 AS actual_collected,
                SUM(p.forecasted_revenue) / 1000000.0 AS forecasted_revenue,
                CASE
                    WHEN SUM(p.forecasted_revenue) > 0
                    THEN (SUM(p.actual_collected) / SUM(p.forecasted_revenue)) * 100.0
                    ELSE AVG(p.performance_score)
                END AS performance_score
            FROM predictions p
            WHERE 1=1
        """
        params = {}

        if year:
            base_sql += " AND p.year = :year"
            params["year"] = int(year)
        if quarter:
            base_sql += " AND p.quarter = :quarter"
            params["quarter"] = quarter
        if business_size:
            base_sql += " AND p.business_size = :business_size"
            params["business_size"] = business_size.upper()

        base_sql += " GROUP BY p.barangay ORDER BY p.barangay LIMIT :limit OFFSET :offset"

        with engine.begin() as conn:
            result = conn.execute(text(base_sql), {**params, "limit": limit, "offset": offset})
            rows = [dict(row) for row in result.mappings()]
            total = conn.execute(text("SELECT COUNT(DISTINCT barangay) FROM predictions")).scalar()

        return jsonify({"rows": rows, "page": page, "limit": limit, "total": total}), 200
    except Exception as e:
        return _error(e)


@app.route("/api/stats/count-by", methods=["POST"])
def get_count_by():
    try:
        payload = request.get_json(silent=True)
        if not payload:
            return jsonify({"message": "No data received"}), 400

        rows = payload.get("data", [])
        key = payload.get("key")

        counts = {}
        for item in rows:
            val = item.get(key) if item.get(key) else '—'
            if key == "compliance_status":
                val = normalize_business_status_value(val)
            counts[val] = counts.get(val, 0) + 1

        result = sorted([[k, v] for k, v in counts.items()], key=lambda x: x[1], reverse=True)

        return jsonify({"result": result}), 200
    except Exception as e:
        return _error(e)


@app.route("/api/stats/barangay-size", methods=["POST"])
def get_barangay_size():
    try:
        payload = request.get_json(silent=True)
        if not payload:
            return jsonify({"message": "No data received"}), 400

        rows = payload.get("data", [])

        counts = {}
        for row in rows:
            barangay = row.get('barangay') if row.get('barangay') else '—'
            size = row.get('business_size') if row.get('business_size') else '—'

            if barangay not in counts:
                counts[barangay] = {
                    'barangay': barangay,
                    'MICRO': 0,
                    'SMALL': 0,
                    'MEDIUM': 0,
                    'LARGE': 0,
                    'total': 0,
                }

            if size in ['MICRO', 'SMALL', 'MEDIUM', 'LARGE']:
                counts[barangay][size] += 1
            counts[barangay]['total'] += 1

        result = sorted(counts.values(), key=lambda x: x['barangay'])

        return jsonify({"result": result}), 200
    except Exception as e:
        return _error(e)


if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True, port=5000)