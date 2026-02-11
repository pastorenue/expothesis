# Flow Studio Quickstart

This guide explains how to run and test the Flow Studio UI.

## Start the app (Docker Compose)

From the repository root:

```bash
docker-compose up --build -d
```

Open the UI:

```
http://localhost:3001/
```

Notes:
- The Compose override runs the frontend in dev mode (Vite) on port 3001.
- The backend API is available at http://localhost:8080.

## Build a valid flow

Connections are enforced in this order:

```
Start → Experiment → User Group → Metric → Run
```

Notes:
- Start can only connect to Experiment.
- Experiment can connect to multiple User Groups.
- User Group can connect to multiple Metrics or Hypotheses.
- Metrics can connect to the Run trigger (Run should be last).

## Run simulation + live chart

Once **Run** has an incoming connection, the simulation starts automatically:

1. Add nodes using the left panel dropdowns (Triggers, Experiments, User Groups, Metrics).
2. Connect them in the valid order above.
3. Watch the **Simulation Output** chart under the board.
   - Each connected user group becomes a separate line.

## Tips

- Drag nodes around the canvas (snaps to grid).
- Click a line to remove a connection.
- Click a node to see details and delete it.
- Clicking the canvas while connecting cancels the pending link.
