import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const EVENT_COLORS = {
    task: 'bg-blue-500',
    project: 'bg-purple-500',
    feeding: 'bg-orange-500',
};

export default function ProjectCalendar({ tasks, projects, feedingGroups, otherReptiles = [] }) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [expandedDay, setExpandedDay] = useState(null); // 'yyyy-MM-dd' or null

    const days = useMemo(() => {
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    // Compute all events for the month
    const eventsForDay = useMemo(() => {
        const map = {};
        const addEvent = (dateStr, event) => {
            if (!map[dateStr]) map[dateStr] = [];
            map[dateStr].push(event);
        };

        // Tasks with due dates
        tasks.forEach(task => {
            if (task.due_date) {
                const d = format(new Date(task.due_date), 'yyyy-MM-dd');
                addEvent(d, { type: 'task', label: task.title, color: EVENT_COLORS.task });
            }
            if (task.next_due_date) {
                const d = format(new Date(task.next_due_date), 'yyyy-MM-dd');
                addEvent(d, { type: 'task', label: `🔁 ${task.title}`, color: EVENT_COLORS.task });
            }
        });

        // Projects with due dates
        projects.forEach(project => {
            if (project.due_date) {
                const d = format(new Date(project.due_date), 'yyyy-MM-dd');
                addEvent(d, { type: 'project', label: project.name, color: EVENT_COLORS.project });
            }
        });

        // Other reptile feeding schedules
        otherReptiles.forEach(reptile => {
            if (!reptile.last_fed_date || !reptile.feeding_interval_days || !reptile.feeding_reminder_enabled) return;
            let nextFeed = addDays(new Date(reptile.last_fed_date), reptile.feeding_interval_days);
            const monthEnd = endOfMonth(currentMonth);
            const monthStart = startOfMonth(currentMonth);
            while (nextFeed <= monthEnd) {
                if (nextFeed >= monthStart) {
                    const d = format(nextFeed, 'yyyy-MM-dd');
                    addEvent(d, {
                        type: 'reptile_feeding',
                        label: `Feed ${reptile.name}`,
                        color: 'bg-teal-600',
                        bgColor: null
                    });
                }
                nextFeed = addDays(nextFeed, reptile.feeding_interval_days);
            }
        });

        // Feeding group schedules - show next feeding days
        feedingGroups.forEach(group => {
            if (!group.last_fed_date || !group.interval_days) return;
            let nextFeed = addDays(new Date(group.last_fed_date), group.interval_days);
            const monthEnd = endOfMonth(currentMonth);
            const monthStart = startOfMonth(currentMonth);
            // Show all feeding days in this month
            while (nextFeed <= monthEnd) {
                if (nextFeed >= monthStart) {
                    const d = format(nextFeed, 'yyyy-MM-dd');
                    addEvent(d, { 
                        type: 'feeding', 
                        label: `Feed ${group.label}: ${group.diet_type}`, 
                        color: group.color ? '' : EVENT_COLORS.feeding,
                        bgColor: group.color ? `${group.color}cc` : null
                    });
                }
                nextFeed = addDays(nextFeed, group.interval_days);
            }
        });

        return map;
    }, [tasks, projects, feedingGroups, currentMonth]);

    const startDayOfWeek = days[0]?.getDay() || 0; // 0=Sun

    return (
        <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
                    <ChevronLeft className="w-4 h-4" />
                </Button>
                <h2 className="text-slate-100 font-bold text-lg">{format(currentMonth, 'MMMM yyyy')}</h2>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>

            {/* Day labels */}
            <div className="grid grid-cols-7 border-b border-slate-700">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                    <div key={d} className="text-center text-xs text-slate-500 py-2 font-medium">
                        <span className="hidden sm:inline">{d}</span>
                        <span className="sm:hidden">{d[0]}</span>
                    </div>
                ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7">
                {/* Empty cells before first day */}
                {Array.from({ length: startDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="border-b border-r border-slate-800 min-h-[80px]" />
                ))}

                {days.map(day => {
                    const key = format(day, 'yyyy-MM-dd');
                    const isToday = isSameDay(day, new Date());
                    const events = eventsForDay[key] || [];
                    const hasMore = events.length > 3;

                    return (
                        <div
                            key={key}
                            onClick={() => events.length > 0 && setExpandedDay(key)}
                            className={`border-b border-r border-slate-800 min-h-[60px] sm:min-h-[80px] p-1 ${
                                isToday ? 'bg-emerald-950/40' : ''
                            } ${events.length > 0 ? 'cursor-pointer hover:bg-slate-800/50' : ''}`}
                        >
                            <div className={`text-[11px] sm:text-xs font-medium mb-1 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full ${
                                isToday ? 'bg-emerald-500 text-white' : 'text-slate-400'
                            }`}>
                                {format(day, 'd')}
                            </div>
                            {/* Mobile: show colored dots */}
                            <div className="sm:hidden flex flex-wrap gap-0.5">
                                {events.slice(0, 4).map((ev, i) => (
                                    <div
                                        key={i}
                                        className={`w-1.5 h-1.5 rounded-full ${ev.bgColor ? '' : ev.color}`}
                                        style={ev.bgColor ? { backgroundColor: ev.bgColor } : {}}
                                    />
                                ))}
                                {events.length > 4 && (
                                    <span className="text-[8px] text-slate-500 leading-none">+{events.length - 4}</span>
                                )}
                            </div>
                            {/* Desktop: show event labels */}
                            <div className="hidden sm:block space-y-0.5">
                                {events.slice(0, 3).map((ev, i) => (
                                    <div
                                        key={i}
                                        className={`text-[10px] px-1 py-0.5 rounded text-white truncate ${ev.bgColor ? '' : ev.color}`}
                                        style={ev.bgColor ? { backgroundColor: ev.bgColor } : {}}
                                        title={ev.label}
                                    >
                                        {ev.label}
                                    </div>
                                ))}
                                {hasMore && (
                                    <span className="text-[10px] text-emerald-400 w-full text-left block">
                                        +{events.length - 3} more
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Day expanded overlay */}
            {expandedDay && (() => {
                const events = eventsForDay[expandedDay] || [];
                const dayDate = new Date(expandedDay + 'T12:00:00');
                return (
                    <div
                        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
                        onClick={() => setExpandedDay(null)}
                    >
                        <div
                            className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm p-5"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-slate-100 font-bold text-lg">
                                    {format(dayDate, 'EEEE, MMMM d')}
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setExpandedDay(null)}
                                    className="text-slate-400 hover:text-slate-200 text-xl leading-none"
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="space-y-1.5 max-h-80 overflow-y-auto">
                                {events.map((ev, i) => (
                                    <div
                                        key={i}
                                        className={`text-xs px-2 py-1.5 rounded text-white ${ev.bgColor ? '' : ev.color}`}
                                        style={ev.bgColor ? { backgroundColor: ev.bgColor } : {}}
                                    >
                                        {ev.label}
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => setExpandedDay(null)}
                                className="mt-4 w-full text-sm text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg py-2 hover:bg-slate-800 transition-colors"
                            >
                                Back to Calendar
                            </button>
                        </div>
                    </div>
                );
            })()}

            {/* Legend */}
            <div className="flex flex-wrap gap-3 px-4 py-3 border-t border-slate-700">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <div className="w-3 h-3 rounded bg-blue-500" /> Tasks
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <div className="w-3 h-3 rounded bg-purple-500" /> Projects
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <div className="w-3 h-3 rounded bg-orange-500" /> Feeding Groups
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <div className="w-3 h-3 rounded bg-teal-600" /> Reptile Feeding
                </div>
            </div>
        </div>
    );
}