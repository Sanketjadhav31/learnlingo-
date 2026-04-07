// Test script for Interview Practice & Tech Quiz modules

const API_BASE = 'http://localhost:3000';
let authToken = '';

async function testAuth() {
  console.log('\n🔐 Testing Authentication...');
  
  // Try login with test user
  const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'test1234'
    })
  });
  
  if (loginRes.ok) {
    const data = await loginRes.json();
    authToken = data.token;
    console.log('✅ Login successful');
    return true;
  } else {
    console.log('⚠️  Test user not found, creating...');
    
    // Create test user
    const signupRes = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        password: 'test1234'
      })
    });
    
    if (signupRes.ok) {
      const data = await signupRes.json();
      authToken = data.token;
      console.log('✅ Signup successful');
      return true;
    } else {
      const error = await signupRes.text();
      console.error('❌ Auth failed:', error);
      return false;
    }
  }
}

async function testInterviewQuestions() {
  console.log('\n🎤 Testing Interview Questions...');
  
  const dayNumber = 1;
  const res = await fetch(`${API_BASE}/api/interview/${dayNumber}`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  
  if (res.ok) {
    const data = await res.json();
    console.log('✅ Interview questions generated');
    console.log(`   Questions: ${data.data.questions.length}`);
    console.log(`   Types: ${data.data.usedTypes.join(', ')}`);
    console.log(`   Sample question: "${data.data.questions[0].question}"`);
    console.log(`   Sample type: ${data.data.questions[0].type}`);
    return true;
  } else {
    const error = await res.text();
    console.error('❌ Interview questions failed:', error);
    return false;
  }
}

async function testTechQuiz() {
  console.log('\n💻 Testing Tech Quiz...');
  
  const dayNumber = 1;
  const subject = 'Python';
  const res = await fetch(`${API_BASE}/api/techquiz/${dayNumber}/${subject}`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  
  if (res.ok) {
    const data = await res.json();
    console.log('✅ Tech quiz generated');
    console.log(`   Subject: ${data.data.subject}`);
    console.log(`   Questions: ${data.data.questions.length}`);
    
    const easyCount = data.data.questions.filter(q => q.difficulty === 'Easy').length;
    const mediumCount = data.data.questions.filter(q => q.difficulty === 'Medium').length;
    const hardCount = data.data.questions.filter(q => q.difficulty === 'Hard').length;
    
    console.log(`   Distribution: ${easyCount} Easy, ${mediumCount} Medium, ${hardCount} Hard`);
    console.log(`   Sample question: "${data.data.questions[0].question}"`);
    console.log(`   Has code: ${data.data.questions.some(q => q.codeSnippet) ? 'Yes' : 'No'}`);
    return true;
  } else {
    const error = await res.text();
    console.error('❌ Tech quiz failed:', error);
    return false;
  }
}

async function testSubjects() {
  console.log('\n📚 Testing Subjects List...');
  
  const res = await fetch(`${API_BASE}/api/techquiz/subjects`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  
  if (res.ok) {
    const data = await res.json();
    console.log('✅ Subjects retrieved');
    console.log(`   Count: ${data.subjects.length}`);
    console.log(`   Subjects: ${data.subjects.join(', ')}`);
    return true;
  } else {
    const error = await res.text();
    console.error('❌ Subjects failed:', error);
    return false;
  }
}

async function testCaching() {
  console.log('\n📦 Testing Caching...');
  
  const dayNumber = 1;
  
  // First call - should generate
  console.log('   First call (should generate)...');
  const start1 = Date.now();
  const res1 = await fetch(`${API_BASE}/api/interview/${dayNumber}`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const duration1 = Date.now() - start1;
  
  if (!res1.ok) {
    console.error('❌ First call failed');
    return false;
  }
  
  console.log(`   ✓ Generated in ${duration1}ms`);
  
  // Second call - should use cache
  console.log('   Second call (should use cache)...');
  const start2 = Date.now();
  const res2 = await fetch(`${API_BASE}/api/interview/${dayNumber}`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const duration2 = Date.now() - start2;
  
  if (!res2.ok) {
    console.error('❌ Second call failed');
    return false;
  }
  
  console.log(`   ✓ Cached in ${duration2}ms`);
  console.log(`   Speed improvement: ${Math.round((duration1 / duration2) * 10) / 10}x faster`);
  
  return duration2 < duration1;
}

async function runTests() {
  console.log('🧪 Starting Interview Practice & Tech Quiz Tests\n');
  console.log('='.repeat(60));
  
  const results = {
    auth: false,
    interview: false,
    techQuiz: false,
    subjects: false,
    caching: false,
  };
  
  try {
    results.auth = await testAuth();
    
    if (results.auth) {
      results.interview = await testInterviewQuestions();
      results.techQuiz = await testTechQuiz();
      results.subjects = await testSubjects();
      results.caching = await testCaching();
    }
  } catch (error) {
    console.error('\n❌ Test error:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Results:');
  console.log(`   Authentication: ${results.auth ? '✅' : '❌'}`);
  console.log(`   Interview Questions: ${results.interview ? '✅' : '❌'}`);
  console.log(`   Tech Quiz: ${results.techQuiz ? '✅' : '❌'}`);
  console.log(`   Subjects List: ${results.subjects ? '✅' : '❌'}`);
  console.log(`   Caching: ${results.caching ? '✅' : '❌'}`);
  
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  console.log(`\n${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('\n🎉 All tests passed! The new modules are working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the logs above for details.');
  }
}

runTests().catch(console.error);
