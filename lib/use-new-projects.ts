"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { dataService } from "@/lib/data";
import { useAuth } from "@/lib/auth-client";

/**
 * Simple client-side tracking of "new" projects per user.
 * Assumptions:
 *  - project.startDate exists and acts as assignment date surrogate.
 *  - A project is considered NEW if startDate within NEW_DAYS window AND not viewed.
 *  - Viewed state stored in localStorage (namespaced by user id).
 */
export const NEW_DAYS = 15;
const STORAGE_PREFIX = "ts:viewedProjects:"; // ts:viewedProjects:<userId> -> JSON { [projectId]: timestamp }

interface ViewedMap { [projectId: string]: number }

export function useNewProjects() {
  const { user } = useAuth();
  let projects: any[] = []
  try {
    projects = dataService.getProjects();
  } catch {
    projects = [];
  }
  const [viewed, setViewed] = useState<ViewedMap>({});

  // Load viewed from localStorage once user available
  useEffect(()=>{
    if(!user) return;
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + user.id);
      if(raw) setViewed(JSON.parse(raw));
    } catch { /* ignore */ }
  },[user]);

  const persist = (next: ViewedMap) => {
    if(!user) return;
    try { localStorage.setItem(STORAGE_PREFIX + user.id, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const markViewed = useCallback((projectId: string) => {
    setViewed(prev => {
      if(prev[projectId]) return prev; // already
      const next = { ...prev, [projectId]: Date.now() };
      persist(next);
      return next;
    });
  },[user]);

  const newProjects = useMemo(()=>{
    const now = Date.now();
    const msPerDay = 1000*60*60*24;
    return projects.filter(p=>{
      const start = new Date(p.startDate).getTime();
      const ageDays = (now - start)/msPerDay;
      return ageDays <= NEW_DAYS && !viewed[p.id];
    });
  },[projects, viewed]);

  const isNew = useCallback((projectId: string) => newProjects.some(p=>p.id===projectId), [newProjects]);

  return { newProjects, isNew, markViewed };
}
