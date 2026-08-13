import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, FileText, Globe, Loader2, Compass, UserPlus, CheckCircle2, Bell, Users, X, Award } from 'lucide-react';
const API_BASE_URL = 'https://rescover-backend.onrender.com';

export default function Dashboard({ user, onOpenPaper }) {
  const [activeTab, setActiveTab] = useState('drafts');
  const [papers, setPapers] = useState({ drafts: [], discover: [], in_review: [], published: [] });
  const [notifications, setNotifications] = useState([]);
  const [scholars, setScholars] = useState([]); 
  
  const [showNotifs, setShowNotifs] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [uploadMode, setUploadMode] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  
  const [selectedScholar, setSelectedScholar] = useState(null);
  const [scholarPortfolio, setScholarPortfolio] = useState([]);
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);

  const fetchPapers = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/papers?user_name=${encodeURIComponent(user.fullname)}`);
      setPapers(res.data);
    } catch (err) { } finally { setIsLoading(false); }
  };

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/notifications/${encodeURIComponent(user.fullname)}`);
      setNotifications(res.data);
    } catch (err) { }
  };

  const fetchScholars = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/scholars`);
      setScholars(res.data);
    } catch (err) { }
  };

  useEffect(() => {
    fetchPapers();
    fetchNotifications();
    fetchScholars();
    
    const interval = setInterval(() => {
      fetchPapers();
      fetchNotifications();
      fetchScholars();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [user]);

  const markRead = async (id) => {
    await axios.put(`${API_BASE_URL}/api/notifications/${id}/read`);
    fetchNotifications();
  };

  const handleCreateResearch = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsCreating(true);
    try {
      let response;

      if (uploadMode && uploadedFile) {
        const formData = new FormData();
        formData.append('title', newTitle.trim());
        formData.append('author_name', user.fullname);
        formData.append('file', uploadedFile);

        try {
          response = await axios.post(`${API_BASE_URL}/api/papers/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (uploadErr) {
          console.warn('Upload endpoint unavailable; falling back to create + publish flow.', uploadErr);
          response = await axios.post(`${API_BASE_URL}/api/papers/create`, {
            title: newTitle.trim(),
            author_name: user.fullname,
          });

          await axios.put(`${API_BASE_URL}/api/papers/${response.data.paper.id}/status`, {
            status: 'published',
            user_fullname: user.fullname,
          });
        }
      } else {
        response = await axios.post(`${API_BASE_URL}/api/papers/create`, {
          title: newTitle.trim(),
          author_name: user.fullname,
        });

        if (uploadMode) {
          await axios.put(`${API_BASE_URL}/api/papers/${response.data.paper.id}/status`, {
            status: 'published',
            user_fullname: user.fullname,
          });
        }
      }

      const paperId = response.data.paper?.id || response.data.id || response.data.paper_id;

      setNewTitle('');
      setUploadedFile(null);
      setUploadMode(false);
      setIsModalOpen(false);
      fetchPapers();
      if (paperId) onOpenPaper(paperId);
    } catch (err) {
      console.error('Failed to create research:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRequestJoin = async (paperId, e) => {
    e.stopPropagation();
    try {
      await axios.post(`${API_BASE_URL}/api/papers/${paperId}/request-join`, { user_fullname: user.fullname });
      fetchPapers();
    } catch (err) { }
  };

  const handleApproveJoin = async (paperId, requesterName, e) => {
    e.stopPropagation();
    try {
      await axios.post(`${API_BASE_URL}/api/papers/${paperId}/approve-join`, { user_fullname: requesterName });
      fetchPapers();
    } catch (err) { }
  };

  const handleTogglePaperPrivacy = async (paperId, isCurrentlyPrivate, e) => {
    e.stopPropagation();
    const action = isCurrentlyPrivate ? 'make public again' : 'make it private';
    const confirmed = window.confirm(`This work will ${action}. Continue?`);
    if (!confirmed) return;

    try {
      await axios.put(`${API_BASE_URL}/api/papers/${paperId}/privacy`, {
        user_fullname: user.fullname,
        is_private: !isCurrentlyPrivate,
      });
      fetchPapers();
    } catch (err) {
      try {
        await axios.post(`${API_BASE_URL}/api/papers/${paperId}/privacy`, {
          user_fullname: user.fullname,
          is_private: !isCurrentlyPrivate,
        });
        fetchPapers();
      } catch (fallbackErr) {
        console.error('Failed to update privacy status:', fallbackErr);
      }
    }
  };

  const handleDeletePaper = async (paperId, title, e) => {
    e.stopPropagation();
    const confirmed = window.confirm(`Delete "${title}" permanently from the database? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await axios.delete(`${API_BASE_URL}/api/papers/${paperId}`, {
        data: { user_fullname: user.fullname },
      });
      fetchPapers();
    } catch (err) {
      try {
        await axios.post(`${API_BASE_URL}/api/papers/${paperId}/delete`, { user_fullname: user.fullname });
        fetchPapers();
      } catch (fallbackErr) {
        console.error('Failed to delete paper:', fallbackErr);
      }
    }
  };

  const handleViewScholar = async (scholarName) => {
    setSelectedScholar(scholarName);
    setIsLoadingPortfolio(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/scholars/${encodeURIComponent(scholarName)}/portfolio`);
      setScholarPortfolio(res.data);
    } catch (err) { } finally { setIsLoadingPortfolio(false); }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Research Hub</h2>
          <p className="text-slate-500 text-sm mt-1">Manage collaborations or discover new open projects.</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="relative">
            <button onClick={() => setShowNotifs(!showNotifs)} className="p-2.5 bg-white border border-slate-200 rounded-full hover:bg-slate-50 relative">
              <Bell className="h-5 w-5 text-slate-600" />
              {unreadCount > 0 && <span className="absolute top-0 right-0 h-3 w-3 bg-red-500 rounded-full border-2 border-white"></span>}
            </button>
            
            {showNotifs && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                <div className="bg-slate-900 p-3 text-white text-sm font-bold flex justify-between">
                  <span>Notifications</span>
                  <span className="bg-slate-700 px-2 rounded-full text-xs">{unreadCount} New</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? <p className="p-4 text-center text-xs text-slate-500">No recent activity.</p> : null}
                  {notifications.map(n => (
                    <div key={n.id} onClick={() => markRead(n.id)} className={`p-3 border-b border-slate-100 cursor-pointer transition ${n.is_read ? 'opacity-60 bg-white' : 'bg-teal-50 hover:bg-teal-100'}`}>
                      <p className="text-xs text-slate-800 font-medium">{n.message}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{n.time}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => { setUploadMode(false); setIsModalOpen(true); }} className="bg-teal-600 text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-teal-500 flex items-center space-x-2 shadow-sm">
              <Plus className="h-5 w-5" /><span>Start New Research</span>
            </button>
            <button onClick={() => { setUploadMode(true); setIsModalOpen(true); }} className="bg-slate-900 text-white px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-slate-800 flex items-center space-x-2 shadow-sm">
              <Globe className="h-4 w-4" /><span>Upload Existing Work</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto">
        <TabButton active={activeTab === 'drafts'} onClick={() => setActiveTab('drafts')} icon={FileText} label="My Workspace" count={papers.drafts.length} />
        <TabButton active={activeTab === 'discover'} onClick={() => setActiveTab('discover')} icon={Compass} label="Discover Projects" count={papers.discover.length} />
        <TabButton active={activeTab === 'published'} onClick={() => setActiveTab('published')} icon={Globe} label="Published Works" count={papers.published.length} />
        <TabButton active={activeTab === 'scholars'} onClick={() => setActiveTab('scholars')} icon={Users} label="Scholar Network" count={scholars.length} />
      </div>

      {isLoading ? (
        <div className="py-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {activeTab === 'scholars' ? (
             scholars.length === 0 ? (
               <div className="col-span-full py-12 text-center text-slate-500 bg-white border border-slate-200 border-dashed rounded-xl">No scholars found.</div>
             ) : (
               scholars.map(scholar => (
                 <div key={scholar.email} onClick={() => handleViewScholar(scholar.fullname)} className="bg-white border border-slate-200 hover:border-teal-400 hover:shadow-md cursor-pointer rounded-xl p-5 flex items-center space-x-4 transition">
                   <div className="h-12 w-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
                     {scholar.fullname.charAt(0).toUpperCase()}
                   </div>
                   <div>
                     <h3 className="font-bold text-slate-900">{scholar.fullname}</h3>
                     <p className="text-xs text-slate-500">{scholar.email}</p>
                     <p className="text-[10px] uppercase font-bold text-teal-600 mt-1 tracking-wider">View Portfolio</p>
                   </div>
                 </div>
               ))
             )
          ) : (
            papers[activeTab].length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 bg-white border border-slate-200 border-dashed rounded-xl">No documents found in this category.</div>
            ) : (
              papers[activeTab].map((paper) => (
                <div key={paper.id} onClick={() => (activeTab === 'drafts' || activeTab === 'published') && onOpenPaper(paper.id)} className={`bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between transition-colors ${(activeTab === 'drafts' || activeTab === 'published') ? 'cursor-pointer hover:border-teal-400 hover:shadow-md' : ''}`}>
                  <div>
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-teal-600">{paper.status.replace('_', ' ')}</div>
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        {activeTab === 'drafts' && paper.owner_name === user.fullname && <span className="text-[9px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded uppercase font-bold tracking-wider">Owner</span>}
                        {activeTab === 'drafts' && paper.owner_name !== user.fullname && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded uppercase font-bold tracking-wider">Co-Author</span>}
                        {paper.is_private && <span className="text-[9px] bg-slate-800 text-white px-2 py-0.5 rounded uppercase font-bold tracking-wider">Private</span>}
                      </div>
                    </div>
                    <h3 className="font-bold text-slate-900 leading-tight mb-3">{paper.title}</h3>
                    <p className="text-xs text-slate-500 mb-1">Lead Author: <span className="font-semibold text-slate-700">{paper.owner_name}</span></p>
                    {paper.co_authors && paper.co_authors.length > 0 && <p className="text-xs text-slate-500">Team: <span className="text-slate-600">{paper.co_authors.join(', ')}</span></p>}
                  </div>

                  {activeTab === 'drafts' && paper.owner_name === user.fullname && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleTogglePaperPrivacy(paper.id, Boolean(paper.is_private), e)}
                        className="flex-1 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 text-[11px] font-bold rounded"
                      >
                        {paper.is_private ? 'Make Public' : 'Make Private'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeletePaper(paper.id, paper.title, e)}
                        className="flex-1 py-2 bg-red-50 text-red-600 hover:bg-red-100 text-[11px] font-bold rounded"
                      >
                        Delete
                      </button>
                    </div>
                  )}

                  {activeTab === 'discover' && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      {paper.pending_requests?.includes(user.fullname) ? (
                        <div className="w-full py-2 bg-slate-100 text-slate-500 text-xs font-bold rounded flex justify-center items-center space-x-1"><Loader2 className="h-3 w-3 animate-spin" /><span>Request Pending...</span></div>
                      ) : (
                        <button onClick={(e) => handleRequestJoin(paper.id, e)} className="w-full py-2 bg-teal-50 text-teal-700 hover:bg-teal-100 text-xs font-bold rounded flex items-center justify-center space-x-2"><UserPlus className="h-4 w-4" /><span>Request to Co-Author</span></button>
                      )}
                    </div>
                  )}

                  {activeTab === 'drafts' && paper.owner_name === user.fullname && paper.pending_requests?.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Approvals</p>
                      {paper.pending_requests.map(requester => (
                        <div key={requester} className="flex justify-between items-center bg-amber-50 px-3 py-2 rounded border border-amber-100">
                          <span className="text-xs font-semibold text-amber-900">{requester}</span>
                          <button onClick={(e) => handleApproveJoin(paper.id, requester, e)} className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-2 py-1 rounded font-bold flex items-center space-x-1"><CheckCircle2 className="h-3 w-3" /><span>Approve</span></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )
          )}
        </div>
      )}

      {selectedScholar && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="bg-slate-900 p-6 flex justify-between items-center text-white">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 rounded-full bg-teal-600 border-2 border-white flex items-center justify-center font-bold text-lg">
                  {selectedScholar.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-xl">{selectedScholar}</h3>
                  <p className="text-xs text-teal-300 font-bold uppercase tracking-wider">Public Portfolio</p>
                </div>
              </div>
              <button onClick={() => setSelectedScholar(null)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full"><X className="h-5 w-5"/></button>
            </div>
            
            <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
              {isLoadingPortfolio ? (
                <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>
              ) : scholarPortfolio.length === 0 ? (
                <div className="text-center py-12">
                  <Award className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No published works yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {scholarPortfolio.map(paper => (
                    <div key={paper.id} onClick={() => onOpenPaper(paper.id)} className="bg-white p-4 rounded-xl border border-slate-200 hover:border-teal-400 cursor-pointer shadow-sm transition">
                      <h4 className="font-bold text-slate-900 mb-1">{paper.title}</h4>
                      <p className="text-xs text-slate-500">Lead Author: {paper.owner_name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-bold text-slate-900">{uploadMode ? 'Upload Existing Work' : 'Initiate Research'}</h3>
              <button type="button" onClick={() => { setIsModalOpen(false); setUploadMode(false); setNewTitle(''); setUploadedFile(null); }} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              {uploadMode
                ? 'Add a published manuscript that was written outside the platform.'
                : 'Give your new manuscript a working title. You will be set as the Lead Author.'}
            </p>
            <form onSubmit={handleCreateResearch}>
              <input type="text" required placeholder="e.g., The Future of ML..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-teal-500" />

              {uploadMode && (
                <div className="mb-4">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Upload manuscript file</label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-teal-600 file:text-white file:font-bold file:cursor-pointer"
                  />
                  {uploadedFile && <p className="mt-2 text-xs text-slate-500">Selected: {uploadedFile.name}</p>}
                </div>
              )}

              <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                {uploadMode
                  ? 'This will create a published platform entry and open it immediately. If a file is added, it will be sent for parsing and extraction.'
                  : 'This creates a draft workspace so you can continue editing within the platform.'}
              </div>
              <div className="flex space-x-3">
                <button type="button" onClick={() => { setIsModalOpen(false); setUploadMode(false); setNewTitle(''); setUploadedFile(null); }} className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50">Cancel</button>
                <button disabled={isCreating} type="submit" className="flex-1 py-2.5 bg-teal-600 text-white font-bold rounded-lg flex justify-center hover:bg-teal-500">
                  {isCreating ? <Loader2 className="h-5 w-5 animate-spin" /> : (uploadMode ? 'Upload as Published' : 'Create Draft')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, count }) {
  return (
    <button onClick={onClick} className={`flex items-center space-x-2 px-4 py-3 text-sm font-bold border-b-2 transition whitespace-nowrap ${active ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${active ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-600'}`}>{count}</span>
    </button>
  );
}