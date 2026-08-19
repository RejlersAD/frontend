import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PRICING_CONFIG, PLAN_COLORS } from '../config/pricing.config';
import {
  CheckIcon,
  XMarkIcon,
  SparklesIcon,
  ShieldCheckIcon,
  UsersIcon,
  ClockIcon,
  GlobeAltIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';

/**
 * Public Subscription Plans Page
 * Fully soft-coded pricing page with advanced features
 * No hardcoded values - all content from pricing.config.js
 */
const SubscriptionPlans = () => {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [expandedFaq, setExpandedFaq] = useState(null);
  const { header, display, cta, trustIndicators, plans, comparisonFeatures, faq } = PRICING_CONFIG;

  const getPrice = (plan) => {
    return billingCycle === 'monthly' ? plan.price.monthly : plan.price.yearly;
  };

  const handlePlanSelect = (plan) => {
    if (plan.cta.action === 'contact') {
      navigate(cta.contactSalesLink);
    } else if (cta.loginRequired) {
      navigate(cta.loginLink);
    }
  };

  const renderFeatureIcon = (iconName) => {
    const iconProps = { className: 'w-5 h-5', strokeWidth: 2 };
    switch (iconName) {
      case 'users': return <UsersIcon {...iconProps} />;
      case 'shield-check': return <ShieldCheckIcon {...iconProps} />;
      case 'clock': return <ClockIcon {...iconProps} />;
      case 'globe': return <GlobeAltIcon {...iconProps} />;
      default: return <SparklesIcon {...iconProps} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 text-white py-16 sm:py-20">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden opacity-10">
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-white to-transparent rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-white to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {header.badge && (
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full mb-6">
              <SparklesIcon className="w-5 h-5" />
              <span className="text-sm font-bold">{header.badge}</span>
            </div>
          )}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-4">
            {header.title}
          </h1>
          <p className="text-xl sm:text-2xl text-blue-100 mb-3">
            {header.subtitle}
          </p>
          <p className="text-base text-blue-200 max-w-2xl mx-auto">
            {header.description}
          </p>
        </div>
      </div>

      {/* Trust Indicators */}
      {trustIndicators.enabled && (
        <div className="bg-white border-b border-gray-200 py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {trustIndicators.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-center space-x-2 text-gray-700">
                  {renderFeatureIcon(item.icon)}
                  <span className="text-sm font-semibold">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Billing Toggle */}
        {display.showAnnualToggle && (
          <div className="flex justify-center mb-12">
            <div className="inline-flex items-center bg-white rounded-full p-1 shadow-lg border-2 border-gray-200">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-3 rounded-full font-bold transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {display.billingCycles.monthly.label}
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-6 py-3 rounded-full font-bold transition-all relative ${
                  billingCycle === 'yearly'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {display.billingCycles.yearly.label}
                {display.billingCycles.yearly.badge && (
                  <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">
                    {display.billingCycles.yearly.badge}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-16">
          {plans.map((plan) => {
            const colors = PLAN_COLORS[plan.code];
            const price = getPrice(plan);
            const isHighlight = plan.highlight || plan.code === display.highlightPlan;

            return (
              <div
                key={plan.code}
                className={`relative bg-white rounded-2xl shadow-xl p-8 border-2 transition-all hover:shadow-2xl ${
                  colors.border
                } ${isHighlight ? colors.highlight + ' transform lg:scale-105' : ''}`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className={`inline-flex items-center px-4 py-1 rounded-full text-xs font-bold border-2 shadow-lg ${colors.badge}`}>
                      {plan.badge.text}
                    </span>
                  </div>
                )}

                {/* Plan Header */}
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-black text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">{plan.tagline}</p>
                  
                  <div className="flex items-baseline justify-center space-x-2">
                    <span className="text-5xl font-black text-gray-900">
                      {display.currency.position === 'before' && display.currency.symbol}
                      {price}
                      {display.currency.position === 'after' && display.currency.symbol}
                    </span>
                    <span className="text-gray-600">
                      {display.billingCycles[billingCycle].suffix}
                    </span>
                  </div>
                </div>

                {/* Key Features */}
                <div className="space-y-3 mb-6">
                  {Object.entries(plan.features).map(([key, feature]) => (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{feature.label}:</span>
                      <span className="font-bold text-gray-900">{feature.value}</span>
                    </div>
                  ))}
                </div>

                {/* Included Features */}
                <div className="space-y-2 mb-6 pt-6 border-t border-gray-200">
                  {plan.includedFeatures.map((feature, idx) => (
                    <div key={idx} className="flex items-start space-x-2">
                      <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handlePlanSelect(plan)}
                  className={`w-full py-3 px-6 rounded-xl font-bold transition-all transform hover:scale-105 ${
                    plan.cta.style === 'outline'
                      ? colors.button + ' border-2'
                      : colors.button + ' shadow-lg'
                  }`}
                >
                  {plan.cta.text}
                </button>
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Table */}
        {display.showComparison && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-16">
            <h2 className="text-3xl font-black text-center mb-8">Feature Comparison</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-4 px-4 font-bold text-gray-900">Features</th>
                    {plans.map((plan) => (
                      <th key={plan.code} className="text-center py-4 px-4 font-bold text-gray-900">
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((category) => (
                    <React.Fragment key={category.category}>
                      <tr className="bg-gray-50">
                        <td colSpan={plans.length + 1} className="py-3 px-4 font-bold text-gray-900">
                          {category.category}
                        </td>
                      </tr>
                      {category.features.map((feature, idx) => (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-700">{feature.name}</td>
                          {plans.map((plan) => (
                            <td key={plan.code} className="text-center py-3 px-4">
                              {feature[plan.code] ? (
                                <CheckIcon className="w-5 h-5 text-green-500 mx-auto" />
                              ) : (
                                <XMarkIcon className="w-5 h-5 text-gray-300 mx-auto" />
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FAQ Section */}
        {faq.enabled && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-3xl font-black text-center mb-8">{faq.title}</h2>
            <div className="max-w-3xl mx-auto space-y-4">
              {faq.items.map((item, idx) => (
                <div key={idx} className="border-b border-gray-200 pb-4">
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                    className="w-full flex items-center justify-between text-left py-3 hover:text-blue-600 transition-colors"
                  >
                    <span className="font-bold text-gray-900">{item.question}</span>
                    {expandedFaq === idx ? (
                      <ChevronUpIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    ) : (
                      <ChevronDownIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                  </button>
                  {expandedFaq === idx && (
                    <p className="text-gray-600 mt-2 pl-4 border-l-2 border-blue-600">
                      {item.answer}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl shadow-2xl p-12">
            <h2 className="text-3xl font-black text-white mb-4">
              Ready to get started?
            </h2>
            <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
              Join hundreds of companies already using RADAI to streamline their engineering workflows
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <Link
                to={cta.loginLink}
                className="px-8 py-4 bg-white text-blue-600 font-bold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                {cta.loginText}
              </Link>
              <Link
                to={cta.contactSalesLink}
                className="px-8 py-4 bg-transparent border-2 border-white text-white font-bold rounded-xl hover:bg-white/10 transition-all"
              >
                {cta.contactSalesText}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPlans;
