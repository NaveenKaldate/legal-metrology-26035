'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { SignupSchema, SignupInput } from '@/lib/validations/auth';

export default function SignupForm() {
  const router = useRouter();
  const [formData, setFormData] = useState<SignupInput>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (serverError) setServerError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError(null);
    setSuccessMessage(null);

    // Validate using Zod
    const validationResult = SignupSchema.safeParse(formData);
    if (!validationResult.success) {
      const fieldErrors: Record<string, string> = {};
      validationResult.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0] as string] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
          },
        },
      });

      if (error) {
        setServerError(error.message);
        setLoading(false);
        return;
      }

      if (data.user && !data.session) {
        setSuccessMessage(
          'Account created successfully! Please check your email to confirm your account before logging in.'
        );
        setLoading(false);
      } else if (data.session) {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setServerError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-md dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Create Account
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Register as an Inspector on Legal Metrology
        </p>
      </div>

      {serverError && (
        <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-900">
          {serverError}
        </div>
      )}

      {successMessage && (
        <div className="p-4 space-y-3 text-sm text-green-800 bg-green-100 rounded-lg dark:bg-green-950/50 dark:text-green-300 border border-green-200 dark:border-green-900">
          <p>{successMessage}</p>
          <Link
            href="/login"
            className="inline-block font-medium text-green-700 underline dark:text-green-200 hover:text-green-900"
          >
            Go to Login
          </Link>
        </div>
      )}

      {!successMessage && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="fullName"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Full Name
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Officer Name"
              className="w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
            />
            {errors.fullName && (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.fullName}</p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="inspector@example.com"
              className="w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
            />
            {errors.email && (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.email}</p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
            />
            {errors.password && (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.password}</p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
            />
            {errors.confirmPassword && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
      )}

      <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
        >
          Sign in here
        </Link>
      </div>
    </div>
  );
}

