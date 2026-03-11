import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { PlusCircle, Trash2, Grid3x3, List, X, StickyNote } from 'lucide-react';

const NOTE_COLORS = [
    { label: 'Yellow', bg: 'bg-yellow-200', border: 'border-yellow-400', text: 'text-yellow-900', header: 'bg-yellow-300' },
    { label: 'Green', bg: 'bg-emerald-200', border: 'border-emerald-400', text: 'text-emerald-900', header: 'bg-emerald-300' },
    { label: 'Blue', bg: 'bg-blue-200', border: 'border-blue-400', text: 'text-blue-900', header: 'bg-blue-300' },
    { label: 'Pink', bg: 'bg-pink-200', border: 'border-pink-400', text: 'text-pink-900', header: 'bg-pink-300' },
    { label: 'Purple', bg: 'bg-purple-200', border: 'border-purple-400', text: 'text-purple-900', header: 'bg-purple-300' },
    { label: 'Orange', bg: 'bg-orange-200', border: 'border-orange-400', text: 'text-orange-900', header: 'bg-orange-300' },
];

const STORAGE_KEY = 'gecko_sticky_notes';

function loadNotes() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function saveNotes(notes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function NoteCard({ note, onDelete, onUpdate, isGrid }) {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(note.title);
    const [body, setBody] = useState(note.body);
    const color = NOTE_COLORS.find(c => c.label === note.color) || NOTE_COLORS[0];

    const handleSave = () => {
        onUpdate(note.id, { title, body });
        setIsEditing(false);
    };

    return (
        <div className={`rounded-lg border-2 ${color.bg} ${color.border} flex flex-col shadow-md transition-shadow hover:shadow-lg ${isGrid ? 'min-h-[180px]' : 'min-h-[100px]'}`}>
            {/* Sticky note header strip */}
            <div className={`${color.header} rounded-t-md px-3 py-1.5 flex items-center justify-between`}>
                {isEditing ? (
                    <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className={`bg-transparent border-none shadow-none text-sm font-semibold ${color.text} h-6 p-0 focus-visible:ring-0`}
                        placeholder="Title..."
                    />
                ) : (
                    <span
                        className={`text-sm font-semibold ${color.text} cursor-pointer flex-1 truncate`}
                        onDoubleClick={() => setIsEditing(true)}
                    >
                        {note.title || 'Untitled'}
                    </span>
                )}
                <div className="flex gap-1 flex-shrink-0 ml-2">
                    {isEditing ? (
                        <>
                            <button onClick={handleSave} className={`text-xs ${color.text} font-bold hover:opacity-70 px-1`}>Save</button>
                            <button onClick={() => { setTitle(note.title); setBody(note.body); setIsEditing(false); }} className={`text-xs ${color.text} hover:opacity-70 px-1`}>✕</button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setIsEditing(true)} className={`text-xs ${color.text} hover:opacity-70 px-1`}>✏️</button>
                            <button onClick={() => onDelete(note.id)} className={`text-xs ${color.text} hover:opacity-70 px-1`}>🗑</button>
                        </>
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="p-3 flex-1">
                {isEditing ? (
                    <Textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        className={`bg-transparent border-none shadow-none resize-none ${color.text} text-sm p-0 focus-visible:ring-0 h-full min-h-[80px]`}
                        placeholder="Write your note..."
                        autoFocus
                    />
                ) : (
                    <p
                        className={`text-sm ${color.text} whitespace-pre-wrap cursor-pointer break-words`}
                        onDoubleClick={() => setIsEditing(true)}
                    >
                        {note.body || <span className="opacity-50">Double-click to edit...</span>}
                    </p>
                )}
            </div>

            {/* Timestamp */}
            <div className={`px-3 pb-1.5 text-[10px] ${color.text} opacity-50`}>
                {new Date(note.created_at).toLocaleDateString()}
            </div>
        </div>
    );
}

export default function StickyNotes() {
    const [notes, setNotes] = useState([]);
    const [viewMode, setViewMode] = useState('grid');
    const [newTitle, setNewTitle] = useState('');
    const [newBody, setNewBody] = useState('');
    const [newColor, setNewColor] = useState('Yellow');
    const [showForm, setShowForm] = useState(false);

    useEffect(() => {
        setNotes(loadNotes());
    }, []);

    const handleAdd = () => {
        if (!newBody.trim() && !newTitle.trim()) return;
        const note = {
            id: Date.now().toString(),
            title: newTitle.trim() || 'Note',
            body: newBody.trim(),
            color: newColor,
            created_at: new Date().toISOString(),
        };
        const updated = [note, ...notes];
        setNotes(updated);
        saveNotes(updated);
        setNewTitle('');
        setNewBody('');
        setShowForm(false);
    };

    const handleDelete = (id) => {
        const updated = notes.filter(n => n.id !== id);
        setNotes(updated);
        saveNotes(updated);
    };

    const handleUpdate = (id, changes) => {
        const updated = notes.map(n => n.id === id ? { ...n, ...changes } : n);
        setNotes(updated);
        saveNotes(updated);
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <Button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950 font-semibold"
                >
                    <PlusCircle className="w-4 h-4 mr-2" /> New Note
                </Button>
                <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        <Grid3x3 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        <List className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* New note form */}
            {showForm && (
                <div className="bg-slate-800 border border-slate-600 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Input
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder="Title (optional)"
                            className="bg-slate-700 border-slate-600 flex-1"
                        />
                        <div className="flex gap-1">
                            {NOTE_COLORS.map(c => (
                                <button
                                    key={c.label}
                                    onClick={() => setNewColor(c.label)}
                                    className={`w-6 h-6 rounded-full border-2 ${c.bg} ${newColor === c.label ? 'border-white scale-125' : 'border-transparent'} transition-transform`}
                                    title={c.label}
                                />
                            ))}
                        </div>
                    </div>
                    <Textarea
                        value={newBody}
                        onChange={(e) => setNewBody(e.target.value)}
                        placeholder="Write your note here..."
                        className="bg-slate-700 border-slate-600 min-h-[100px]"
                        autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" className="border-slate-600" onClick={() => setShowForm(false)}>Cancel</Button>
                        <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950 font-semibold" onClick={handleAdd}>Add Note</Button>
                    </div>
                </div>
            )}

            {/* Notes display */}
            {notes.length === 0 ? (
                <div className="text-center py-20 text-slate-500">
                    <StickyNote className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No notes yet. Click "New Note" to get started.</p>
                </div>
            ) : (
                <div className={viewMode === 'grid'
                    ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'
                    : 'space-y-3'
                }>
                    {notes.map(note => (
                        <NoteCard
                            key={note.id}
                            note={note}
                            onDelete={handleDelete}
                            onUpdate={handleUpdate}
                            isGrid={viewMode === 'grid'}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}