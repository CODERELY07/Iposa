import Link from 'next/link'

export default function HomePage() {
  const features = [
    {
      icon: '📦',
      title: 'Inventory Management',
      description: 'Track products, categories, and stock levels in real-time',
      href: '/inventory/products'
    },
    {
      icon: '💳',
      title: 'Point of Sale',
      description: 'Fast and efficient checkout system for your business',
      href: '/pos'
    },
    {
      icon: '📊',
      title: 'Dashboard',
      description: 'Real-time analytics and business metrics at a glance',
      href: '/dashboard'
    },
    {
      icon: '📈',
      title: 'Analytics',
      description: 'Detailed reports and insights into your business performance',
      href: '/analytics'
    },
    {
      icon: '🥘',
      title: 'Ingredients',
      description: 'Manage ingredients and recipe compositions',
      href: '/ingredients'
    },
    {
      icon: '🏷️',
      title: 'Categories',
      description: 'Organize your products into logical categories',
      href: '/inventory/categories'
    }
  ]
  // Triggering fresh build to update homepage content and features
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-zinc-50">
      {/* Hero Section */}
      <section className="px-4 py-12 sm:py-16 md:py-24 lg:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-zinc-900 mb-4 md:mb-6">
            Welcome to Your <span className="text-blue-600">Inventory System</span>
          </h1>
          <p className="text-lg sm:text-xl text-zinc-600 mb-8 md:mb-12 max-w-2xl mx-auto">
            Streamline your business operations with our comprehensive inventory management, POS, and analytics platform.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dashboard"
              className="px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 text-center"
            >
              Go to Dashboard
            </Link>
            <Link
              href="/pos"
              className="px-6 sm:px-8 py-3 sm:py-4 bg-zinc-200 hover:bg-zinc-300 text-zinc-900 font-semibold rounded-lg transition-colors duration-200 text-center"
            >
              Open POS
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-4 py-12 sm:py-16 md:py-24">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center text-zinc-900 mb-8 md:mb-16">
            Key Features
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {features.map((feature) => (
              <Link
                key={feature.href}
                href={feature.href}
                className="group p-6 md:p-8 bg-white rounded-lg border border-zinc-200 hover:border-blue-400 hover:shadow-lg transition-all duration-200"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-lg md:text-xl font-semibold text-zinc-900 mb-2 group-hover:text-blue-600 transition">
                  {feature.title}
                </h3>
                <p className="text-sm md:text-base text-zinc-600">
                  {feature.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-4 py-12 sm:py-16 md:py-24 bg-zinc-900 text-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {[
              { number: '100%', label: 'Real-time Updates' },
              { number: '24/7', label: 'Available' },
              { number: '∞', label: 'Scalable' },
              { number: '🔒', label: 'Secure' }
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl md:text-4xl font-bold mb-2">{stat.number}</div>
                <p className="text-zinc-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-12 sm:py-16 md:py-24">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-zinc-900 mb-4 md:mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-zinc-600 mb-8 md:mb-12">
            Explore all features and take control of your inventory today.
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200"
          >
            Access Full System
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-8 md:py-12 bg-zinc-50 border-t border-zinc-200">
        <div className="max-w-6xl mx-auto">
          <div className="text-center text-sm text-zinc-600">
            <p>&copy; 2024 Inventory System. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
