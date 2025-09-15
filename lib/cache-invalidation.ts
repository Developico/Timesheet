import { invalidate } from './client-cache';

// Central helpers for cache invalidation – extend when mutations are implemented.

export function invalidateProjects(){
  invalidate('projects:v1');
}

export function invalidateConsultants(){
  invalidate('consultants:v1');
}

export function invalidateDaysOffRange(from: string, to: string){
  invalidate(`daysoff:v1:${from}:${to}`); // targeted
}

// Broad invalidation (e.g., after adding time entry) – for now remove all ranges.
export function invalidateAllDaysOff(){
  invalidate('daysoff:v1:');
}

export function invalidateTimeEntries(){
  invalidate('timeEntries:v1:');
}

// Potential future granular invalidation by date:
export function invalidateTimeEntriesForDate(dateIso: string){
  // If keys contained date segmentation we could target more precisely.
  // Current key format includes from/to; simplest approach is full namespace invalidation.
  invalidateTimeEntries();
}
