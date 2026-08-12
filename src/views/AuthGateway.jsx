import React, { useState } from 'react';
import axios from 'axios';
import { ShieldCheck, Loader2 } from 'lucide-react';

const API_BASE_URL = '[https://rescover-backend.onrender.com](https://rescover-backend.onrender.com)';

export default function AuthGateway({ isRegistering, onAuthSuccess }) {
  const [formData, setFormData] = useState({ fullname: '', email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setIsLoading(true);
    try {
      if (isRegistering) {
        await axios.post(`${API_BASE_URL}/api/auth/register`, formData);
      }
      const res = await axios.post(`${API_BASE_URL}/api/auth/login`, { email: formData.email, password: formData.password });
      onAuthSuccess({ fullname: res.data.fullname, token: res.data.access_token });
    } catch (err) {
      setError(err.response?.data?.detail || "Could not connect to backend or database.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row items-center justify-center p-6 gap-12 max-w-6xl mx-auto w-full">
      <div className="lg:w-1/2 space-y-6">
        <div className="inline-flex items-center space-x-2 bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
          <ShieldCheck className="h-4 w-4" /><span>Database Integrated</span>
        </div>
        <h2 className="text-5xl font-black tracking-tight text-slate-900 leading-tight">Draft, Verify, and Publish <span className="text-teal-600">Together.</span></h2>
      </div>
      
      <div className="w-full lg:w-[420px] bg-white p-8 rounded-2xl border shadow-xl space-y-6">
        <h3 className="text-2xl font-bold text-slate-900">{isRegistering ? "Create Profile" : "Scholar Login"}</h3>
        {error && <div className="p-3 bg-red-50 text-red-700 text-xs font-bold rounded-lg">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <input type="text" placeholder="Full Name" required value={formData.fullname} onChange={e => setFormData({...formData, fullname: e.target.value})} className="w-full px-4 py-2 border rounded-lg" />
          )}
          <input type="email" placeholder="Institutional Email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2 border rounded-lg" />
          <input type="password" placeholder="Password" required minLength="6" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full px-4 py-2 border rounded-lg" />
          <button disabled={isLoading} type="submit" className="w-full py-3 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 flex justify-center items-center">
            {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <span>{isRegistering ? "Register Profile" : "Enter Workspace"}</span>}
          </button>
        </form>
      </div>
    </div>
  );
}
