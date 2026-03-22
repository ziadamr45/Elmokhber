'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email.trim() || !password.trim()) {
      setError('يرجى ملء جميع الحقول');
      return;
    }

    setLoading(true);

    try {
      // Use /api/admin/auth instead of /api/admin/login
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (data.success && data.token) {
        // Store token in localStorage (same as admin page expects)
        localStorage.setItem('adminToken', data.token);
        router.push('/admin');
      } else {
        setError(data.message || 'فشل تسجيل الدخول');
      }
    } catch {
      setError('حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
      </div>
      
      <Card className="w-full max-w-md relative backdrop-blur-xl bg-slate-900/80 border-slate-700/50 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/25">
            <span className="text-4xl">🔐</span>
          </div>
          <CardTitle className="text-2xl font-bold text-white mb-1">
            لوحة تحكم المدير
          </CardTitle>
          <p className="text-slate-400 text-sm">
            قم بتسجيل الدخول للوصول إلى لوحة التحكم
          </p>
        </CardHeader>
        
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 block">
                البريد الإلكتروني
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-cyan-500/20 h-12 text-right"
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 block">
                كلمة المرور
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-cyan-500/20 h-12 text-right"
                disabled={loading}
              />
            </div>
            
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}
            
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 text-white font-medium shadow-lg shadow-cyan-500/25 transition-all duration-300 disabled:opacity-50"
            >
              {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </Button>

            <Button
              type="button"
              onClick={() => router.push('/')}
              variant="outline"
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              ← العودة للرئيسية
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
