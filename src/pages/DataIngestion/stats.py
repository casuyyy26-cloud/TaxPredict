from flask import Blueprint, request, jsonify
import pandas as pd
from .dataStats import count_by, count_by_barangay_and_size

stats_bp = Blueprint("stats", __name__)

@stats_bp.route("/api/businesses/stats", methods=["POST"])
def business_stats():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    df = pd.read_csv(file.stream)   # works because .stream is a proper buffer


    compliance_counts = count_by(df, "COMPLIANCE_STATUS")
    barangay_size_counts = count_by_barangay_and_size(df)

    return jsonify({
        "compliance_counts": compliance_counts,
        "barangay_size_counts": barangay_size_counts
    })
