import { Link } from 'react-router';
import Button from '../components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl font-bold text-text-muted mb-4">404</div>
      <h1 className="text-xl font-bold text-text mb-2">Sayfa Bulunamadı</h1>
      <p className="text-text-muted mb-6">Aradığınız sayfa mevcut değil.</p>
      <Link to="/dashboard">
        <Button>Ana Sayfaya Dön</Button>
      </Link>
    </div>
  );
}
