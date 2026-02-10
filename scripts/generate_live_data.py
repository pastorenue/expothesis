#!/usr/bin/env python3
import json
import time
import random
import urllib.request
import sys

# Configuration
BASE_URL = "http://localhost:8080/api"
DEFAULT_CONVERSION_RATES = {
    "control": 0.10,    # 10% conversion rate
    "treatment": 0.12,  # 12% conversion rate (20% lift)
}

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

def get_latest_experiment():
    experiments = make_request("/experiments")
    if not experiments:
        return None
    return experiments[0] if experiments else None

def start_experiment(exp_id):
    print(f"Starting experiment {exp_id}...")
    return make_request(f"/experiments/{exp_id}/start", method="POST")

def create_test_group():
    print("Creating live test group...")
    data = {
        "name": "Live Test Group",
        "description": "Automatically created for live testing",
        "assignment_rule": "random"
    }
    return make_request("/user-groups", method="POST", data=data)

def generate_live_data(exp_id, group_id, variants, event_name="conversion", interval=0.5):
    print(f"Generating live data for experiment {exp_id} (Group: {group_id})...")
    print(f"Press Ctrl+C to stop.")
    
    user_count = 0
    conversions = {v: 0 for v in variants}
    sessions = {v: 0 for v in variants}
    
    try:
        while True:
            # 1. Pick a random variant (simulating assignment distribution)
            variant_name = random.choice(variants)
            user_id = f"sim_user_{random.randint(100000, 999999)}"
            
            # 2. Assign user to variant via backend
            assign_data = {
                "user_id": user_id,
                "experiment_id": exp_id,
                "group_id": group_id
            }
            make_request("/user-groups/assign", method="POST", data=assign_data)

            # 3. Decide if they "convert" based on rate
            rate = DEFAULT_CONVERSION_RATES.get(variant_name, 0.10)
            did_convert = random.random() < rate
            
            if did_convert:
                event_data = {
                    "experiment_id": exp_id,
                    "user_id": user_id,
                    "variant": variant_name,
                    "metric_name": event_name,
                    "metric_value": 1.0
                }
                make_request("/events", method="POST", data=event_data)
                conversions[variant_name] += 1
            
            sessions[variant_name] += 1
            user_count += 1
            
            if user_count % 10 == 0:
                print(f"Iters: {user_count} | ", end="")
                stats = [f"{v}: {conversions[v]}/{sessions[v]}" for v in variants]
                print(", ".join(stats))
            
            time.sleep(interval)
            
    except KeyboardInterrupt:
        print("\nStopping data generation.")

if __name__ == "__main__":
    target_id = sys.argv[1] if len(sys.argv) > 1 else None
    
    if not target_id:
        latest = get_latest_experiment()
        if latest:
            target_id = latest["id"]
            print(f"Using latest experiment: {latest['name']} ({target_id})")
        else:
            print("No experiments found.")
            sys.exit(1)
            
    # Ensure it's started
    start_experiment(target_id)
    
    # Create/Get group
    group = create_test_group()
    if not group:
        print("Failed to create user group.")
        sys.exit(1)
    group_id = group["id"]

    # Get variants from experiment details
    exp_details = make_request(f"/experiments/{target_id}")
    if not exp_details:
        print("Could not fetch experiment details.")
        sys.exit(1)
        
    variant_names = [v["name"] for v in exp_details["variants"]]
    metric = exp_details.get("primary_metric", "conversion")
    
    generate_live_data(target_id, group_id, variant_names, event_name=metric)
