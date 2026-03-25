import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Shield, MessageSquare, Calendar, Star, ArrowRight } from 'lucide-react';

export function Home() {
  return (
    <div className="space-y-24 pb-24">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-400 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-400 rounded-full blur-3xl" />
        </div>

        <div className="text-center space-y-8 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-sm font-semibold mb-6">
              Your Journey to Wellness Starts Here
            </span>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-stone-900 leading-[1.1]">
              Professional Support for Your <span className="text-emerald-600">Mental Well-being</span>
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-xl text-stone-600 leading-relaxed"
          >
            Connect with verified therapists and counsellors from the comfort of your home. 
            Secure, private, and compassionate care tailored to your needs.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <Link
              to="/register"
              className="w-full sm:w-auto px-8 py-4 bg-emerald-600 text-white rounded-full font-semibold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 group"
            >
              Get Started Now
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-8 py-4 bg-white text-stone-900 border border-stone-200 rounded-full font-semibold text-lg hover:bg-stone-50 transition-all"
            >
              View Our Doctors
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          {
            icon: Shield,
            title: "Private & Secure",
            description: "Your sessions and data are protected with end-to-end encryption and strict confidentiality.",
            color: "bg-blue-50 text-blue-600"
          },
          {
            icon: MessageSquare,
            title: "Real-time Chat",
            description: "Connect instantly with your therapist through our secure real-time messaging platform.",
            color: "bg-emerald-50 text-emerald-600"
          },
          {
            icon: Calendar,
            title: "Easy Scheduling",
            description: "Book appointments that fit your schedule with our intuitive booking system.",
            color: "bg-amber-50 text-amber-600"
          }
        ].map((feature, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1 }}
            className="p-8 bg-white rounded-3xl border border-stone-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className={`w-12 h-12 rounded-2xl ${feature.color} flex items-center justify-center mb-6`}>
              <feature.icon className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
            <p className="text-stone-600 leading-relaxed">{feature.description}</p>
          </motion.div>
        ))}
      </section>

      {/* Stats Section */}
      <section className="bg-stone-900 rounded-[3rem] p-12 md:p-20 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl -mr-32 -mt-32" />
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
          {[
            { label: "Active Users", value: "10k+" },
            { label: "Verified Doctors", value: "200+" },
            { label: "Sessions Held", value: "50k+" },
            { label: "Success Rate", value: "98%" }
          ].map((stat, idx) => (
            <div key={idx} className="space-y-2">
              <div className="text-4xl md:text-5xl font-bold text-emerald-400">{stat.value}</div>
              <div className="text-stone-400 text-sm font-medium uppercase tracking-wider">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center space-y-8 py-12">
        <h2 className="text-3xl md:text-5xl font-bold">Ready to take the first step?</h2>
        <p className="text-xl text-stone-600 max-w-2xl mx-auto">
          Join thousands of others who have found support and healing through MindEase.
        </p>
        <Link
          to="/register"
          className="inline-flex px-10 py-4 bg-stone-900 text-white rounded-full font-semibold text-lg hover:bg-stone-800 transition-all"
        >
          Create Your Account
        </Link>
      </section>
    </div>
  );
}
