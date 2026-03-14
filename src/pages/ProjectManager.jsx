import React, { useState, useEffect } from 'react';
import { Project, Task, Gecko, BreedingPlan, FeedingGroup, OtherReptile } from '@/entities/all';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PlusCircle, Loader2, FolderKanban, Trash2, Plus, ChevronDown, ChevronUp, Calendar, RepeatIcon, Utensils, StickyNote } from 'lucide-react';
import EmptyState from '../components/shared/EmptyState';
import { format } from 'date-fns';
import ProjectCalendar from '../components/project-manager/ProjectCalendar';
import FeedingGroupManager from '../components/project-manager/FeedingGroupManager';
import StickyNotes from '../components/project-manager/StickyNotes';

export default function ProjectManager() {
    const [projects, setProjects] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [geckos, setGeckos] = useState([]);
    const [breedingPlans, setBreedingPlans] = useState([]);
    const [feedingGroups, setFeedingGroups] = useState([]);
    const [otherReptiles, setOtherReptiles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [expandedProjects, setExpandedProjects] = useState(new Set());
    
    const [newProject, setNewProject] = useState({
        name: '', description: '', category: 'custom', related_gecko_id: '',
        related_breeding_plan_id: '', custom_relation: '', status: 'active', due_date: '', color: '#10b981'
    });
    
    const [newTask, setNewTask] = useState({
        project_id: '', title: '', description: '', due_date: '',
        is_recurring: false, recurring_interval_days: 7, reminder_enabled: false, reminder_days_before: 1
    });
    
    useEffect(() => { loadData(); }, []);
    
    const loadData = async () => {
        setIsLoading(true);
        try {
            const [projectsData, tasksData, geckosData, plansData, feedingData, reptilesData] = await Promise.all([
                Project.filter({ status: { $in: ['active', 'completed'] } }),
                Task.list(),
                Gecko.list(),
                BreedingPlan.list(),
                FeedingGroup.list().catch(() => []),
                OtherReptile.list().catch(() => [])
            ]);
            setProjects(projectsData);
            setTasks(tasksData);
            setGeckos(geckosData);
            setBreedingPlans(plansData);
            setFeedingGroups(feedingData);
            setOtherReptiles(reptilesData);
        } catch (error) {
            console.error("Failed to load data:", error);
        }
        setIsLoading(false);
    };
    
    const handleCreateProject = async () => {
        if (!newProject.name) return;
        try {
            await Project.create(newProject);
            setIsProjectModalOpen(false);
            setNewProject({ name: '', description: '', category: 'custom', related_gecko_id: '', related_breeding_plan_id: '', custom_relation: '', status: 'active', due_date: '', color: '#10b981' });
            loadData();
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
            loadData();
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
                    updateData.next_due_date = nextDate.toISOString();
                    updateData.is_completed = false;
                }
            } else { updateData.completed_date = null; }
            await Task.update(taskId, updateData);
            loadData();
        } catch (error) { console.error("Failed to toggle task:", error); }
    };
    
    const handleDeleteTask = async (taskId) => {
        if (!window.confirm('Delete this task?')) return;
        try { await Task.delete(taskId); loadData(); } catch (error) { console.error("Failed to delete task:", error); }
    };
    
    const handleDeleteProject = async (projectId) => {
        if (!window.confirm('Delete this project and all its tasks?')) return;
        try {
            const projectTasks = tasks.filter(t => t.project_id === projectId);
            await Promise.all(projectTasks.map(t => Task.delete(t.id)));
            await Project.delete(projectId);
            loadData();
        } catch (error) { console.error("Failed to delete project:", error); }
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
        <div className="p-4 md:p-8 bg-slate-950 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-2xl md:text-4xl font-bold text-slate-100 flex items-center gap-3">
                            <FolderKanban className="w-8 h-8 md:w-10 md:h-10 text-emerald-500" />
                            Project Manager
                        </h1>
                        <p className="text-slate-400 mt-2 text-sm md:text-base">Organize tasks, track projects, and manage feeding schedules</p>
                    </div>
                    <Button onClick={() => setIsProjectModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 w-full md:w-auto">
                        <PlusCircle className="w-5 h-5 mr-2" /> New Project
                    </Button>
                </div>
                
                {isLoading ? (
                    <div className="text-center py-20"><Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto" /></div>
                ) : (
                    <Tabs defaultValue="projects" className="w-full">
                        <TabsList className="grid w-full grid-cols-4 bg-slate-900 h-11 mb-6">
                            <TabsTrigger value="projects" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs md:text-sm">
                                <FolderKanban className="w-4 h-4 mr-1 md:mr-2" /> Projects
                            </TabsTrigger>
                            <TabsTrigger value="calendar" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs md:text-sm">
                                <Calendar className="w-4 h-4 mr-1 md:mr-2" /> Calendar
                            </TabsTrigger>
                            <TabsTrigger value="feeding" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white text-xs md:text-sm">
                                <Utensils className="w-4 h-4 mr-1 md:mr-2" /> <span className="hidden sm:inline">Feeding Groups</span><span className="sm:hidden">Feed</span>
                            </TabsTrigger>
                            <TabsTrigger value="notes" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-yellow-950 text-xs md:text-sm">
                                <StickyNote className="w-4 h-4 mr-1 md:mr-2" /> Notes
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="projects">
                            {projects.length === 0 ? (
                                <EmptyState
                                    icon={FolderKanban}
                                    title="No Projects Yet"
                                    message="Create your first project to get organized!"
                                    action={{ label: "Create Project", onClick: () => setIsProjectModalOpen(true) }}
                                />
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {projects.map(project => {
                                        const projectTasks = getProjectTasks(project.id);
                                        const progress = getProjectProgress(project.id);
                                        const isExpanded = expandedProjects.has(project.id);
                                        return (
                                            <Card key={project.id} className="bg-slate-900 border-slate-700">
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
                                                            {projectTasks.map(task => (
                                                                <div key={task.id} className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
                                                                    <Checkbox checked={task.is_completed} onCheckedChange={() => handleToggleTask(task.id, task.is_completed)} />
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <p className={`text-slate-200 ${task.is_completed ? 'line-through text-slate-500' : ''}`}>{task.title}</p>
                                                                            {task.is_recurring && <RepeatIcon className="w-3 h-3 text-emerald-400" />}
                                                                        </div>
                                                                        {task.description && <p className="text-xs text-slate-400">{task.description}</p>}
                                                                        {task.due_date && (
                                                                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                                                                <Calendar className="w-3 h-3" /> Due: {format(new Date(task.due_date), 'MMM d, yyyy')}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <Button size="icon" variant="ghost" onClick={() => handleDeleteTask(task.id)} className="text-red-400 hover:text-red-300">
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button size="sm" onClick={() => { setSelectedProjectId(project.id); setIsTaskModalOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700">
                                                                <Plus className="w-4 h-4 mr-2" /> Add Task
                                                            </Button>
                                                            <Button size="sm" variant="destructive" onClick={() => handleDeleteProject(project.id)}>Delete Project</Button>
                                                        </div>
                                                    </CardContent>
                                                )}
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="calendar">
                            <ProjectCalendar tasks={tasks} projects={projects} feedingGroups={feedingGroups} otherReptiles={otherReptiles} />
                        </TabsContent>

                        <TabsContent value="feeding">
                            <FeedingGroupManager feedingGroups={feedingGroups} geckos={geckos} onUpdate={loadData} />
                        </TabsContent>

                        <TabsContent value="notes">
                            <StickyNotes />
                        </TabsContent>
                    </Tabs>
                )}
                
                {/* Create Project Modal */}
                <Dialog open={isProjectModalOpen} onOpenChange={setIsProjectModalOpen}>
                    <DialogContent className="bg-slate-900 border-slate-700 text-slate-300 max-w-2xl">
                        <DialogHeader><DialogTitle className="text-slate-100">Create New Project</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div>
                                <Label>Project Name</Label>
                                <Input value={newProject.name} onChange={(e) => setNewProject({...newProject, name: e.target.value})} placeholder="e.g., Weekly Feeding Schedule" className="bg-slate-800 border-slate-600" />
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
                            <Button onClick={handleCreateProject} disabled={!newProject.name} className="bg-emerald-600 hover:bg-emerald-700">Create Project</Button>
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
                            <Button onClick={handleCreateTask} disabled={!newTask.title} className="bg-emerald-600 hover:bg-emerald-700">Add Task</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}