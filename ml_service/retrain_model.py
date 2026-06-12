import pickle
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error

# Feature columns matching ngo_scoring_engine.py
FEATURE_COLS = [
    "osrm_time",
    "osrm_distance",
    "actual_distance_to_destination",
    "route_type_encoded",
    "segment_osrm_time",
    "segment_osrm_distance",
    "start_scan_to_end_scan",
    "distance_efficiency",
    "segment_time_ratio",
]

# Generate synthetic training data
np.random.seed(42)
n = 2000

osrm_time       = np.random.uniform(5, 60, n)
osrm_dist       = np.random.uniform(2, 30, n)
actual_dist     = osrm_dist * np.random.uniform(1.0, 1.15, n)
route_type      = np.random.randint(0, 2, n)
seg_time        = osrm_time * np.random.uniform(0.9, 1.1, n)
seg_dist        = osrm_dist * np.random.uniform(0.9, 1.1, n)
scan_to_scan    = osrm_time * np.random.uniform(1.0, 1.2, n)
dist_efficiency = np.random.uniform(1.0, 1.2, n)
seg_time_ratio  = np.random.uniform(0.9, 1.1, n)

X = np.column_stack([
    osrm_time, osrm_dist, actual_dist, route_type,
    seg_time, seg_dist, scan_to_scan, dist_efficiency, seg_time_ratio
])

# Target: actual travel time (slightly noisy version of osrm_time)
y = osrm_time * 0.95 + route_type * 3 + np.random.normal(0, 2, n)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = GradientBoostingRegressor(n_estimators=200, max_depth=4, random_state=42)
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
r2  = r2_score(y_test, y_pred)
mae = mean_absolute_error(y_test, y_pred)

print(f"R2  = {r2:.4f}")
print(f"MAE = {mae:.2f} mins")

# Bundle matches what ngo_scoring_engine.py expects
bundle = {
    "model":       model,
    "model_name":  "Gradient Boosting",
    "feature_cols": FEATURE_COLS,
    "metrics": {
        "R2":  round(r2, 4),
        "MAE": round(mae, 2),
    },
}

with open("best_travel_time_model.pkl", "wb") as f:
    pickle.dump(bundle, f)

print("Saved best_travel_time_model.pkl successfully!")
