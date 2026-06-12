import pickle
import numpy as np
import pandas as pd
import time
import threading
from datetime import datetime, timedelta
from enum import Enum


# ── Weights & Constants ─────────────────────────
W_DISTANCE          = 0.4
W_URGENCY           = 0.4
W_COMPATIBILITY     = 0.2

TOP_N               = 3        # Number of NGOs in Phase 1
PHASE1_TIMEOUT_SEC  = 1800     # 30 minutes wait before Phase 2 broadcast
CRITICAL_HOURS      = 6        # If expiry < 6 hrs, skip to broadcast immediately


class DonationStatus(Enum):
    PENDING      = "pending"
    ACCEPTED     = "accepted"
    REJECTED     = "rejected"
    EXPIRED      = "expired"
    BROADCASTING = "broadcasting"


class NGONotificationEngine:

    def __init__(self, model_path="best_travel_time_model.pkl"):
        self.model_bundle    = self._load_model(model_path)
        self.donation_status = {}   # donation_id -> DonationStatus
        self.accepted_by     = {}   # donation_id -> ngo_name

    # ── Model loader ─────────────────────────
    def _load_model(self, path):
        try:
            with open(path, "rb") as f:
                bundle = pickle.load(f)
            print(f"[MODEL] Loaded : {bundle['model_name']}")
            print(f"        R2={bundle['metrics']['R2']:.4f}  "
                  f"MAE={bundle['metrics']['MAE']:.2f} mins\n")
            return bundle
        except FileNotFoundError:
            print(f"[ERROR] {path} not found. Run train_travel_time_model.py first.")
            exit(1)

    # ── Predict travel time ──────────────────
    def _predict_travel_time(self, trip_features: dict) -> float:
        model        = self.model_bundle["model"]
        feature_cols = self.model_bundle["feature_cols"]
        row          = {col: trip_features.get(col, 0.0) for col in feature_cols}
        df           = pd.DataFrame([row])
        return float(model.predict(df)[0])

    # ── Urgency score ────────────────────────
    def _urgency_score(self, expiry_time: datetime) -> float:
        hours_left = (expiry_time.replace(tzinfo=None) - datetime.now()).total_seconds() / 3600
        if hours_left <= 0:   return 0.0
        elif hours_left > 48: return 0.1
        elif hours_left > 24: return 0.3
        elif hours_left > 12: return 0.6
        elif hours_left > 6:  return 0.8
        else:                 return 1.0

    # ── Food compatibility ───────────────────
    FOOD_CATEGORIES = {
    "cooked_meals":   ["cooked_meals", "cooked_meal", "rice", "curry",
                       "biryani", "roti", "snacks_starters"],
    "raw_vegetables": ["raw_vegetables", "raw_produce", "veggies",
                       "greens", "salad"],
    "dairy":          ["dairy", "milk", "curd", "paneer", "cheese"],
    "bakery":         ["bakery", "bread_bakery", "bread", "cakes",
                       "biscuits", "dessert_sweets"],
    "packaged":       ["packaged", "packaged_dry", "canned",
                       "dry_goods", "beverages"],
    "fruits":         ["fruits", "fresh_fruits"],
}

    def _normalize_food(self, food_str: str) -> str:
        food_lower = food_str.lower().strip()
        for category, aliases in self.FOOD_CATEGORIES.items():
            if any(alias in food_lower for alias in aliases):
                return category
        return "other"

    def _compatibility_score(self, donor_food_input, ngo_accepted: list) -> float:
        ngo_norm   = [self._normalize_food(t) for t in ngo_accepted]
        if "all" in ngo_accepted or "all" in ngo_norm: return 0.5
        
        # Handle string input (legacy single food type)
        if isinstance(donor_food_input, str):
            donor_norm = self._normalize_food(donor_food_input)
            return 1.0 if donor_norm in ngo_norm else 0.0
            
        # Handle list of food items
        if not donor_food_input:
            return 0.0
            
        matched_items = 0
        for item in donor_food_input:
            cat = item.get("category") or self._normalize_food(item.get("name", ""))
            if cat in ngo_norm:
                matched_items += 1
                
        return matched_items / len(donor_food_input) if donor_food_input else 0.0

    # ── Score a single NGO ───────────────────
    def _score_ngo(self, donor: dict, ngo: dict) -> dict:
        travel_time  = self._predict_travel_time(ngo["trip_features"])
        time_score   = min((1.0 / max(travel_time, 1.0)) * 10, 1.0)
        urgency      = self._urgency_score(donor["expiry_time"])
        
        donor_foods  = donor.get("food_items") or donor.get("food_type", "")
        compat       = self._compatibility_score(donor_foods, ngo["accepted_types"])

        final_score  = (
            W_DISTANCE      * time_score +
            W_URGENCY       * urgency    +
            W_COMPATIBILITY * compat
        ) if compat > 0 else 0.0

        return {
            "ngo_name":           ngo["name"],
            "ngo_contact":        ngo.get("contact", "N/A"),
            "predicted_time_min": round(travel_time, 2),
            "urgency_score":      round(urgency, 3),
            "compatibility":      round(compat, 3),
            "final_score":        round(final_score, 4),
            "eligible":           compat > 0.0,
            "status":             DonationStatus.PENDING,
        }

    # ── Rank all NGOs ────────────────────────
    def rank_ngos(self, donor: dict, ngo_list: list) -> pd.DataFrame:
        scores = [self._score_ngo(donor, ngo) for ngo in ngo_list]
        df     = pd.DataFrame(scores)
        df     = df[df["eligible"]].sort_values("final_score", ascending=False)
        df["rank"] = range(1, len(df) + 1)
        return df.reset_index(drop=True)

    # ── Simulate sending notification ────────
    def _send_notification(self, donation_id, ngo_name, ngo_contact,
                        donor, rank, phase, total_in_phase):
        hours_left = (donor['expiry_time'] - datetime.now()).total_seconds() / 3600
        food_desc = ", ".join([f"{item.get('name', 'Item')} ({item.get('quantity_kg', 0)}kg)" for item in donor.get("food_items", [])]) if donor.get("food_items") else f"{donor.get('food_type', 'Unknown')} ({donor.get('quantity_kg', 0)}kg)"
        message = (
            f"[Food Connect] New donation available!\n"
            f"Food: {food_desc}\n"
            f"Expires in: {hours_left:.1f} hrs\n"
            f"You are priority #{rank}.\n"
            f"Please respond within {'30 mins' if phase == 1 else '10 mins'}."
        )
        print(f"\n  [NOTIFY] -> {ngo_name} ({ngo_contact})")
        print(f"  Message: {message}")

        # Send real SMS
        try:
            # send_sms(ngo_contact, message)
            print(f"  [SMS SENT] to {ngo_contact}")
        except Exception as e:
            print(f"  [SMS FAILED] {e}")

    # ── Handle NGO response (call this when NGO responds) ──
    def handle_response(self, donation_id: str, ngo_name: str, accepted: bool):
        if self.donation_status.get(donation_id) == DonationStatus.ACCEPTED:
            print(f"\n  [INFO] Donation {donation_id} already accepted by "
                  f"{self.accepted_by[donation_id]}. Ignoring response from {ngo_name}.")
            return

        if accepted:
            self.donation_status[donation_id] = DonationStatus.ACCEPTED
            self.accepted_by[donation_id]     = ngo_name
            print(f"\n  {'='*50}")
            print(f"  [ACCEPTED] {ngo_name} accepted donation {donation_id}!")
            print(f"  All other NGOs will be notified to stand down.")
            print(f"  {'='*50}")
        else:
            print(f"\n  [DECLINED] {ngo_name} declined donation {donation_id}.")

    # ─────────────────────────────────────────
    # MAIN DISPATCH FUNCTION
    # ─────────────────────────────────────────
    def dispatch(self, donation_id: str, donor: dict, ngo_list: list,
                 simulate_responses: dict = None):
        """
        Main entry point for notification dispatch.

        donation_id       : unique ID for this donation
        donor             : donor info dict
        ngo_list          : list of NGO dicts
        simulate_responses: optional dict {ngo_name: True/False} for demo simulation
        """
        print("=" * 60)
        print(f"  DONATION DISPATCH  |  ID: {donation_id}")
        print("=" * 60)
        print(f"  Donor     : {donor['donor_name']}")
        food_desc = ", ".join([f"{i.get('name', 'Item')} ({i.get('quantity_kg', 0)}kg)" for i in donor.get("food_items", [])]) if donor.get("food_items") else f"{donor.get('food_type', 'Unknown')} ({donor.get('quantity_kg', 0)}kg)"
        print(f"  Food      : {food_desc}")
        hours_left = (donor['expiry_time'] - datetime.now()).total_seconds() / 3600
        print(f"  Expires   : {hours_left:.1f} hours from now")

        # ── Step 1: Rank all NGOs ─────────────
        ranked = self.rank_ngos(donor, ngo_list)

        if ranked.empty:
            print("\n  [WARN] No eligible NGOs found for this donation type.")
            self.donation_status[donation_id] = DonationStatus.EXPIRED
            return

        print(f"\n  [RANK] {len(ranked)} eligible NGOs ranked:")
        print(ranked[["rank", "ngo_name", "predicted_time_min",
                       "urgency_score", "compatibility", "final_score"]
                     ].to_string(index=False))

        self.donation_status[donation_id] = DonationStatus.PENDING

        # ── Step 2: Check urgency override ───
        is_critical = hours_left < CRITICAL_HOURS

        if is_critical:
            print(f"\n  [URGENT] Expiry < {CRITICAL_HOURS} hrs detected!")
            print(f"  Skipping Phase 1 — broadcasting to ALL {len(ranked)} NGOs now.\n")
            self._phase_broadcast(donation_id, donor, ranked,
                                  phase=1,
                                  ngos_to_notify=ranked,
                                  simulate_responses=simulate_responses)
            return

        # ── Step 3: Phase 1 — Top N ──────────
        top_ngos  = ranked.head(TOP_N)
        rest_ngos = ranked.iloc[TOP_N:]

        print(f"\n  [PHASE 1] Notifying top {len(top_ngos)} NGOs...")
        for _, row in top_ngos.iterrows():
            self._send_notification(
                donation_id, row["ngo_name"], row["ngo_contact"],
                donor, row["rank"], phase=1, total_in_phase=len(top_ngos)
            )

        # Simulate Phase 1 responses
        if simulate_responses:
            self._simulate_phase_responses(
                donation_id, top_ngos, simulate_responses, phase=1
            )

        # ── Step 4: Check if accepted ────────
        if self.donation_status.get(donation_id) == DonationStatus.ACCEPTED:
            print(f"\n  [DONE] Donation {donation_id} matched in Phase 1.")
            return

        # ── Step 5: Phase 2 — Broadcast to rest ──
        if rest_ngos.empty:
            print(f"\n  [INFO] No remaining NGOs for Phase 2 broadcast.")
            self.donation_status[donation_id] = DonationStatus.EXPIRED
            return

        print(f"\n  [WAIT] No acceptance in Phase 1.")
        print(f"  [WAIT] Waiting {PHASE1_TIMEOUT_SEC}s before Phase 2 broadcast...")
        print(f"  (Simulating wait — in production this uses a real timer)\n")

        # In production, replace this with: time.sleep(PHASE1_TIMEOUT_SEC)
        # or an async scheduler (Celery, APScheduler, etc.)

        print(f"  [PHASE 2] Broadcasting to ALL remaining {len(rest_ngos)} NGOs simultaneously...")
        self.donation_status[donation_id] = DonationStatus.BROADCASTING

        for _, row in rest_ngos.iterrows():
            self._send_notification(
                donation_id, row["ngo_name"], row["ngo_contact"],
                donor, row["rank"], phase=2, total_in_phase=len(rest_ngos)
            )

        # Simulate Phase 2 responses
        if simulate_responses:
            self._simulate_phase_responses(
                donation_id, rest_ngos, simulate_responses, phase=2
            )

        # ── Final status check ───────────────
        if self.donation_status.get(donation_id) != DonationStatus.ACCEPTED:
            print(f"\n  [WARN] No NGO accepted donation {donation_id}.")
            print(f"  Consider extending expiry window or manual intervention.")
            self.donation_status[donation_id] = DonationStatus.EXPIRED

    # ── Phase broadcast helper ───────────────
    def _phase_broadcast(self, donation_id, donor, ngos_df,
                          phase, ngos_to_notify, simulate_responses):
        for _, row in ngos_to_notify.iterrows():
            self._send_notification(
                donation_id, row["ngo_name"], row["ngo_contact"],
                donor, row["rank"], phase=phase,
                total_in_phase=len(ngos_to_notify)
            )
        if simulate_responses:
            self._simulate_phase_responses(
                donation_id, ngos_to_notify, simulate_responses, phase=phase
            )

    # ── Simulate responses for demo ──────────
    def _simulate_phase_responses(self, donation_id, ngos_df,
                                   simulate_responses, phase):
        print(f"\n  --- Simulated responses (Phase {phase}) ---")
        for _, row in ngos_df.iterrows():
            ngo_name = row["ngo_name"]
            if self.donation_status.get(donation_id) == DonationStatus.ACCEPTED:
                print(f"  [INFO] {ngo_name} response ignored — already accepted.")
                continue
            response = simulate_responses.get(ngo_name, False)
            self.handle_response(donation_id, ngo_name, accepted=response)
