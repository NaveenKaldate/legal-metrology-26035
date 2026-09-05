import LoginForm from '@/components/auth/login-form';

export const metadata = {
  title: 'Login - Legal Metrology Platform',
  description: 'Sign in to Legal Metrology Weighing Instrument Inspection Platform',
};

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 dark:bg-black">
      <LoginForm />
    </main>
  );
}

