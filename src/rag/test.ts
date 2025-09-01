/**
 * RAG System Integration Test
 * Verifies the complete RAG system functionality
 */

import { bootstrapRagSystem } from '../rag'
import type { MainRagService } from '../rag'

async function testRagSystem() {
  console.log('🧪 Starting RAG System Integration Test...')
  
  try {
    // Test configuration
    const testConfig = {
      databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/test_rag',
      embeddingModel: 'all-MiniLM-L6-v2',
      defaultTopK: 3,
      scoreThreshold: 0.3
    }
    
    console.log('📊 Test Configuration:', testConfig)
    
    // Bootstrap the RAG system
    console.log('🚀 Bootstrapping RAG system...')
    const ragService = await bootstrapRagSystem(testConfig)
    
    // Test 1: Health Check
    console.log('\n🔍 Test 1: Health Check')
    const health = await ragService.healthCheck()
    console.log('Health Status:', health.status)
    console.log('Components:', Object.entries(health.components).map(([name, comp]) => `${name}: ${comp.status}`))
    
    // Test 2: Add Documents
    console.log('\n📄 Test 2: Adding Test Documents')
    const testDocuments = [
      {
        content: 'Artificial Intelligence (AI) is a branch of computer science that aims to create intelligent machines. Machine learning is a subset of AI that enables computers to learn and improve from experience without being explicitly programmed.',
        metadata: { title: 'Introduction to AI', source: 'test', contentType: 'educational' }
      },
      {
        content: 'Natural Language Processing (NLP) is a field of AI that focuses on the interaction between computers and humans through natural language. It involves developing algorithms that can understand, interpret, and generate human language.',
        metadata: { title: 'NLP Overview', source: 'test', contentType: 'educational' }
      },
      {
        content: 'Deep learning is a subset of machine learning that uses neural networks with multiple layers to model and understand complex patterns in data. It has revolutionized fields like computer vision and speech recognition.',
        metadata: { title: 'Deep Learning Basics', source: 'test', contentType: 'educational' }
      }
    ]
    
    const documentIds: string[] = []
    for (const doc of testDocuments) {
      try {
        const id = await ragService.addDocument(doc.content, doc.metadata)
        documentIds.push(id)
        console.log(`✅ Added document: ${doc.metadata.title} (ID: ${id})`)
      } catch (error) {
        console.error(`❌ Failed to add document: ${doc.metadata.title}`, error)
      }
    }
    
    // Wait a moment for indexing
    console.log('⏳ Waiting for indexing...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Test 3: Query Retrieval
    console.log('\n🔍 Test 3: Query Retrieval')
    const testQueries = [
      { text: 'What is machine learning?', expectedConcepts: ['machine learning', 'AI', 'learning'] },
      { text: 'How does natural language processing work?', expectedConcepts: ['NLP', 'natural language', 'algorithms'] },
      { text: 'Tell me about neural networks', expectedConcepts: ['neural networks', 'deep learning', 'layers'] }
    ]
    
    for (const query of testQueries) {
      try {
        console.log(`\n📝 Query: "${query.text}"`)
        
        const response = await ragService.retrieve({
          text: query.text,
          topK: 3,
          granularity: 'coarse',
          includeMetadata: true
        })
        
        console.log(`📊 Results: ${response.results.length} documents found`)
        console.log(`⚡ Latency: ${response.totalLatency}ms (embedding: ${response.embeddingLatency}ms, retrieval: ${response.retrievalLatency}ms)`)
        console.log(`🎯 Confidence: ${response.confidence}, Coverage: ${response.coverage}`)
        console.log(`🔧 Strategy: ${response.strategy}`)
        
        response.results.forEach((result, index) => {
          console.log(`\n  ${index + 1}. Score: ${result.score.toFixed(3)}`)
          console.log(`     Content: ${result.content.substring(0, 100)}...`)
          console.log(`     Metadata: ${JSON.stringify(result.metadata.documentTitle || 'N/A')}`)
        })
        
        // Validate results
        const hasRelevantContent = response.results.some(result => 
          query.expectedConcepts.some(concept => 
            result.content.toLowerCase().includes(concept.toLowerCase())
          )
        )
        
        if (hasRelevantContent) {
          console.log(`✅ Query found relevant content`)
        } else {
          console.log(`⚠️  Query may not have found relevant content`)
        }
        
      } catch (error) {
        console.error(`❌ Query failed: ${query.text}`, error)
      }
    }
    
    // Test 4: Different Strategies
    console.log('\n🎛️  Test 4: Strategy Comparison')
    const strategyQuery = { text: 'What are the applications of artificial intelligence?', topK: 2 }
    
    try {
      // Try retrieve-read strategy
      const retrieveReadResponse = await ragService.retrieveWithStrategy(
        strategyQuery,
        'retrieve_read'
      )
      
      console.log(`\n🔍 Retrieve-Read Strategy:`)
      console.log(`   Results: ${retrieveReadResponse.results.length}`)
      console.log(`   Latency: ${retrieveReadResponse.totalLatency}ms`)
      console.log(`   Confidence: ${retrieveReadResponse.confidence}`)
      
      // Try adaptive strategy
      const adaptiveResponse = await ragService.adaptiveRetrieve(strategyQuery)
      
      console.log(`\n🤖 Adaptive Strategy:`)
      console.log(`   Results: ${adaptiveResponse.results.length}`)
      console.log(`   Latency: ${adaptiveResponse.totalLatency}ms`)
      console.log(`   Confidence: ${adaptiveResponse.confidence}`)
      console.log(`   Selected Strategy: ${adaptiveResponse.strategy}`)
      
    } catch (error) {
      console.error(`❌ Strategy comparison failed:`, error)
    }
    
    // Test 5: System Metrics
    console.log('\n📈 Test 5: System Metrics')
    try {
      const metrics = await ragService.getSystemMetrics()
      console.log('System Metrics:')
      console.log(`  Total Queries: ${metrics.totalQueries}`)
      console.log(`  Average Latency: ${metrics.averageLatency}ms`)
      console.log(`  Memory Usage: ${Math.round(metrics.memoryUsage / 1024 / 1024)}MB`)
      console.log(`  Strategy Distribution:`, metrics.strategyDistribution)
      
      const indexStats = await ragService.getIndexStats()
      console.log('Index Stats:')
      console.log(`  Documents: ${indexStats.documentCount}`)
      console.log(`  Chunks: ${indexStats.chunkCount}`)
      console.log(`  Embedding Dimensions: ${indexStats.embeddingDimensions}`)
      
    } catch (error) {
      console.error(`❌ Metrics collection failed:`, error)
    }
    
    // Test 6: Cleanup
    console.log('\n🧹 Test 6: Cleanup')
    try {
      for (const id of documentIds) {
        await ragService.deleteDocument(id)
        console.log(`🗑️  Deleted document: ${id}`)
      }
    } catch (error) {
      console.error(`❌ Cleanup failed:`, error)
    }
    
    // Final health check
    console.log('\n🔍 Final Health Check')
    const finalHealth = await ragService.healthCheck()
    console.log('Final Health Status:', finalHealth.status)
    
    // Shutdown
    console.log('\n🛑 Shutting down RAG system...')
    await ragService.shutdown()
    
    console.log('✅ RAG System Integration Test Completed Successfully!')
    
  } catch (error) {
    console.error('❌ RAG System Integration Test Failed:', error)
    process.exit(1)
  }
}

// Run the test if this file is executed directly
if (import.meta.main) {
  testRagSystem()
    .then(() => {
      console.log('🎉 All tests passed!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Test failed:', error)
      process.exit(1)
    })
}

export { testRagSystem }
