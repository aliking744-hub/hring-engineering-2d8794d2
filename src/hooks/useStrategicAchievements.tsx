import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Task, SAMPLE_TASKS } from "@/components/strategic-compass/erdtree/types";
import { useDemoMode } from "@/contexts/DemoModeContext";

export const useStrategicAchievements = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskIds, setNewTaskIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Try to use demo mode context, but fallback to true if not available
  let isDemoMode = true;
  try {
    const demoContext = useDemoMode();
    isDemoMode = demoContext.isDemoMode;
  } catch {
    // Context not available, use demo mode
    isDemoMode = true;
  }

  // Fetch achievements from database
  const fetchAchievements = async () => {
    setLoading(true);
    
    // If demo mode is on, use sample data
    if (isDemoMode) {
      setTasks(SAMPLE_TASKS);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("strategic_achievements")
        .select("*")
        .order("completed_at", { ascending: false });

      if (error) {
        console.error("Error fetching achievements:", error);
        setTasks([]); // Empty when no real data
        setLoading(false);
        return;
      }

      if (data && data.length > 0) {
        const mappedTasks: Task[] = data.map((item) => ({
          id: item.id,
          name: item.name,
          ownerName: item.owner_name,
          departmentId: item.department_id,
          departmentName: item.department_name,
          strategicImportance: item.strategic_importance,
          completedAt: new Date(item.completed_at),
        }));
        setTasks(mappedTasks);
      } else {
        setTasks([]); // No data available
      }
    } catch (err) {
      console.error("Error:", err);
      setError("خطا در بارگذاری داده‌ها");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to realtime updates (only when not in demo mode)
  useEffect(() => {
    fetchAchievements();

    // Only subscribe to realtime when not in demo mode
    if (isDemoMode) return;

    const channel = supabase
      .channel("strategic-achievements-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "strategic_achievements",
        },
        () => {
          void fetchAchievements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isDemoMode]);

  return { tasks, newTaskIds, loading, error, refetch: fetchAchievements, isDemoMode };
};
