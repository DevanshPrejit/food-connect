# ResQMeal

**ResQMeal** is an intelligent food rescue platform that connects food donors (restaurants, hotels, caterers) with nearby NGOs using a machine learning-powered matching engine — reducing food wastage and fighting hunger simultaneously.

---

## Features

- **Smart Match Engine** — ML-powered NGO ranking based on distance, food urgency, and compatibility
- **50km Radius Filter** — Only nearby NGOs are shown, using real geocoding via OpenStreetMap
- **Cascade Broadcast Notifications** — Top 3 NGOs notified first; if no response in 30 mins, all remaining NGOs are broadcast simultaneously
- **Urgency Scoring** — Food listings are auto-tagged (Urgent / Medium / Safe) based on expiry time
- **Real-time Updates** — Donors get instant notifications when an NGO accepts their donation
- **Impact Dashboard** — Track total meals donated and completed donations
- **Food Surplus Map** — Visual map of active listings for NGOs
- **Pickup Tracking** — Live map shown to NGO after accepting a donation

---

## How the ML Matching Works

```
Score = 0.4 × (1 / travel_time)   ← distance weight
      + 0.4 × urgency_score        ← expiry urgency
      + 0.2 × food_compatibility   ← food type match
```

The travel time component is predicted by a **Gradient Boosting model** trained on the Delhivery logistics dataset. NGOs are ranked by score and only those within 50km of the donor are shown.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Backend / DB | Supabase (PostgreSQL + Auth + Realtime) |
| ML Service | Python + FastAPI + scikit-learn |
| ML Model | Gradient Boosting (trained on Delhivery data) |
| Geocoding | OpenStreetMap Nominatim (free, no API key) |
| Maps | Leaflet.js |

---

## Project Structure

```
food-connect/
├── src/
│   ├── components/
│   │   ├── SmartMatch.tsx        # ML results UI component
│   │   ├── FoodSurplusMap.tsx    # NGO map view
│   │   └── PickupMap.tsx         # Pickup tracking map
│   ├── pages/
│   │   ├── DonorDashboard.tsx    # Donor interface
│   │   └── NGODashboard.tsx      # NGO interface
│   └── lib/
│       └── ml-api.ts             # ML service API client
│
├── ml_service/
│   ├── ml_service.py             # FastAPI wrapper
│   ├── ngo_scoring_engine.py     # Scoring + notification engine
│   ├── train_travel_time_model.py# Model training script
│   └── best_travel_time_model.pkl# Trained model (generated)
│
├── supabase/
│   └── migrations/               # Database schema
│
├── start.bat                     # One-click startup (Windows)
└── vite.config.ts
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- A Supabase project

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/resqmeal.git
cd resqmeal/food-connect
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Install Python dependencies

```bash
cd ml_service
pip install fastapi uvicorn pandas scikit-learn xgboost pydantic requests
```

### 4. Set up environment variables

Create a `.env` file in the `food-connect` root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 5. Train the ML model

Download the Delhivery dataset, run the preprocessing script, then train:

```bash
cd ml_service
python delhivery_data_prep.py
python train_travel_time_model.py
```

This generates `best_travel_time_model.pkl`.

### 6. Start the project

**Windows — double click:**
```
start.bat
```

**Or manually in separate terminals:**

```bash
# Terminal 1 — ML service
cd ml_service
uvicorn ml_service:app --port 8000 --reload

# Terminal 2 — React frontend
cd food-connect
npm run dev
```

Open `http://localhost:8080` in your browser.

---

## Database Schema

| Table | Description |
|---|---|
| `profiles` | User profiles with role (donor / ngo), location, mobile number |
| `listings` | Food donation listings created by donors |
| `food_items` | Individual food items linked to listings with category |
| `acceptances` | Records of NGO acceptances |

---

## Notification Flow

```
Donor submits listing
        ↓
ML engine scores all NGOs within 50km
        ↓
Phase 1 — Top 3 NGOs notified simultaneously
        ↓
Wait 30 minutes
        ↓
If no acceptance → Phase 2 broadcast to ALL remaining NGOs
        ↓
First NGO to accept wins → donation matched
```

If food expires in under 6 hours, Phase 1 is skipped and all NGOs are broadcast immediately.

---

## User Roles

**Donor**
- Create food listings with name, type, quantity, expiry time, and pickup location
- Trigger Smart Match to find the best NGO
- Dispatch notifications to top NGOs
- Track donation status in real time

**NGO**
- View available food listings on a map
- See ML-ranked recommendations based on proximity and food type
- Accept or decline donations
- Track pickup history and impact stats

---

## ML Model Details

The travel time estimator was trained on the **Delhivery logistics dataset** with the following features:

| Feature | Description |
|---|---|
| `osrm_time` | OSRM estimated travel time |
| `osrm_distance` | OSRM estimated distance |
| `actual_distance_to_destination` | Real distance in km |
| `route_type_encoded` | FTL=1, Carting=0 |
| `segment_osrm_time` | Segment-level OSRM time |
| `segment_osrm_distance` | Segment-level OSRM distance |
| `distance_efficiency` | Actual vs OSRM distance ratio |
| `segment_time_ratio` | Segment actual vs OSRM time ratio |

**Target:** `actual_time` (real delivery time in minutes)

Three models are trained and compared — Random Forest, Gradient Boosting, and XGBoost. The best model by R² score is automatically selected and saved.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## Acknowledgements

- [Delhivery](https://www.kaggle.com/datasets/santanukundu/delhivery-dataset) for the logistics dataset in Kaggle by Santanu Kundu used to train the ML model
- [OpenStreetMap Nominatim](https://nominatim.org/) for free geocoding
- [Supabase](https://supabase.com/) for the backend infrastructure
- All the NGOs working tirelessly to fight hunger
