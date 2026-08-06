import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { ArrowLeft, Save, Loader2, MessageSquare, FileText, Lock, Unlock, Send, PenTool, History, Plus, Users, UserMinus, X, Trash2 } from 'lucide-react';

const API_BASE_URL = 'https://rescover-backend.onrender.com';
const WS_BASE_URL = 'wss://rescover-backend.onrender.com';

// Default sections that cannot be deleted
const CORE_SECTIONS = ['abstract', 'chapter_1', 'chapter_2'];

export default function WorkbenchView({ user, paperId, onBack }) {
  const [paper, setPaper] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState('Never');
  const [activeUsers, setActiveUsers] = useState([]);
  const ws = useRef(null);
  
  const [sidebarTab, setSidebarTab] = useState('chat');
  const [newChat, setNewChat] = useState('');
  const chatEndRef = useRef(null);

  // Phase 3.5 Admin States
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [showTeamModal, setShowTeamModal] = useState(false);

  // --- DATA FETCHING & SMART MERGE ---
  const fetchPaper = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/papers/${paperId}`);
      setPaper(prev => {
        if (!prev) return res.data;
        const dbPaper = res.data;
        const updated = { ...dbPaper };
        
        // Smart Merge
        if (dbPaper.title_locked_by === user.fullname) updated.title = prev.title;
        
        if (dbPaper.sections && prev.sections) {
          updated.sections = dbPaper.sections.map(dbSec => {
            const isLockedByMe = dbPaper[`${dbSec.id}_locked_by`] === user.fullname;
            if (isLockedByMe) {
              const prevSec = prev.sections.find(s => s.id === dbSec.id);
              if (prevSec) return { ...dbSec, content: prevSec.content };
            }
            return dbSec;
          });
        }
        return updated;
      });
    } catch (err) {}
  };

  useEffect(() => {
    fetchPaper();
    const socketUrl = `${WS_BASE_URL}/ws/${paperId}?user=${encodeURIComponent(user.fullname)}`;
    const websocket = new WebSocket(socketUrl);
    ws.current = websocket;

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'presence') setActiveUsers(data.users);
      else if (data.type === 'refresh') fetchPaper();
    };
    return () => { if (websocket.readyState === 1) websocket.close(); };
  }, [paperId, user.fullname]);

  const triggerGlobalRefresh = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify({ type: 'refresh' }));
  };

  useEffect(() => { if (sidebarTab === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [paper?.chat, sidebarTab]);

  // --- WORKSPACE ACTIONS ---
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await axios.put(`${API_BASE_URL}/api/papers/${paperId}/sync`, {
        title: paper.title, sections: paper.sections, user_fullname: user.fullname
      });
      setLastSynced(new Date().toLocaleTimeString());
      triggerGlobalRefresh();
    } catch (err) { } finally { setIsSyncing(false); }
  };

  const toggleLock = async (sectionKey, claim) => {
    try {
      await axios.post(`${API_BASE_URL}/api/papers/${paperId}/lock`, { section: sectionKey, user_fullname: claim ? user.fullname : null });
      fetchPaper(); triggerGlobalRefresh();
    } catch (err) {}
  };

  const handleSendChat = async (e) => {
    e.preventDefault(); if (!newChat.trim()) return;
    try {
      await axios.post(`${API_BASE_URL}/api/papers/${paperId}/chat`, { author: user.fullname, text: newChat });
      setNewChat(''); fetchPaper(); triggerGlobalRefresh();
    } catch (err) {}
  };

  // --- ADMIN ACTIONS (Phase 3.5) ---
  const handleAddSection = async (e) => {
    e.preventDefault();
    if (!newSectionTitle.trim()) return;
    try {
      await axios.post(`${API_BASE_URL}/api/papers/${paperId}/sections`, { title: newSectionTitle, user_fullname: user.fullname });
      setNewSectionTitle(''); setIsAddingSection(false);
      fetchPaper();
    } catch (err) {}
  };

  const handleDeleteSection = async (sectionId, sectionTitle) => {
    if (!window.confirm(`Are you sure you want to permanently delete the section "${sectionTitle}"? This cannot be undone.`)) return;
    try {
      await axios.post(`${API_BASE_URL}/api/papers/${paperId}/sections/${sectionId}/delete`, { user_fullname: user.fullname });
      fetchPaper();
    } catch (err) {}
  };

  const removeCoAuthor = async (authorName) => {
    if (!window.confirm(`Revoke access for ${authorName}? They will be removed immediately.`)) return;
    try {
      await axios.post(`${API_BASE_URL}/api/papers/${paperId}/remove-coauthor`, { user_fullname: authorName, admin_name: user.fullname });
      fetchPaper();
    } catch (err) {}
  };

  if (!paper) return <div className="py-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div>;

  const isOwner = paper.owner_name === user.fullname;
  const holdsAnyLock = paper.title_locked_by === user.fullname || paper.sections?.some(s => paper[`${s.id}_locked_by`] === user.fullname);

  const renderSection = (sectionId, label, isTitle = false) => {
    const lockField = `${sectionId}_locked_by`;
    const lockedBy = paper[lockField];
    const isMe = lockedBy === user.fullname;
    const isOther = lockedBy && !isMe;
    
    // Admin can delete custom sections
    const canDelete = isOwner && !isTitle && !CORE_SECTIONS.includes(sectionId);

    const handleChange = (e) => {
      if (isTitle) setPaper({...paper, title: e.target.value});
      else {
        setPaper(prev => ({
          ...prev,
          sections: prev.sections.map(s => s.id === sectionId ? { ...s, content: e.target.value } : s)
        }));
      }
    };

    const content = isTitle ? paper.title : paper.sections?.find(s => s.id === sectionId)?.content || "";

    return (
      <div key={sectionId} className={`flex flex-col mb-8 ${isMe ? 'p-3 -m-3 bg-teal-50/50 rounded-xl border border-teal-100' : ''}`}>
        <div className="flex justify-between items-center mb-2">
          <label className={`text-xs font-bold uppercase tracking-widest ${isMe ? 'text-teal-700' : 'text-slate-500'}`}>{label}</label>
          <div className="flex items-center space-x-2">
            
            {/* Lock Controls */}
            {isOther ? <span className="text-[10px] bg-red-100 text-red-600 px-2 py-1 rounded font-bold uppercase flex items-center"><Lock className="h-3 w-3 mr-1" /> Locked by {lockedBy}</span>
            : isMe ? <button onClick={() => toggleLock(sectionId, false)} className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-200 px-3 py-1 rounded font-bold uppercase transition flex items-center shadow-sm"><Unlock className="h-3 w-3 mr-1" /> Release</button>
            : <button onClick={() => toggleLock(sectionId, true)} className="text-[10px] bg-slate-100 text-slate-600 hover:bg-teal-600 hover:text-white px-3 py-1 rounded font-bold uppercase transition flex items-center"><PenTool className="h-3 w-3 mr-1" /> Claim</button>}
            
            {/* Delete Control (Admin Only) */}
            {canDelete && (
              <button onClick={() => handleDeleteSection(sectionId, label)} title="Delete Section" className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition">
                <Trash2 className="h-4 w-4" />
              </button>
            )}

          </div>
        </div>
        {isTitle ? (
          <input type="text" value={content} onChange={handleChange} disabled={!isMe} className="text-3xl font-black text-slate-900 border-none focus:ring-0 p-0 placeholder-slate-300 w-full focus:outline-none disabled:bg-transparent" placeholder={`Enter ${label}...`} />
        ) : (
          <textarea value={content} onChange={handleChange} disabled={!isMe} className="min-h-[150px] w-full text-md text-slate-700 leading-relaxed border-none focus:ring-0 p-0 resize-y focus:outline-none disabled:bg-transparent" placeholder={`Draft ${label} here...`} />
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto w-full h-[88vh] flex flex-col space-y-4">
      {/* Workbench Header */}
      <div className="flex justify-between items-end pb-4 border-b border-slate-200">
        <div>
          <button onClick={onBack} className="text-sm font-bold text-slate-500 hover:text-slate-800 flex items-center space-x-2 mb-2 transition"><ArrowLeft className="h-4 w-4" /><span>Back to Hub</span></button>
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Structured Workspace</h2>
            {isOwner && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase rounded tracking-wider">Admin</span>}
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          
          {/* TEAM MANAGEMENT BUTTON (Admin Only) */}
          {isOwner && (
            <button onClick={() => setShowTeamModal(true)} className="hidden sm:flex items-center space-x-2 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition">
              <Users className="h-4 w-4" /><span>Manage Team ({paper.co_authors?.length || 0})</span>
            </button>
          )}

          <div className="hidden sm:flex items-center space-x-2 mr-4 pr-4 border-r border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">In Room:</span>
            <div className="flex -space-x-2">
              {activeUsers.map((activeUser, idx) => (
                <div key={idx} title={activeUser} className="h-8 w-8 rounded-full bg-teal-600 border-2 border-white flex items-center justify-center text-white text-xs font-bold shadow-sm z-10">{activeUser.charAt(0).toUpperCase()}</div>
              ))}
            </div>
          </div>
          <span className="text-xs font-medium text-slate-500 hidden md:block">Last Synced: {lastSynced}</span>
          <button onClick={handleSync} disabled={!holdsAnyLock || isSyncing} className="bg-slate-900 text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-slate-800 transition flex items-center justify-center space-x-2 disabled:opacity-50">
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}<span>{isSyncing ? "Syncing..." : "Sync Sections"}</span>
          </button>
        </div>
      </div>

      {/* Dual Pane Layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
        
        {/* LEFT PANE: Dynamic Editor */}
        <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden relative">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2"><FileText className="h-4 w-4 text-slate-500" /><span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Manuscript Sections</span></div>
          </div>
          
          <div className="flex-1 p-6 flex flex-col overflow-y-auto">
            {renderSection("title", "Research Title", true)}
            
            {/* Map over dynamic sections */}
            {paper.sections?.map(sec => renderSection(sec.id, sec.title))}

            {/* ADD SECTION BUTTON (Admin Only) */}
            {isOwner && (
              <div className="mt-8 pt-8 border-t border-dashed border-slate-200">
                {!isAddingSection ? (
                  <button onClick={() => setIsAddingSection(true)} className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold text-sm hover:border-teal-500 hover:text-teal-600 hover:bg-teal-50 transition flex justify-center items-center">
                    <Plus className="h-5 w-5 mr-2" /> Add New Section
                  </button>
                ) : (
                  <form onSubmit={handleAddSection} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">New Section Title</label>
                    <div className="flex space-x-2">
                      <input type="text" autoFocus required value={newSectionTitle} onChange={e => setNewSectionTitle(e.target.value)} placeholder="e.g., Data Methodology..." className="flex-1 px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-teal-500 outline-none text-sm" />
                      <button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded font-bold text-sm hover:bg-teal-500 transition">Add</button>
                      <button type="button" onClick={() => setIsAddingSection(false)} className="px-4 py-2 border border-slate-300 rounded text-slate-600 font-bold text-sm hover:bg-white transition">Cancel</button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: Chat / Audit Log */}
        <div className="w-full lg:w-[400px] bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="bg-slate-900 px-2 py-2 flex items-center justify-between">
            <div className="flex space-x-1">
              <button onClick={() => setSidebarTab('chat')} className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-2 transition ${sidebarTab === 'chat' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'}`}><MessageSquare className="h-4 w-4" /><span>Live Chat</span></button>
              <button onClick={() => setSidebarTab('audit')} className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-2 transition ${sidebarTab === 'audit' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'}`}><History className="h-4 w-4" /><span>Activity Log</span></button>
            </div>
            <div className="flex items-center space-x-2 mr-2">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
            </div>
          </div>
          
          {sidebarTab === 'chat' ? (
            <>
              <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-4">
                {(!paper.chat || paper.chat.length === 0) && <div className="text-center text-sm text-slate-400 py-10 italic">No messages yet.</div>}
                {paper.chat?.map(msg => (
                  <div key={msg.id} className={`flex flex-col ${msg.author === user.fullname ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] font-bold text-slate-500 mb-1">{msg.author === user.fullname ? 'You' : msg.author} • {msg.time}</span>
                    <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${msg.author === user.fullname ? 'bg-teal-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'}`}>{msg.text}</div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleSendChat} className="p-3 bg-white border-t border-slate-200 flex space-x-2">
                <input type="text" value={newChat} onChange={e => setNewChat(e.target.value)} placeholder="Message co-authors..." className="flex-1 px-4 py-2 bg-slate-100 border-transparent rounded-full text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none" />
                <button type="submit" disabled={!newChat.trim()} className="p-2 bg-teal-600 text-white rounded-full hover:bg-teal-500 disabled:opacity-50"><Send className="h-4 w-4 ml-0.5" /></button>
              </form>
            </>
          ) : (
            <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-3">
              {(!paper.audit_log || paper.audit_log.length === 0) && <div className="text-center text-sm text-slate-400 py-10 italic">No activity recorded yet.</div>}
              {paper.audit_log?.slice().reverse().map(log => (
                <div key={log.id} className="flex space-x-3 text-sm items-start">
                  <div className="w-12 text-[10px] text-slate-400 font-mono pt-1 text-right shrink-0">{log.time}</div>
                  <div className="flex-1 pb-3 border-l-2 border-slate-200 pl-3 relative">
                    <div className="absolute w-2 h-2 bg-teal-500 rounded-full -left-[5px] top-1.5 border-2 border-white"></div>
                    <span className="font-bold text-slate-700">{log.user}</span> <span className="text-slate-600">{log.action.toLowerCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TEAM MANAGEMENT MODAL */}
      {showTeamModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="bg-slate-900 p-4 flex justify-between items-center text-white">
              <h3 className="font-bold flex items-center space-x-2"><Users className="h-5 w-5"/> <span>Manage Co-Authors</span></h3>
              <button onClick={() => setShowTeamModal(false)} className="text-slate-400 hover:text-white"><X className="h-5 w-5"/></button>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto bg-slate-50">
              {(!paper.co_authors || paper.co_authors.length === 0) && <p className="text-sm text-slate-500 text-center py-4">No co-authors have joined yet.</p>}
              {paper.co_authors?.map(author => (
                <div key={author} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                  <span className="text-sm font-bold text-slate-700">{author}</span>
                  <button onClick={() => removeCoAuthor(author)} className="text-xs bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-3 py-1.5 rounded font-bold transition flex items-center space-x-1">
                    <UserMinus className="h-3 w-3" /> <span>Revoke Access</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
