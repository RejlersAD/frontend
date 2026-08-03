/**
 * Shared FAQ accordion for the service pages (lives in the light middle band).
 * Owns its expanded state; pages just pass their config's FAQ array.
 */
import React, { useState } from 'react'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { B, CT } from './serviceTheme'
import { Section, SectionHeader } from './ServiceSection'

const ServiceFAQ = ({ faqs, title = 'Frequently Asked Questions', subtitle }) => {
  const [expandedFaq, setExpandedFaq] = useState(null)

  return (
    <Section>
      <div className="max-w-4xl mx-auto">
        <SectionHeader title={title} subtitle={subtitle} />
        <div className="space-y-4">
          {faqs.map((faq) => {
            const isExpanded = expandedFaq === faq.id
            return (
              <div key={faq.id} className="svc-card3d rounded-2xl overflow-hidden"
                style={isExpanded ? { borderColor: 'rgba(127,202,181,.55)' } : {}}>
                <button
                  onClick={() => setExpandedFaq(isExpanded ? null : faq.id)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between transition-colors hover:bg-white/5"
                >
                  <span className="text-lg font-bold pr-8" style={{ color: CT.heading }}>{faq.question}</span>
                  {isExpanded
                    ? <ChevronUpIcon className="w-6 h-6 flex-shrink-0" style={{ color: B.teal }} />
                    : <ChevronDownIcon className="w-6 h-6 flex-shrink-0" style={{ color: B.teal }} />}
                </button>
                {isExpanded && (
                  <div className="px-6 pb-5 leading-relaxed"
                    style={{ color: CT.body, animation: 'svcFadeUp .3s ease-out' }}>
                    {faq.answer}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Section>
  )
}

export default ServiceFAQ
