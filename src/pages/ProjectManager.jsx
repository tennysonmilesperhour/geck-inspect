import { useState, useEffect, useRef } from 'react';
import { Project, Task, BreedingPlan, FeedingGroup, OtherReptile, User } from '@/entities/all';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PlusCircle, Loader2, CalendarDays, Trash2, Plus, ChevronDown, ChevronUp, Calendar, RepeatIcon, Utensils, StickyNote } from 'lucide-react';
import EmptyState from '../components/shared/EmptyState';
import PageSettingsPanel from '@/components/ui/PageSettingsPanel';
import PageHeader from '@/components/shared/PageHeader';
import usePageSettings from '@/hooks/usePageSettings';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';
import ProjectCalendar from '../components/project-manager/ProjectCalendar';
import FeedingGroupManager from '../components/project-manager/FeedingGroupManager';
import StickyNotes from '../components/project-manager/StickyNotes';
import FutureBreedingPlans from '../components/project-manager/FutureBreedingPlans';

export default function ProjectManager() {
    const [plannerPrefs, setPlannerPrefs] = usePageSettings('planner_prefs', {
        defaultTab: 'calendar',
        showCompletedTasks: true,
        compactView: false,
    });
    const [projects, setProjects] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [geckos, setGeckos] = useState([]);
    const [breedingPlans, setBreedingPlans] = useState([]);
    const [feedingGroups, setFeedingGroups] = useState([]);
    const [otherReptiles, setOtherReptiles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    // ?tab=feeding (Batch Husbandry's "Create a feeding group") opens a tab.
    const [activeTab, setActiveTab] = useState(() => {
        const wanted = new URLSearchParams(window.location.search).get('tab');
        if (['projects', 'future', 'calendar', 'feeding', 'notes'].includes(wanted)) return wanted;
        // The setting used to store 'plans', which is not a tab value, so the
        // planner opened blank for anyone who picked Plans as the default.
        return plannerPrefs.defaultTab === 'plans' ? 'projects' : plannerPrefs.defaultTab;
    });
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [expandedProjects, setExpandedProjects] = useState(new Set());
    const [taskToDelete, setTaskToDelete] = useState(null);
    const [projectToDelete, setProjectToDelete] = useState(null);
    // Ref to trigger FutureBreedingPlans' create modal from the top-level button
    const futureBreedingRef = useRef(null);

    const handleNewPlan = () => {
        if (activeTab === 'future') {
            // On the Future Breeding tab, open the breeding plan modal (sire/dam/season/year)
            futureBreedingRef.current?.openCreate();
        } else {
            // On other tabs, open the generic project modal
            setIsProjectModalOpen(true);
        }
    };
    
    const [newProject, setNewProject] = useState({
        name: '', description: '', category: 'custom', related_gecko_id: '',
        related_breeding_plan_id: '', custom_relation: '', status: 'active', due_date: '', color: '#10b981'
    });
    
    const [newTask, setNewTask] = useState({
        project_id: '', title: '', description: '', due_date: '',
        is_recurring: false, recurring_interval_days: 7, reminder_enabled: false, reminder_days_before: 1
    });
    
    useEffect(() => { loadData(); }, []);
    
    // Refresh data from Supabase. `background=true` skips the full-screen
    // loading spinner so child actions (e.g. Mark Fed Today) don't unmount
    // the tabs shell and reset the user's selected tab.
    const loadData = async ({ background = false } = {}) => {
        if (!background) setIsLoading(true);
        try {
            // Resolve current user first so we can scope every subsequent
            // query to their own data. Previously Gecko.list() was
            // unscoped, so the Future Breeding planner could pick other
            // breeders' geckos as parents, a real bug.
            const currentUser = await User.me().catch(() => null);
            const { getVisibleGeckos } = await import('@/lib/geckoAccess');
            const geckoQuery = currentUser
                ? getVisibleGeckos(currentUser)
                : Promise.resolve([]);
            const [projectsData, tasksData, geckosData, plansData, feedingData, reptilesData] = await Promise.all([
                Project.filter({ status: { $in: ['active', 'completed'] } }),
                Task.list(),
                geckoQuery,
                BreedingPlan.list(),
                FeedingGroup.list().catch(() => []),
                OtherReptile.list().catch(() => [])
            ]);
            setProjects(projectsData);
            setTasks(tasksData);
            setGeckos(geckosData.filter(g => !g.notes?.startsWith('[Manual sale]') && !g.archived));
            setBreedingPlans(plansData);
            setFeedingGroups(feedingData);
            setOtherReptiles(reptilesData);
        } catch (error) {
            console.error("Failed to load data:", error);
        }
        if (!background) setIsLoading(false);
    };

    // Task and plan due-date reminders, and the "pairing window is open"
    // notice for future plans, are sent by the server every morning
    // (enqueue_season_planner_reminders, pg_cron), so they arrive with the
    // app closed. This page no longer creates them.

    const handleCreateProject = async () => {
        if (!newProject.name) return;
        try {
            await Project.create(newProject);
            setIsProjectModalOpen(false);
            setNewProject({ name: '', description: '', category: 'custom', related_gecko_id: '', related_breeding_plan_id: '', custom_relation: '', status: 'active', due_date: '', color: '#10b981' });
            loadData({ background: true });
        } catch (error) { console.error("Failed to create project:", error); }
    };

    const handleCreateTask = async () => {
        if (!newTask.title) return;
        try {
            const taskData = { ...newTask, project_id: selectedProjectId, order_index: tasks.filter(t => t.project_id === selectedProjectId).length };
            if (newTask.is_recurring && newTask.due_date) taskData.next_due_date = newTask.due_date;
            await Task.create(taskData);
            setIsTaskModalOpen(false);
            setNewTask({ project_id: '', title: '', description: '', due_date: '', is_recurring: false, recurring_interval_days: 7, reminder_enabled: false, reminder_days_before: 1 });
            loadData({ background: true });
        } catch (error) { console.error("Failed to create task:", error); }
    };
    
    const handleToggleTask = async (taskId, currentStatus) => {
        try {
            const task = tasks.find(t => t.id === taskId);
            const updateData = { is_completed: !currentStatus };
            if (!currentStatus) {
                updateData.completed_date = new Date().toISOString();
                if (task.is_recurring && task.recurring_interval_days) {
                    updateData.last_completed_date = new Date().toISOString();
                    const nextDate = new Date();
                    nextDate.setDate(nextDate.getDate() + task.recurring_interval_days);
                    // A calendar day, not a timestamp: the evening's UTC time was
                    // already tomorrow in the Americas.
                    updateData.next_due_date = format(nextDate, 'yyyy-MM-dd');
                    updateData.is_completed = false;
                }
            } else { updateData.completed_date = null; }
            await Task.update(taskId, updateData);
            loadData({ background: true });
        } catch (error) { console.error("Failed to toggle task:", error); }
    };

    const handleDeleteTask = async () => {
        if (!taskToDelete) return;
        try { await Task.delete(taskToDelete); loadData({ background: true }); } catch (error) { console.error("Failed to delete task:", error); }
        setTaskToDelete(null);
    };

    const handleDeleteProject = async () => {
        if (!projectToDelete) return;
        try {
            const projectTasks = tasks.filter(t => t.project_id === projectToDelete);
            await Promise.all(projectTasks.map(t => Task.delete(t.id)));
            await Project.delete(projectToDelete);
            loadData({ background: true });
        } catch (error) { console.error("Failed to delete project:", error); }
        setProjectToDelete(null);
    };
    
    const toggleProjectExpand = (projectId) => {
        setExpandedProjects(prev => {
            const newSet = new Set(prev);
            if (newSet.has(projectId)) newSet.delete(projectId);
            else newSet.add(projectId);
            return newSet;
        });
    };
    
    const getProjectTasks = (projectId) => tasks.filter(t => t.project_id === projectId).sort((a, b) => a.order_index - b.order_index);
    
    const getProjectProgress = (projectId) => {
        const projectTasks = getProjectTasks(projectId);
        if (projectTasks.length === 0) return 0;
        return Math.round((projectTasks.filter(t => t.is_completed).length / projectTasks.length) * 100);
    };
    
    const getCategoryColor = (category) => {
        const colors = { gecko: 'bg-emerald-500', breeding: 'bg-pink-500', maintenance: 'bg-blue-500', health: 'bg-red-500', feeding: 'bg-orange-500', custom: 'bg-purple-500' };
        return colors[category] || colors.custom;
    };
    
    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <PageHeader
                    icon={CalendarDays}
                    title="Season Planner"
                    description="Plan breeding seasons, prep for expos, and track gecko care tasks"
                    settings={
                        <PageSettingsPanel title="Planner Settings">
                            <div>
                                <Label className="text-slate-300 text-sm mb-1 block">Default Tab</Label>
                                <Select value={plannerPrefs.defaultTab === 'plans' ? 'projects' : plannerPrefs.defaultTab} onValueChange={v => { setPlannerPrefs({ defaultTab: v }); setActiveTab(v); }}>
                                    <SelectTrigger className="w-full h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="projects">Plans</SelectItem>
                                        <SelectItem value="future">Future Breeding</SelectItem>
                                        <SelectItem value="calendar">Calendar</SelectItem>
                                        <SelectItem value="feeding">Feeding Groups</SelectItem>
                                        <SelectItem value="notes">Notes</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="text-slate-300 text-sm">Show Completed Tasks</Label>
                                <Switch checked={plannerPrefs.showCompletedTasks} onCheckedChange={v => setPlannerPrefs({ showCompletedTasks: v })} />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="text-slate-300 text-sm">Compact View</Label>
                                <Switch checked={plannerPrefs.compactView} onCheckedChange={v => setPlannerPrefs({ compactView: v })} />
                            </div>
                        </PageSettingsPanel>
                    }
                >
                    <Button onClick={handleNewPlan} className="flex-1 md:flex-none">
                        <PlusCircle className="w-5 h-5 mr-2" />
                        {activeTab === 'future' ? 'New Breeding Plan' : 'New Plan'}
                    </Button>
                </PageHeader>
                
                {isLoading && projects.length === 0 && feedingGroups.length === 0 ? (
                    <div className="text-center py-20"><Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto" /></div>
                ) : (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="flex w-full bg-slate-950 border border-slate-700 rounded-md p-1.5 gap-1 mb-6">
                            {[
                                { value: 'projects', icon: CalendarDays, label: 'Plans' },
                                { value: 'future', icon: Calendar, label: 'Future Breeding', shortLabel: 'Future' },
                                { value: 'calendar', icon: Calendar, label: 'Calendar' },
                                { value: 'feeding', icon: Utensils, label: 'Feeding Groups', shortLabel: 'Feed' },
                                { value: 'notes', icon: StickyNote, label: 'Notes' },
                            ].map(({ value, icon: Icon, label, shortLabel }) => (
                                <TabsTrigger
                                    key={value}
                                    value={value}
                                    className="flex-1 flex items-center justify-center gap-1.5 data-[state=active]:bg-emerald-900/70 data-[state=active]:text-emerald-200 data-[state=active]:border data-[state=active]:border-emerald-700/60 data-[state=active]:shadow-none text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs md:text-sm px-2 rounded-sm transition-colors"
                                >
                                    <Icon className="hidden sm:block w-4 h-4" />
                                    <span className="hidden sm:inline">{label}</span>
                                    {shortLabel && <span className="sm:hidden">{shortLabel}</span>}
                                    {!shortLabel && <span className="sm:hidden">{label}</span>}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        <TabsContent value="projects">
                            {projects.length === 0 ? (
                                <EmptyState
                                    icon={CalendarDays}
                                    title="No Plans Yet"
                                    message="Create your first plan to organize your breeding season, expo prep, or gecko care tasks!"
                                    action={{ label: "Create Plan", onClick: () => setIsProjectModalOpen(true) }}
                                />
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {projects.map(project => {
                                        const projectTasks = getProjectTasks(project.id);
                                        const progress = getProjectProgress(project.id);
                                        const isExpanded = expandedProjects.has(project.id);
                                        return (
                                            <Card key={project.id}>
                                                <CardHeader className="cursor-pointer" onClick={() => toggleProjectExpand(project.id)}>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                <div className={`w-3 h-3 rounded-full ${getCategoryColor(project.category)}`} />
                                                                <CardTitle className="text-slate-100">{project.name}</CardTitle>
                                                                <Badge variant="outline" className="text-xs">{project.category}</Badge>
                                                            </div>
                                                            {project.description && <p className="text-slate-400 text-sm">{project.description}</p>}
                                                            <div className="flex items-center gap-4 mt-3">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <span className="text-xs text-slate-400">{projectTasks.filter(t => t.is_completed).length}/{projectTasks.length} tasks</span>
                                                                        <span className="text-xs text-slate-400">{progress}%</span>
                                                                    </div>
                                                                    <Progress value={progress} className="h-2" />
                                                                </div>
                                                                {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                                {isExpanded && (
                                                    <CardContent className="border-t border-slate-700 pt-4">
                                                        <div className="space-y-2 mb-4">
                                                            {projectTasks.filter(t => plannerPrefs.showCompletedTasks || !t.is_completed).map(task => (
                                                                <div key={task.id} className={`flex items-center gap-3 ${plannerPrefs.compactView ? 'p-2' : 'p-3'} bg-slate-800 rounded-lg`}>
                                                                    <Checkbox checked={task.is_completed} onCheckedChange={() => handleToggleTask(task.id, task.is_completed)} />
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <p className={`text-slate-200 ${task.is_completed ? 'line-through text-slate-500' : ''}`}>{task.title}</p>
                                                                            {task.is_recurring && <RepeatIcon className="w-3 h-3 text-emerald-400" />}
                                                                        </div>
                                                                        {task.description && <p className="text-xs text-slate-400">{task.description}</p>}
                                                                        {task.due_date && (
                                                                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                                                                <Calendar className="w-3 h-3" /> Due: {format(parseLocalDate(String(task.due_date).slice(0, 10)), 'MMM d, yyyy')}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <Button size="icon" variant="ghost" onClick={() => setTaskToDelete(task.id)} className="text-red-400 hover:text-red-300">
                                                                       <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            <Button size="sm" onClick={() => { setSelectedProjectId(project.id); setIsTaskModalOpen(true); }} className="">
                                                                <Plus className="w-4 h-4 mr-2" /> Add Task
                                                            </Button>
                                                            <Button size="sm" variant="destructive" onClick={() => setProjectToDelete(project.id)}>Delete Plan</Button>
                                                        </div>
                                                    </CardContent>
                                                )}
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="future">
                            <FutureBreedingPlans ref={futureBreedingRef} geckos={geckos} />
                        </TabsContent>

                        <TabsContent value="calendar">
                            <ProjectCalendar tasks={tasks} projects={projects} feedingGroups={feedingGroups} otherReptiles={otherReptiles} />
                        </TabsContent>

                        <TabsContent value="feeding">
                            <FeedingGroupManager
                                feedingGroups={feedingGroups}
                                geckos={geckos}
                                onUpdate={() => loadData({ background: true })}
                            />
                        </TabsContent>

                        <TabsContent value="notes">
                            <StickyNotes />
                        </TabsContent>
                    </Tabs>
                )}
                
                {/* Delete Task Confirmation */}
                <AlertDialog open={!!taskToDelete} onOpenChange={(open) => { if (!open) setTaskToDelete(null); }}>
                    <AlertDialogContent className="bg-slate-900 border-slate-700">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-slate-100">Delete this task?</AlertDialogTitle>
                            <AlertDialogDescription className="text-slate-400">This action cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-600">Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteTask} className="bg-red-700 hover:bg-red-800 text-white">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Delete Project Confirmation */}
                <AlertDialog open={!!projectToDelete} onOpenChange={(open) => { if (!open) setProjectToDelete(null); }}>
                    <AlertDialogContent className="bg-slate-900 border-slate-700">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-slate-100">Delete this plan?</AlertDialogTitle>
                            <AlertDialogDescription className="text-slate-400">This will permanently delete this plan and all its tasks. This action cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-600">Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteProject} className="bg-red-700 hover:bg-red-800 text-white">Delete Plan</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Create Project Modal */}
                <Dialog open={isProjectModalOpen} onOpenChange={setIsProjectModalOpen}>
                    <DialogContent className="bg-slate-900 border-slate-700 text-slate-300 max-w-2xl">
                        <DialogHeader><DialogTitle className="text-slate-100">Create New Plan</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div>
                                <Label>Plan Name</Label>
                                <Input value={newProject.name} onChange={(e) => setNewProject({...newProject, name: e.target.value})} placeholder="e.g., 2025 Breeding Season, Spring Expo Prep" className="bg-slate-800 border-slate-600" />
                            </div>
                            <div>
                                <Label>Description</Label>
                                <Textarea value={newProject.description} onChange={(e) => setNewProject({...newProject, description: e.target.value})} placeholder="Project details..." className="bg-slate-800 border-slate-600" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Category</Label>
                                    <Select value={newProject.category} onValueChange={(v) => setNewProject({...newProject, category: v})}>
                                        <SelectTrigger className="bg-slate-800 border-slate-600"><SelectValue /></SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                                            <SelectItem value="gecko">Gecko Related</SelectItem>
                                            <SelectItem value="breeding">Breeding Project</SelectItem>
                                            <SelectItem value="maintenance">Maintenance</SelectItem>
                                            <SelectItem value="health">Health & Wellness</SelectItem>
                                            <SelectItem value="feeding">Feeding</SelectItem>
                                            <SelectItem value="custom">Custom</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Due Date (Optional)</Label>
                                    <Input type="date" value={newProject.due_date} onChange={(e) => setNewProject({...newProject, due_date: e.target.value})} className="bg-slate-800 border-slate-600" />
                                </div>
                            </div>
                            {newProject.category === 'gecko' && (
                                <div>
                                    <Label>Related Gecko</Label>
                                    <Select value={newProject.related_gecko_id} onValueChange={(v) => setNewProject({...newProject, related_gecko_id: v})}>
                                        <SelectTrigger className="bg-slate-800 border-slate-600"><SelectValue placeholder="Select gecko" /></SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                                            {geckos.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            {newProject.category === 'breeding' && (
                                <div>
                                    <Label>Related Breeding Plan</Label>
                                    <Select value={newProject.related_breeding_plan_id} onValueChange={(v) => setNewProject({...newProject, related_breeding_plan_id: v})}>
                                        <SelectTrigger className="bg-slate-800 border-slate-600"><SelectValue placeholder="Select plan" /></SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                                            {breedingPlans.map(p => {
                                                const sire = geckos.find(g => g.id === p.sire_id);
                                                const dam = geckos.find(g => g.id === p.dam_id);
                                                return <SelectItem key={p.id} value={p.id}>{sire?.name || 'Unknown'} x {dam?.name || 'Unknown'}</SelectItem>;
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            {newProject.category === 'custom' && (
                                <div>
                                    <Label>Related To (Optional)</Label>
                                    <Input value={newProject.custom_relation} onChange={(e) => setNewProject({...newProject, custom_relation: e.target.value})} placeholder="What this project relates to..." className="bg-slate-800 border-slate-600" />
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsProjectModalOpen(false)} className="border-slate-600">Cancel</Button>
                             <Button onClick={handleCreateProject} disabled={!newProject.name} className="">Create Plan</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                
                {/* Create Task Modal */}
                <Dialog open={isTaskModalOpen} onOpenChange={setIsTaskModalOpen}>
                    <DialogContent className="bg-slate-900 border-slate-700 text-slate-300">
                        <DialogHeader><DialogTitle className="text-slate-100">Add New Task</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div>
                                <Label>Task Title</Label>
                                <Input value={newTask.title} onChange={(e) => setNewTask({...newTask, title: e.target.value})} placeholder="e.g., Clean enclosure" className="bg-slate-800 border-slate-600" />
                            </div>
                            <div>
                                <Label>Description (Optional)</Label>
                                <Textarea value={newTask.description} onChange={(e) => setNewTask({...newTask, description: e.target.value})} placeholder="Task details..." className="bg-slate-800 border-slate-600" />
                            </div>
                            <div>
                                <Label>Due Date (Optional)</Label>
                                <Input type="date" value={newTask.due_date} onChange={(e) => setNewTask({...newTask, due_date: e.target.value})} className="bg-slate-800 border-slate-600" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Checkbox checked={newTask.is_recurring} onCheckedChange={(checked) => setNewTask({...newTask, is_recurring: checked})} />
                                <Label>Recurring Task</Label>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <Checkbox checked={newTask.reminder_enabled} onCheckedChange={(checked) => setNewTask({...newTask, reminder_enabled: checked === true})} />
                                <Label>Remind me</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="30"
                                    value={newTask.reminder_days_before}
                                    onChange={(e) => setNewTask({...newTask, reminder_days_before: Math.max(1, parseInt(e.target.value, 10) || 1)})}
                                    disabled={!newTask.reminder_enabled}
                                    className="w-20 bg-slate-800 border-slate-600"
                                    aria-label="Days before the due date"
                                />
                                <span className="text-sm">days before</span>
                            </div>
                            <p className="text-xs text-slate-500 -mt-2">Tasks with a due date always get a reminder on the day (bell, plus push or email if you turned those on), even with the app closed.</p>
                            {newTask.is_recurring && (
                                <div>
                                    <Label>Repeat Every (Days)</Label>
                                    <Input type="number" min="1" value={newTask.recurring_interval_days} onChange={(e) => setNewTask({...newTask, recurring_interval_days: parseInt(e.target.value)})} className="bg-slate-800 border-slate-600" />
                                    <p className="text-xs text-slate-500 mt-1">Task will automatically reset after completion</p>
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsTaskModalOpen(false)} className="border-slate-600">Cancel</Button>
                            <Button onClick={handleCreateTask} disabled={!newTask.title} className="">Add Task</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}