import React, { useState } from 'react'
import { DOCUMENTATION_CONFIG } from '../../config/documentation.config'

/**
 * Documentation Component
 * Comprehensive documentation and help center
 * Configuration: src/config/documentation.config.js
 */

const Documentation = ({ isModal = false, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const handleCategoryClick = (categoryId) => {
    setSelectedCategory(categoryId)
    setSelectedArticle(null)
  }

  const handleArticleClick = (article) => {
    setSelectedArticle(article)
  }

  const handleBack = () => {
    if (selectedArticle) {
      setSelectedArticle(null)
    } else if (selectedCategory) {
      setSelectedCategory(null)
    }
  }

  const renderArticleContent = (content) => {
    return content.split('\n').map((line, index) => {
      // Heading 1
      if (line.startsWith('# ')) {
        return <h1 key={index} className="text-3xl font-bold text-gray-900 mb-4 mt-6">{line.substring(2)}</h1>
      }
      // Heading 2
      if (line.startsWith('## ')) {
        return <h2 key={index} className="text-2xl font-bold text-gray-900 mb-3 mt-5">{line.substring(3)}</h2>
      }
      // Heading 3
      if (line.startsWith('### ')) {
        return <h3 key={index} className="text-xl font-semibold text-gray-800 mb-2 mt-4">{line.substring(4)}</h3>
      }
      // List item
      if (line.startsWith('- ')) {
        return <li key={index} className="ml-6 text-gray-700 mb-2">{line.substring(2)}</li>
      }
      // Numbered list
      if (/^\d+\./.test(line)) {
        return <li key={index} className="ml-6 text-gray-700 mb-2">{line.substring(line.indexOf('.') + 2)}</li>
      }
      // Bold text
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={index} className="font-bold text-gray-900 mb-2">{line.substring(2, line.length - 2)}</p>
      }
      // Empty line
      if (line.trim() === '') {
        return <div key={index} className="h-2"></div>
      }
      // Regular paragraph
      return <p key={index} className="text-gray-700 mb-3 leading-relaxed">{line}</p>
    })
  }

  const getCategoryColor = (category) => {
    const cat = DOCUMENTATION_CONFIG.categories.find(c => c.id === category)
    return cat ? cat.gradient : 'from-gray-500 to-gray-600'
  }

  return (
    <div className={`${isModal ? 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4' : 'w-full'}`}>
      <div className={`${isModal ? 'bg-white rounded-3xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col' : 'w-full'}`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-8 relative overflow-hidden flex-shrink-0">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                {(selectedCategory || selectedArticle) && (
                  <button
                    onClick={handleBack}
                    className="w-10 h-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center hover:bg-opacity-30 transition-all"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                    <span className="text-4xl">📚</span>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold">{DOCUMENTATION_CONFIG.title}</h2>
                    <p className="text-blue-100 mt-1">{DOCUMENTATION_CONFIG.subtitle}</p>
                  </div>
                </div>
              </div>
              {isModal && (
                <button
                  onClick={onClose}
                  className="w-10 h-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center hover:bg-opacity-30 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Search Bar */}
            {!selectedArticle && (
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={DOCUMENTATION_CONFIG.searchPlaceholder}
                  className="w-full px-6 py-4 rounded-xl bg-white bg-opacity-20 backdrop-blur-sm text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                />
                <svg className="absolute right-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {/* Home View - Categories */}
          {!selectedCategory && !selectedArticle && (
            <div>
              {/* Categories Grid */}
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <span className="w-1 h-8 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full"></span>
                  Browse by Category
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {DOCUMENTATION_CONFIG.categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => handleCategoryClick(category.id)}
                      className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-gray-100 hover:border-transparent text-left relative overflow-hidden"
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${category.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                      <div className="relative z-10">
                        <div className="text-5xl mb-4">{category.icon}</div>
                        <h4 className="text-xl font-bold text-gray-900 group-hover:text-white transition-colors mb-2">
                          {category.name}
                        </h4>
                        <p className="text-sm text-gray-600 group-hover:text-white group-hover:text-opacity-90 transition-colors">
                          {category.description}
                        </p>
                        <div className="mt-4 flex items-center gap-2 text-blue-600 group-hover:text-white transition-colors">
                          <span className="text-sm font-medium">Explore</span>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Links */}
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <span className="w-1 h-8 bg-gradient-to-b from-purple-600 to-pink-600 rounded-full"></span>
                  Quick Links
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {DOCUMENTATION_CONFIG.quickLinks.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      className="group bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 hover:shadow-lg transition-all border border-gray-200"
                    >
                      <div className="text-3xl mb-2">{link.icon}</div>
                      <h5 className="font-bold text-gray-900 mb-1">{link.title}</h5>
                      <p className="text-xs text-gray-600">{link.description}</p>
                    </a>
                  ))}
                </div>
              </div>

              {/* Popular Topics */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span>🔥</span>
                  Popular Topics
                </h3>
                <div className="space-y-3">
                  {DOCUMENTATION_CONFIG.popularTopics.map((topic, index) => (
                    <button
                      key={index}
                      onClick={() => handleCategoryClick(topic.category)}
                      className="w-full bg-white rounded-xl p-4 flex items-center justify-between hover:shadow-md transition-all text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                            {topic.title}
                          </div>
                          <div className="text-xs text-gray-500">{topic.views} views</div>
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Category View - Articles List */}
          {selectedCategory && !selectedArticle && (
            <div>
              <div className="mb-6">
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r ${getCategoryColor(selectedCategory)} text-white`}>
                  <span className="text-2xl">
                    {DOCUMENTATION_CONFIG.categories.find(c => c.id === selectedCategory)?.icon}
                  </span>
                  <span className="font-bold">
                    {DOCUMENTATION_CONFIG.categories.find(c => c.id === selectedCategory)?.name}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {(DOCUMENTATION_CONFIG.articles[selectedCategory] || []).map((article) => (
                  <button
                    key={article.id}
                    onClick={() => handleArticleClick(article)}
                    className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all border border-gray-200 hover:border-blue-300 text-left group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors mb-2">
                          {article.title}
                        </h4>
                        <p className="text-gray-600 mb-4">{article.description}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {article.readTime}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            article.difficulty === 'Beginner' ? 'bg-green-100 text-green-700' :
                            article.difficulty === 'Intermediate' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {article.difficulty}
                          </span>
                        </div>
                      </div>
                      <svg className="w-6 h-6 text-gray-400 group-hover:text-blue-600 transition-colors flex-shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Article View - Full Content */}
          {selectedArticle && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <h1 className="text-3xl font-bold text-gray-900 mb-3">{selectedArticle.title}</h1>
                  <p className="text-lg text-gray-600 mb-4">{selectedArticle.description}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {selectedArticle.readTime}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      selectedArticle.difficulty === 'Beginner' ? 'bg-green-100 text-green-700' :
                      selectedArticle.difficulty === 'Intermediate' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {selectedArticle.difficulty}
                    </span>
                  </div>
                </div>
                
                <div className="prose prose-lg max-w-none">
                  {renderArticleContent(selectedArticle.content)}
                </div>

                {/* Feedback */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <p className="text-gray-700 mb-4">Was this article helpful?</p>
                  <div className="flex gap-3">
                    <button className="px-6 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors flex items-center gap-2">
                      <span>👍</span>
                      Yes
                    </button>
                    <button className="px-6 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors flex items-center gap-2">
                      <span>👎</span>
                      No
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Documentation
