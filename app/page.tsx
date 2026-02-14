'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import { Check, Zap, Shield, Palette, Code, Rocket } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      {/* Navigation */}
      <nav className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-primary-600 to-primary-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg">F</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent">
              SmartWealth
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => router.push('/login')}
            >
              Sign In
            </Button>
            <Button
              onClick={() => router.push('/signup')}
            >
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
            <Zap className="w-4 h-4 text-primary-600" />
            <span className="text-sm font-semibold text-primary-700 dark:text-primary-400">
              Production-Ready SaaS Template
            </span>
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
            Build Your SaaS
            <br />
            <span className="bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent">
              In Record Time
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            A complete Next.js template with authentication, payments, and theme support. 
            Start building features, not infrastructure.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="text-lg px-8"
              onClick={() => router.push('/signup')}
            >
              <Rocket className="w-5 h-5 mr-2" />
              Get Started Free
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8"
              onClick={() => router.push('/pricing')}
            >
              View Pricing
            </Button>
          </div>

          <div className="flex flex-wrap gap-6 justify-center text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary-600" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary-600" />
              <span>14-day free trial</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary-600" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything You Need
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Built with modern technologies and best practices
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
          <Card>
            <CardHeader>
              <Shield className="w-10 h-10 text-primary-600 mb-2" />
              <CardTitle>Complete Authentication</CardTitle>
              <CardDescription>
                Email/password signup, login, and email verification out of the box
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Zap className="w-10 h-10 text-primary-600 mb-2" />
              <CardTitle>Stripe Payments</CardTitle>
              <CardDescription>
                Subscription billing, webhooks, and customer portal fully integrated
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Palette className="w-10 h-10 text-primary-600 mb-2" />
              <CardTitle>Theme System</CardTitle>
              <CardDescription>
                Light/dark mode with centralized color customization via CSS variables
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Code className="w-10 h-10 text-primary-600 mb-2" />
              <CardTitle>TypeScript</CardTitle>
              <CardDescription>
                Fully typed codebase with Next.js 16, React 19, and Tailwind CSS 4
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Rocket className="w-10 h-10 text-primary-600 mb-2" />
              <CardTitle>Production Ready</CardTitle>
              <CardDescription>
                MongoDB integration, email service, and deployment-ready configuration
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Check className="w-10 h-10 text-primary-600 mb-2" />
              <CardTitle>Easy Customization</CardTitle>
              <CardDescription>
                Change colors, branding, and features with simple find/replace
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <Card className="max-w-4xl mx-auto text-center p-12 bg-gradient-to-br from-primary-50 to-white dark:from-primary-950/20 dark:to-gray-900 border-primary-200 dark:border-primary-800">
          <CardHeader>
            <CardTitle className="text-4xl mb-4">
              Ready to Build Your SaaS?
            </CardTitle>
            <CardDescription className="text-lg">
              Join developers who are shipping faster with SmartWealth
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              size="lg"
              className="text-lg px-8"
              onClick={() => router.push('/signup')}
            >
              Start Building Now
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-12">
        <div className="container mx-auto px-4 text-center text-gray-600 dark:text-gray-400">
          <p className="mb-2">
            <strong className="text-primary-600">SmartWealth</strong> - Your SaaS Template
          </p>
          <p className="text-sm">
            Built with Next.js, React, MongoDB, and Stripe
          </p>
        </div>
      </footer>
    </main>
  )
}
