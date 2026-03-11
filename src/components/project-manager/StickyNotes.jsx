import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { PlusCircle, Grid3x3, List, StickyNote } from 'lucide-react';

// Use inline hex colors so Tailwind purge doesn't remove them
const NOTE_COLORS = [
    { label: 'Yellow',  bg: '#fef08a', border: '#facc15', text: '#713f12', header: '#fde047' },
    { label: 'Green',   bg: '#a7f3d0', border: '#34d399', text: '#064e3b', header: '#6ee7b7' },
    { label: 'Blue',    bg: '#bfdbfe', border: '#60a5fa', text: '#1e3a5f', header: '#93c5fd' },
    { label: 'Pink',    bg: '#fbcfe8', border: '#f472b6', text: '#831843', header: '#f9a8d4' },
    { label: 'Purple',  bg: '#e9d5ff', border: '#c084fc', text: '#4a1d96', header: '#d8b4fe' },
    { label: 'Orange',  bg: '#fed7aa', border: '#fb923c', text: '#7c2d12', header: '#fdba74' },
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
    const [selectedColor, setSelectedColor] = useState(note.color || 'Yellow');
    const color = NOTE_COLORS.find(c => c.label === selectedColor) || NOTE_COLORS[0];

    const handleSave = () => {
        onUpdate(note.id, { title, body, color: selectedColor });
        setIsEditing(false);
    };

    const handleCancel = () => {
        setTitle(note.title);
        setBody(note.body);
        setSelectedColor(note.color || 'Yellow');
        setIsEditing(false);
    };

    // Keep color in sync with note prop
    useEffect(() => {
        setSelectedColor(note.color || 'Yellow');
    }, [note.color]);

    return (
        <div
            style={{ backgroundColor: color.bg, borderColor: color.border }}
            className={`rounded-lg border-2 flex flex-col shadow-md transition-shadow hover:shadow-lg ${isGrid ? 'min-h-[180px]' : 'min-h-[100px]'}`}
        >
            {/* Header strip */}
            <div style={{ backgroundColor: color.header }} className="rounded-t-md px-3 py-1.5 flex items-center justify-between gap-2">
                {isEditing ? (
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        style={{ color: color.text, backgroundColor: 'transparent' }}
                        className="text-sm font-semibold flex-1 bg-transparent border-none outline-none"
                        placeholder="Title..."
                    />
                ) : (
                    <span
                        style={{ color: color.text }}
                        className="text-sm font-semibold cursor-pointer flex-1 truncate"
                        onDoubleClick={() => setIsEditing(true)}
                    >
                        {note.title || 'Untitled'}
                    </span>
                )}
                <div className="flex gap-1 flex-shrink-0">
                    {isEditing ? (
                        <>
                            <button type="button" onClick={handleSave} style={{ color: color.text }} className="text-xs font-bold hover:opacity-70 px-1">Save</button>
                            <button type="button" onClick={handleCancel} style={{ color: color.text }} className="text-xs hover:opacity-70 px-1">✕</button>
                        </>
                    ) : (
                        <>
                            <button type="button" onClick={() => setIsEditing(true)} style={{ color: color.text }} className="text-xs hover:opacity-70 px-1">✏️</button>
                            <button type="button" onClick={() => onDelete(note.id)} style={{ color: color.text }} className="text-xs hover:opacity-70 px-1">🗑</button>
                        </>
                    )}
                </div>
            </div>

            {/* Color picker (edit mode only) */}
            {isEditing && (
                <div className="px-3 pt-2 flex gap-1.5 flex-wrap">
                    {NOTE_COLORS.map(c => (
                        <button
                            key={c.label}
                            type="button"
                            onClick={() => setSelectedColor(c.label)}
                            style={{ backgroundColor: c.bg, borderColor: selectedColor === c.label ? '#fff' : 'transparent', outlineColor: c.border }}
                            className={`w-5 h-5 rounded-full border-2 transition-transform ${selectedColor === c.label ? 'scale-125 outline outline-2' : ''}`}
                            title={c.label}
                        />
                    ))}
                </div>
            )}

            {/* Body */}
            <div className="p-3 flex-1">
                {isEditing ? (
                    <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        style={{ color: color.text, backgroundColor: 'transparent' }}
                        className="w-full bg-transparent border-none outline-none resize-none text-sm p-0 min-h-[80px]"
                        placeholder="Write your note..."
                        autoFocus
                    />
                ) : (
                    <p
                        style={{ color: color.text }}
                        className="text-sm whitespace-pre-wrap cursor-pointer break-words"
                        onDoubleClick={() => setIsEditing(true)}
                    >
                        {note.body || <span className="opacity-50">Double-click to edit...</span>}
                    </p>
                )}
            </div>

            {/* Timestamp */}
            <div style={{ color: color.text }} className="px-3 pb-1.5 text-[10px] opacity-50">
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

    const selectedColorObj = NOTE_COLORS.find(c => c.label === newColor) || NOTE_COLORS[0];

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
                        type="button"
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        <Grid3x3 className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        <List className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* New note form */}
            {showForm && (
                <div
                    style={{ backgroundColor: selectedColorObj.bg, borderColor: selectedColorObj.border }}
                    className="border-2 rounded-xl p-4 space-y-3"
                >
                    <div className="flex items-center gap-2 flex-wrap">
                        <input
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder="Title (optional)"
                            style={{ color: selectedColorObj.text, backgroundColor: 'rgba(255,255,255,0.5)', borderColor: selectedColorObj.border }}
                            className="flex-1 rounded-md border px-3 py-1.5 text-sm outline-none"
                        />
                        {/* Color swatches */}
                        <div className="flex gap-1.5">
                            {NOTE_COLORS.map(c => (
                                <button
                                    key={c.label}
                                    type="button"
                                    onClick={() => setNewColor(c.label)}
                                    style={{
                                        backgroundColor: c.bg,
                                        borderColor: newColor === c.label ? '#1e293b' : c.border,
                                        outlineColor: c.border
                                    }}
                                    className={`w-6 h-6 rounded-full border-2 transition-transform ${newColor === c.label ? 'scale-125 outline outline-2' : ''}`}
                                    title={c.label}
                                />
                            ))}
                        </div>
                    </div>
                    <textarea
                        value={newBody}
                        onChange={(e) => setNewBody(e.target.value)}
                        placeholder="Write your note here..."
                        style={{ color: selectedColorObj.text, backgroundColor: 'rgba(255,255,255,0.5)', borderColor: selectedColorObj.border }}
                        className="w-full rounded-md border px-3 py-2 text-sm outline-none resize-none min-h-[100px]"
                        autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm rounded-md border border-slate-400 text-slate-700 hover:bg-slate-100">Cancel</button>
                        <button type="button" onClick={handleAdd} style={{ backgroundColor: selectedColorObj.header, color: selectedColorObj.text }} className="px-3 py-1.5 text-sm font-semibold rounded-md hover:opacity-90">Add Note</button>
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