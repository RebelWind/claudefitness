import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { createNewProgram, generateProgramKey } from '../lib/n8nService';
import { saveUserProgram } from '../lib/programService';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore(s => s.register);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatusMsg('');

    if (!name || !email || !password) {
      setError('Lütfen tüm alanları doldurun.');
      return;
    }

    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      return;
    }

    setLoading(true);

    // 1. Register with Supabase Auth
    setStatusMsg('Hesap oluşturuluyor...');
    const errorMsg = await register(email, password, name);

    if (errorMsg) {
      setLoading(false);
      setStatusMsg('');
      setError(errorMsg);
      return;
    }

    // 2. Create program via n8n webhook
    try {
      setStatusMsg('Program dosyası oluşturuluyor...');
      const programKey = generateProgramKey();
      const programName = `${programKey}-SuperHeroDongu`;

      const result = await createNewProgram(programKey);

      // 3. Save to Supabase DB
      setStatusMsg('Program kaydediliyor...');
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (userId) {
        await saveUserProgram(
          userId,
          programKey,
          programName,
          result.googleFileId,
          result.googleFileName,
        );
      }
    } catch (err) {
      // Log but don't block registration — program can be retried later
      console.error('Program oluşturma hatası:', err);
    }

    setLoading(false);
    setStatusMsg('');
    navigate('/welcome', { replace: true });
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-white">FT</span>
          </div>
          <h1 className="text-2xl font-bold text-text">Kayıt Ol</h1>
          <p className="text-text-muted mt-1">Fitness yolculuğuna başla</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="İsim"
            type="text"
            placeholder="Adınız"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <Input
            label="E-posta"
            type="email"
            placeholder="ornek@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <Input
            label="Şifre"
            type="password"
            placeholder="En az 6 karakter"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          {error && (
            <p className="text-sm text-error text-center">{error}</p>
          )}

          {statusMsg && (
            <p className="text-sm text-primary-light text-center animate-pulse">{statusMsg}</p>
          )}

          <Button type="submit" fullWidth size="lg" className="mt-2" disabled={loading}>
            {loading ? 'İşleniyor...' : 'Kayıt Ol'}
          </Button>
        </form>

        <p className="text-center text-sm text-text-muted mt-6">
          Zaten hesabınız var mı?{' '}
          <Link to="/login" className="text-primary-light font-medium">
            Giriş Yap
          </Link>
        </p>
      </div>
    </div>
  );
}
