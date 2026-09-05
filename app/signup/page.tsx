import SignupForm from '@/components/auth/signup-form';

export const metadata = {
  title: 'Sign Up - Legal Metrology Platform',
  description: 'Create an inspector account on Legal Metrology Platform',
};

export default function SignupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 dark:bg-black">
      <SignupForm />
    </main>
  );
}

