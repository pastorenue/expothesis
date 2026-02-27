import React from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { experimentApi } from "../../services/api";
import { ExperimentCreator } from "../../components/ExperimentCreator";
import { LoadingSpinner } from "../../components/Common";
import { useAccount } from "../../contexts/AccountContext";
import { Experiment, CreateExperimentRequest } from "../../types";

import { ExperimentsHeader } from "./ExperimentsHeader";
import { ExperimentsTable } from "./ExperimentsTable";
import { EmptyState } from "./EmptyState";

export function HomePage() {
  const { activeAccountId } = useAccount();
  const [showCreator, setShowCreator] = React.useState(false);
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [sortConfig, setSortConfig] = React.useState<{
    key: "name" | "start_date";
    direction: "asc" | "desc";
  }>({
    key: "name",
    direction: "asc",
  });

  React.useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowCreator(true);
    }
  }, [searchParams]);

  const { data: experiments = [], isLoading } = useQuery({
    queryKey: ["experiments", activeAccountId],
    queryFn: async () => {
      const response = await experimentApi.list();
      return response.data;
    },
    enabled: !!activeAccountId,
  });

  const sortedExperiments = React.useMemo(() => {
    const data = [...experiments];
    if (sortConfig.key === "name") {
      data.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      data.sort((a, b) => {
        const aTime = a.start_date
          ? new Date(a.start_date).getTime()
          : Number.POSITIVE_INFINITY;
        const bTime = b.start_date
          ? new Date(b.start_date).getTime()
          : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      });
    }
    if (sortConfig.direction === "desc") {
      data.reverse();
    }
    return data;
  }, [experiments, sortConfig]);

  const toggleSort = (key: "name" | "start_date") => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const startMutation = useMutation({
    mutationFn: (id: string) => experimentApi.start(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["experiments", activeAccountId],
      });
    },
  });

  const restartMutation = useMutation({
    mutationFn: (id: string) => experimentApi.restart(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["experiments", activeAccountId],
      });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => experimentApi.pause(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["experiments", activeAccountId],
      });
    },
  });

  const stopMutation = useMutation({
    mutationFn: (id: string) => experimentApi.stop(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["experiments", activeAccountId],
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateExperimentRequest) => experimentApi.create(data),
    onSuccess: (response) => {
      queryClient.setQueryData<Experiment[]>(
        ["experiments", activeAccountId],
        (oldData) => {
          const existing = Array.isArray(oldData) ? oldData : [];
          return [response.data, ...existing];
        },
      );
      setShowCreator(false);
    },
  });

  if (isLoading) return <LoadingSpinner fullHeight />;

  if (showCreator) {
    return (
      <ExperimentCreator
        onSubmit={(data) => createMutation.mutate(data)}
        onCancel={() => setShowCreator(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <ExperimentsHeader onNewClick={() => setShowCreator(true)} />

      {experiments.length === 0 ? (
        <EmptyState onNewClick={() => setShowCreator(true)} />
      ) : (
        <ExperimentsTable
          experiments={sortedExperiments}
          sortConfig={sortConfig}
          onSort={toggleSort}
          onNavigate={(id) => navigate(`/experiment/${id}`)}
          onStart={(id) => startMutation.mutate(id)}
          onPause={(id) => pauseMutation.mutate(id)}
          onStop={(id) => stopMutation.mutate(id)}
          onRestart={(id) => restartMutation.mutate(id)}
        />
      )}
    </div>
  );
}
