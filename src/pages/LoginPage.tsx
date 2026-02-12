import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuthStore } from '../stores/authStore';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore(s => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Lütfen tüm alanları doldurun.');
      return;
    }

    const success = login(email, password);
    if (success) {
      navigate('/dashboard', { replace: true });
    } else {
      setError('Geçersiz e-posta veya şifre.');
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold text-white">FT</span>
          </div>
          <h1 className="text-2xl font-bold text-text">FitTrack</h1>
          <p className="text-text-muted mt-1">12 Haftalık Fitness Programı</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            placeholder="Şifrenizi girin"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          {error && (
            <p className="text-sm text-error text-center">{error}</p>
          )}

          <Button type="submit" fullWidth size="lg" className="mt-2">
            Giriş Yap
          </Button>
        </form>

        <p className="text-center text-sm text-text-muted mt-6">
          Hesabınız yok mu?{' '}
          <Link to="/register" className="text-primary-light font-medium">
            Kayıt Ol
          </Link>
        </p>

        <div className="mt-6 p-3 bg-surface rounded-xl border border-surface-light">
          <p className="text-xs text-text-muted text-center">
            Demo: demo@fitness.app / demo1234
          </p>
        </div>
      </div>
    </div>
  );
}
