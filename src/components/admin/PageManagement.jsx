import React, { useState, useEffect } from 'react';
import { PageConfig } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, GripVertical, Layout } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function PageManagement() {
    const [pages, setPages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadPages();
    }, []);

    const loadPages = async () => {
        setIsLoading(true);
        try {
            const allPages = await PageConfig.list();
            setPages(allPages.sort((a, b) => {
                if (a.category !== b.category) {
                    return a.category.localeCompare(b.category);
                }
                return a.order - b.order;
            }));
        } catch (error) {
            console.error("Failed to load pages:", error);
        }
        setIsLoading(false);
    };

    const handleToggleEnabled = async (pageId, newValue) => {
        try {
            await PageConfig.update(pageId, { is_enabled: newValue });
            loadPages();
        } catch (error) {
            console.error("Failed to update page:", error);
        }
    };

    const handleCategoryChange = async (pageId, newCategory) => {
        try {
            await PageConfig.update(pageId, { category: newCategory });
            loadPages();
        } catch (error) {
            console.error("Failed to update category:", error);
        }
    };

    const handleDragEnd = async (result) => {
        if (!result.destination) return;

        const items = Array.from(pages);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        setPages(items);

        // Update order for all affected pages
        setIsSaving(true);
        try {
            for (let i = 0; i < items.length; i++) {
                await PageConfig.update(items[i].id, { order: i });
            }
        } catch (error) {
            console.error("Failed to update order:", error);
            loadPages(); // Reload on error
        }
        setIsSaving(false);
    };

    const groupedPages = pages.reduce((acc, page) => {
        const category = page.category || 'public';
        if (!acc[category]) acc[category] = [];
        acc[category].push(page);
        return acc;
    }, {});

    if (isLoading) {
        return (
            <div className="flex justify-center items-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                    <Layout className="w-5 h-5" />
                    Page Management
                </CardTitle>
                <p className="text-sm text-slate-400">
                    Configure which pages are visible and organize sidebar navigation
                </p>
            </CardHeader>
            <CardContent>
                <DragDropContext onDragEnd={handleDragEnd}>
                    {Object.entries(groupedPages).map(([category, categoryPages]) => (
                        <div key={category} className="mb-8">
                            <h3 className="text-lg font-semibold text-slate-200 mb-4 capitalize">
                                {category} Pages
                            </h3>
                            <Droppable droppableId={category}>
                                {(provided) => (
                                    <div
                                        {...provided.droppableProps}
                                        ref={provided.innerRef}
                                        className="space-y-2"
                                    >
                                        {categoryPages.map((page, index) => (
                                            <Draggable
                                                key={page.id}
                                                draggableId={page.id}
                                                index={index}
                                            >
                                                {(provided) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        className="flex items-center gap-4 bg-slate-800 p-4 rounded-lg border border-slate-600"
                                                    >
                                                        <div {...provided.dragHandleProps}>
                                                            <GripVertical className="w-5 h-5 text-slate-500 cursor-grab" />
                                                        </div>
                                                        
                                                        <div className="flex-1">
                                                            <div className="font-semibold text-slate-200">
                                                                {page.display_name}
                                                            </div>
                                                            <div className="text-xs text-slate-500">
                                                                {page.page_name}
                                                            </div>
                                                        </div>

                                                        <Select
                                                            value={page.category}
                                                            onValueChange={(value) => handleCategoryChange(page.id, value)}
                                                        >
                                                            <SelectTrigger className="w-32 bg-slate-700 border-slate-600">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-slate-800 border-slate-600">
                                                                <SelectItem value="collection">Collection</SelectItem>
                                                                <SelectItem value="tools">Tools</SelectItem>
                                                                <SelectItem value="public">Public</SelectItem>
                                                            </SelectContent>
                                                        </Select>

                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm text-slate-400">
                                                                {page.is_enabled ? 'Enabled' : 'Disabled'}
                                                            </span>
                                                            <Switch
                                                                checked={page.is_enabled}
                                                                onCheckedChange={(checked) => handleToggleEnabled(page.id, checked)}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    ))}
                </DragDropContext>
                {isSaving && (
                    <div className="flex items-center gap-2 text-emerald-400 mt-4">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving order...</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}