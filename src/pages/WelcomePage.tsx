import { useNavigate } from 'react-router';
import { useUserStore } from '../stores/userStore';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

const FEATURES = [
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
      </svg>
    ),
    title: '12 Haftalık Program',
    desc: 'Bilimsel temelli, progresif yükleme prensibiyle hazırlanmış program.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z" clipRule="evenodd" />
      </svg>
    ),
    title: '3 Farklı Antrenman',
    desc: 'Workout A, B ve C ile tüm kas gruplarını hedefleyen çeşitli hareketler.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path fillRule="evenodd" d="M2.25 13.5a8.25 8.25 0 0 1 8.25-8.25.75.75 0 0 1 .75.75v6.75H18a.75.75 0 0 1 .75.75 8.25 8.25 0 0 1-16.5 0Z" clipRule="evenodd" />
        <path fillRule="evenodd" d="M12.75 3a.75.75 0 0 1 .75-.75 8.25 8.25 0 0 1 8.25 8.25.75.75 0 0 1-.75.75h-7.5a.75.75 0 0 1-.75-.75V3Z" clipRule="evenodd" />
      </svg>
    ),
    title: 'Otomatik Ağırlık Artışı',
    desc: 'Başlangıç değerlerine göre haftalık ağırlık progresyonu otomatik hesaplanır.',
  },
];

export default function WelcomePage() {
  const navigate = useNavigate();
  const user = useUserStore(s => s.user);

  return (
    <div className="min-h-dvh flex flex-col px-6 py-8">
      <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
        {/* Logo & Greeting */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl font-bold text-white">FT</span>
          </div>
          <h1 className="text-2xl font-bold text-text">
            Hoş geldin, {user?.name?.split(' ')[0] || 'Sporcu'}!
          </h1>
          <p className="text-text-muted mt-2">
            12 haftalık fitness programına hazır mısın?
          </p>
        </div>

        {/* Feature Cards */}
        <div className="flex flex-col gap-3 w-full mb-8">
          {FEATURES.map((f, i) => (
            <Card key={i} className="flex items-start gap-3">
              <div className="text-primary-light mt-0.5 flex-shrink-0">{f.icon}</div>
              <div>
                <h3 className="font-semibold text-text text-sm">{f.title}</h3>
                <p className="text-xs text-text-muted mt-0.5">{f.desc}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* CTA */}
        <div className="w-full flex flex-col gap-3">
          <Button
            fullWidth
            size="lg"
            onClick={() => navigate('/setup')}
          >
            Programı Başlat
          </Button>
          <p className="text-xs text-text-muted text-center">
            İlk olarak her hareket için başlangıç değerlerini gireceksin.
          </p>
        </div>
      </div>
    </div>
  );
}
