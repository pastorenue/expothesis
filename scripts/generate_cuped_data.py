#!/usr/bin/env python3
import json
import time
import random
import urllib.request
import sys
from datetime import datetime, timedelta

# Configuration
BASE_URL = "http://localhost:8080/api"

def make_request(path, method="GET", data=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    
    body = None
    if data:
        body = json.dumps(data).encode('utf-8')
    
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"Error making {method} request to {url}: {e}")
        return None

def create_experiment():
    print("Creating CUPED Test Experiment...")
    data = {
        "name": f"CUPED Test {int(time.time())}",
        "description": "Experiment for testing CUPED variance reduction",
        "variants": [
            {
                "name": "control",
                "description": "Control Group",
                "allocation_percent": 50.0,
                "is_control": True
            },
            {
                "name": "treatment",
                "description": "Treatment Group",
                "allocation_percent": 50.0,
                "is_control": False
            }
        ],
        "primary_metric": "revenue",
        "user_groups": [], # Empty list if no targeting
        "hypothesis": {
            "metric_type": "continuous",
            "null_hypothesis": "No difference",
            "alternative_hypothesis": "Treatment > Control",
            "expected_effect_size": 0.05,
            "significance_level": 0.05,
            "power": 0.8
        }
    }
    return make_request("/experiments", method="POST", data=data)

def start_experiment(exp_id):
    print(f"Starting experiment {exp_id}...")
    return make_request(f"/experiments/{exp_id}/start", method="POST")

def create_test_group():
    print("Ensuring test group exists...")
    # Try to find existing or create new
    groups = make_request("/user-groups")
    if groups:
        for g in groups:
            if g.get("name") == "CUPED Test Group":
                return g
    
    data = {
        "name": "CUPED Test Group",
        "description": "Group for CUPED testing",
        "assignment_rule": "random"
    }
    return make_request("/user-groups", method="POST", data=data)

def generate_data(exp_id, group_id, num_users=500):
    print(f"Generating data for {num_users} users...")
    
    # Covariate correlation settings
    # High pre-experiment spend correlates with high post-experiment revenue
    # But treatment increases revenue by lift%
    
    pre_mean = 100.0
    pre_std = 30.0
    correlation = 0.8
    lift = 0.05 # 5% lift
    
    variants = ["control", "treatment"]
    
    now = datetime.utcnow()
    pre_experiment_time = now - timedelta(days=15)
    
    for i in range(num_users):
        user_id = f"user_{i}_{int(time.time())}"
        
        # 1. Determine Variant First (to tag pre-experiment data correctly for this test)
        # In a real scenario, pre-data doesn't know the future variant.
        # But our backend CUPED implementation currently queries pre-data by *current* variant
        # (assuming data is partitioned/tagged by variant in the same table).
        # To make the test work, we must "predict" the variant or force it.
        
        # Simulating random assignment client-side for data generation
        chosen_variant = random.choice(variants)
        
        # 2. Generate Pre-Experiment Covariate (e.g., 'pre_spend')
        # This happened 15 days ago
        pre_spend = max(0, random.gauss(pre_mean, pre_std))
        
        event_data = {
            "experiment_id": exp_id,
            "user_id": user_id,
            "variant": chosen_variant, # CRITICAL: Must match the assigned variant for the backend query to find it
            "metric_name": "pre_spend",
            "metric_value": pre_spend,
            "timestamp": pre_experiment_time.isoformat() + "Z"
        }
        make_request("/events", method="POST", data=event_data)
        
        # 3. Assign User to Variant (forcing the one we chose)
        assign_data = {
            "user_id": user_id,
            "experiment_id": exp_id,
            "group_id": group_id,
            "forced_variant": chosen_variant 
        }
        
        # Note: The /user-groups/assign endpoint might ignore forced_variant if not implemented,
        # but for this test script we need consistency. 
        # If the API ignores it, we might get a mismatch.
        # Let's hope the random seed creates a distribution, or we rely on the API's return.
        
        # Actually, to be safe, let's just ask the API for assignment FIRST, 
        # then log the pre-experiment data with that variant. 
        # But assignment usually triggers an "exposure" or "assignment" event.
        # We can just call assign, get the variant, then log "pre-experiment" data with that variant,
        # even though logically pre-experiment happened before.
        # The timestamp will place it correctly in the past.
        
        del assign_data["forced_variant"]
        resp = make_request("/user-groups/assign", method="POST", data=assign_data)
        if resp and "variant" in resp:
            variant = resp["variant"]
        else:
            variant = chosen_variant # Fallback
            
        # Re-log pre-experiment data if we guessed wrong? 
        # No, let's just use the assigned variant for the pre-experiment data payload.
        # So we move step 2 AFTER step 3.
        
        # ... Wait, moving logic ...
        
        # 1. Assign User (get their variant)
        assign_data = {
            "user_id": user_id,
            "experiment_id": exp_id,
            "group_id": group_id
        }
        resp = make_request("/user-groups/assign", method="POST", data=assign_data)
        if resp and "variant" in resp:
            variant = resp["variant"]
        else:
            print(f"Failed to assign user {user_id}")
            continue

        # 2. Generate Pre-Experiment Covariate (BACKDATED)
        pre_spend = max(0, random.gauss(pre_mean, pre_std))
        
        event_data = {
            "experiment_id": exp_id,
            "user_id": user_id,
            "variant": variant, # Tag with the assigned variant so backend finds it matches
            "metric_name": "pre_spend",
            "metric_value": pre_spend,
            "timestamp": pre_experiment_time.isoformat() + "Z"
        }
        make_request("/events", method="POST", data=event_data)

        # 3. Generate Post-Experiment Metric
        noise = random.gauss(0, pre_std * (1 - correlation**2)**0.5)
        base_revenue = pre_mean + correlation * (pre_spend - pre_mean) + noise
        
        final_revenue = base_revenue
        if variant == "treatment":
            final_revenue *= (1 + lift)
            
        final_revenue = max(0, final_revenue)
        
        event_data = {
            "experiment_id": exp_id,
            "user_id": user_id,
            "variant": variant,
            "metric_name": "revenue",
            "metric_value": final_revenue,
        }
        make_request("/events", method="POST", data=event_data)
        
        if i % 50 == 0:
            print(f"Processed {i} users...")

def main():
    # 1. Create/Get Experiment
    exp = create_experiment()
    if not exp:
        print("Failed to create experiment")
        sys.exit(1)
    exp_id = exp["id"]
    print(f"Created Experiment: {exp_id}")
    
    # 2. Create Group
    group = create_test_group()
    if not group:
         print("Failed to create group")
         sys.exit(1)
    group_id = group["id"]
    
    # 3. Start Experiment (so assignments work)
    start_experiment(exp_id)
    
    # 4. Generate Data
    generate_data(exp_id, group_id)
    
    print("\nData Generation Complete!")
    print(f"Experiment ID: {exp_id}")
    print("Instructions:")
    print(f"1. Open http://localhost:3001/experiment/{exp_id}")
    print("2. Click 'Configure CUPED'")
    print("3. Set Covariate Metric to 'pre_spend' and Lookback Window to 30 days")
    print("4. Save and Enable 'CUPED Variance Reduction'")

if __name__ == "__main__":
    main()
