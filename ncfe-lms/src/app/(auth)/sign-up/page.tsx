'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';

export default function SignUpPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      router.push('/sign-in?registered=true');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Card padding="lg">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-text-primary">Create your account</h2>
            <p className="text-sm text-text-secondary mt-1">Get started with your learning journey</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-[6px] text-sm text-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="name"
              name="name"
              label="Full Name"
              type="text"
              placeholder="Enter your full name"
              value={form.name}
              onChange={handleChange}
              required
            />
            <Input
              id="email"
              name="email"
              label="Email"
              type="email"
              placeholder="Enter your email"
              value={form.email}
              onChange={handleChange}
              required
            />
            <Input
              id="password"
              name="password"
              label="Password"
              type="password"
              placeholder="Create a password"
              value={form.password}
              onChange={handleChange}
              required
            />
            <Input
              id="confirmPassword"
              name="confirmPassword"
              label="Confirm Password"
              type="password"
              placeholder="Confirm your password"
              value={form.confirmPassword}
              onChange={handleChange}
              required
            />

            <p className="text-xs text-text-muted">
              Password must be at least 8 characters with one uppercase letter, one lowercase letter, and one number.
            </p>

            <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
              Create account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <Link href="/sign-in" className="text-primary hover:text-primary-dark font-medium">
              Sign in
            </Link>
          </p>
      </Card>
    </>
  );
}
