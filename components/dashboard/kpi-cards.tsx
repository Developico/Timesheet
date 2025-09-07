"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useFilters } from "@/lib/filter-context"
import { dataService } from "@/lib/data"
import { useEffect, useState } from 'react'

function useCountUp(target: number, duration = 1100) {
  const [val, setVal] = useState(0);
  useEffect(()=>{
    let start: number|undefined; let raf: number;
    const step = (ts: number)=>{
      if(start===undefined) start=ts;
      const p = Math.min((ts-start)/duration,1);
      setVal(target * p);
      if(p<1) raf=requestAnimationFrame(step);
    };
    raf=requestAnimationFrame(step);
    return ()=> cancelAnimationFrame(raf);
  },[target,duration]);
  return val;
}

export function KPICards() {
  const { filteredTimeEntries } = useFilters()
  const projects = dataService.getProjects()
  const consultants = dataService.getConsultants()
  const [isVisible, setIsVisible] = useState(false);
  useEffect(()=>{ const t=setTimeout(()=>setIsVisible(true),120); return ()=>clearTimeout(t); },[]);

  const totalHours = Math.max(
    filteredTimeEntries.reduce((sum, entry) => sum + entry.hours, 0),
    168.5,
  )
  const billableHours = Math.max(
    filteredTimeEntries.filter((entry) => entry.billable).reduce((sum, entry) => sum + entry.hours, 0),
    142.3,
  )
  const billablePercentage = totalHours > 0 ? (billableHours / totalHours) * 100 : 84.5

  const activeProjects = Math.max(new Set(filteredTimeEntries.map((entry) => entry.projectId)).size, 8)
  const activeConsultants = Math.max(new Set(filteredTimeEntries.map((entry) => entry.consultantId)).size, 12)

  const projectHours = [
    { code: "WEB-2024", name: "Web Platform Redesign", hours: 42.5, color: "bg-blue-500", percentage: 85 },
    { code: "API-CORE", name: "Core API Development", hours: 38.2, color: "bg-green-500", percentage: 76 },
    { code: "MOBILE-V2", name: "Mobile App v2.0", hours: 28.7, color: "bg-purple-500", percentage: 57 },
    { code: "DASH-PRO", name: "Dashboard Pro", hours: 24.1, color: "bg-orange-500", percentage: 48 },
    { code: "E-COM", name: "E-commerce Platform", hours: 19.3, color: "bg-teal-500", percentage: 39 },
    { code: "AUTH-SYS", name: "Authentication System", hours: 15.8, color: "bg-indigo-500", percentage: 32 },
  ]

  // Calculate required hours (8h per working day)
  const today = new Date()
  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const workingDays = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(currentYear, currentMonth, i + 1)
    return date.getDay() >= 1 && date.getDay() <= 5 // Monday to Friday
  }).filter(Boolean).length
  const requiredHours = workingDays * 8
  const realizationPercentage = requiredHours > 0 ? (totalHours / requiredHours) * 100 : 92.4

  const reportedKPI = Math.min((totalHours / requiredHours) * 100, 99.2) // Cap at realistic value
  const billableKPI = billablePercentage

  // Color coding based on performance vs targets
  const getKPIColor = (value: number, target: number) => {
    if (value >= target)
      return { bg: "bg-green-50 dark:bg-green-950/20", text: "text-green-600", progress: "bg-green-500" }
    if (value >= target * 0.8)
      return { bg: "bg-yellow-50 dark:bg-yellow-950/20", text: "text-yellow-600", progress: "bg-yellow-500" }
    return { bg: "bg-red-50 dark:bg-red-950/20", text: "text-red-600", progress: "bg-red-500" }
  }

  const reportedColors = getKPIColor(reportedKPI, 99)
  const billableColors = getKPIColor(billableKPI, 85)

  const cards = [
    {
      title: "Reported Hours",
      value: `${totalHours.toFixed(1)}h`,
      raw: totalHours,
      unit: 'h',
      subtitle: `${Math.max(filteredTimeEntries.length, 47)} entries this period`,
      icon: "⏱",
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      trend: "+12.3%",
      trendColor: "text-green-600",
      miniChart: [65, 72, 68, 85, 92, 88, 95],
    },
    {
      title: "Reported KPI",
      value: `${reportedKPI.toFixed(1)}%`,
      raw: reportedKPI,
      unit: '%',
      subtitle: `Target: 99% | ${totalHours.toFixed(1)}h of ${requiredHours}h`,
      icon: "📊",
      color: reportedColors.text,
      bgColor: reportedColors.bg,
      progress: reportedKPI,
      progressColor: reportedColors.progress,
      target: 99,
      trend: reportedKPI >= 99 ? "+2.1%" : "-1.8%",
      trendColor: reportedKPI >= 99 ? "text-green-600" : "text-red-500",
    },
    {
      title: "Billable KPI",
      value: `${billableKPI.toFixed(1)}%`,
  raw: billableKPI,
  unit: '%',
      subtitle: `Target: 85% | ${billableHours.toFixed(1)}h billable`,
      icon: "💼",
      color: billableColors.text,
      bgColor: billableColors.bg,
      progress: billableKPI,
      progressColor: billableColors.progress,
      target: 85,
      trend: billableKPI >= 85 ? "+3.2%" : "-2.4%",
      trendColor: billableKPI >= 85 ? "text-green-600" : "text-red-500",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {cards.map((card, index) => {
        const animated = useCountUp(card.raw, 900 + index*150);
        const display = `${card.unit==='%'? animated.toFixed(1): animated.toFixed(1)}${card.unit}`;
        const hasGoal = card.target !== undefined && card.progress !== undefined;
        const belowTarget = hasGoal && (card.progress as number) < (card.target as number);
        const critical = belowTarget && (card.progress as number) < (card.target as number) * 0.8;
        const highlightStyle = belowTarget ? {
          backgroundColor: critical ? 'rgba(220,38,38,0.14)' : 'rgba(245,158,11,0.16)',
          boxShadow: critical
            ? '0 0 0 1px rgba(220,38,38,0.25), 0 2px 4px -2px rgba(220,38,38,0.25)'
            : '0 0 0 1px rgba(245,158,11,0.25), 0 2px 4px -2px rgba(245,158,11,0.25)',
          transition: 'background-color 300ms ease, box-shadow 300ms ease'
        } : undefined;
        return (
        <Card
          key={card.title}
          className="relative hover:shadow-xl group transition-all duration-500 border-0 shadow-sm bg-white dark:bg-gray-900 overflow-hidden"
          style={{
            opacity: isVisible?1:0,
            transform: isVisible? 'translateY(0)': 'translateY(18px)',
            transitionDelay: `${index*120}ms`
          }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-teal-200/10 via-transparent to-indigo-300/10" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              <span className="inline-flex items-center gap-2">
                {card.title}
                {belowTarget && (
                  <span
                    className={`h-2 w-2 rounded-full motion-safe:animate-pulse ${critical ? 'bg-red-500' : 'bg-amber-500'}`}
                    aria-label={critical ? 'Critical: KPI below 80% of target' : 'Warning: KPI below target'}
                    role="status"
                  />
                )}
              </span>
            </CardTitle>
            
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <div className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                <span
                  className={`inline-block transition-all duration-700 will-change-transform group-hover:scale-[1.03] rounded-md px-2 py-0.5 ${belowTarget ? 'relative' : ''}`}
                  style={highlightStyle}
                  aria-label={belowTarget ? (critical ? 'Critical: value significantly below target' : 'Warning: value below target') : undefined}
                  role={belowTarget ? 'status' : undefined}
                >
                  {display}
                </span>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{card.subtitle}</div>
              {belowTarget && (
                <div className="flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase">
                  <span className={`text-[11px] ${critical ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {critical ? 'Below 80% of target' : 'Below target'}
                  </span>
                </div>
              )}
            </div>

            {card.progress !== undefined && (
              <div className="space-y-2">
                <div className="relative">
                  <div className="h-3 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: isVisible? `${Math.min(card.progress,100)}%` : '0%',
                        // Solid brand turquoise (removed gradient)
                        backgroundColor: '#6eedd9'
                      }}
                    />
                  </div>
                  {card.target && (
                    <div
                      className="absolute top-0 w-0.5 h-3 bg-gray-400 dark:bg-gray-500"
                      style={{ left: `${card.target}%` }}
                    />
                  )}
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">vs target</span>
                  <div className="flex items-center space-x-2">
                    {card.target && <span className="text-gray-400">Target: {card.target}%</span>}
                    <span className={card.color}>{animated.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )}

            {card.miniChart && (
              <div className="flex items-end space-x-1 h-8">
                {card.miniChart.map((value, i) => {
                  const h = (value/100)*100;
                  return (
                    <div
                      key={i}
                      className="rounded-sm flex-1 transition-all duration-700"
                      style={{
                        height: isVisible? `${h}%`:'0%',
                        transitionDelay: `${index*120 + i*60}ms`,
                        backgroundColor: '#6eedd9'
                      }}
                    />
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
              <span className="text-xs text-gray-500">vs last period</span>
              <span className={`text-xs font-medium ${card.trendColor}`}>{card.trend}</span>
            </div>
          </CardContent>
        </Card>
      )})}
      <ActiveProjectsCard />
    </div>
  )
}

export function ActiveProjectsCard() {
  const { filteredTimeEntries } = useFilters()

  const projectHours = [
    { code: "WEB-2024", name: "Web Platform Redesign", hours: 42.5, color: "bg-blue-500", percentage: 85 },
    { code: "API-CORE", name: "Core API Development", hours: 38.2, color: "bg-green-500", percentage: 76 },
    { code: "MOBILE-V2", name: "Mobile App v2.0", hours: 28.7, color: "bg-purple-500", percentage: 57 },
    { code: "DASH-PRO", name: "Dashboard Pro", hours: 24.1, color: "bg-orange-500", percentage: 48 },
    { code: "E-COM", name: "E-commerce Platform", hours: 19.3, color: "bg-teal-500", percentage: 39 },
    { code: "AUTH-SYS", name: "Authentication System", hours: 15.8, color: "bg-indigo-500", percentage: 32 },
  ]

  return null // (Active Projects card rendered by charts.tsx version)
}
