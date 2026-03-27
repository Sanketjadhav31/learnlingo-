// Test script to verify Gemini API is working
require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const { callGeminiJsonWithFallback, getGeminiModelCandidates } = require("./src/trainer/geminiClient");

async function testGemini() {
  console.log("🧪 Testing Gemini API...\n");
  
  const apiKey = process.env.GOOGLE_API_KEY;
  const modelName = process.env.GEMINI_MODEL || "(auto)";
  
  console.log("Configuration:");
  console.log(`  API Key: ${apiKey ? apiKey.slice(0, 10) + "..." : "NOT SET"}`);
  console.log(`  Model env: ${modelName}`);
  console.log(`  Candidates: ${getGeminiModelCandidates().join(", ")}\n`);
  
  if (!apiKey) {
    console.error("❌ GOOGLE_API_KEY is not set in server/.env");
    process.exit(1);
  }
  
  try {
    console.log("📡 Making test API call...\n");
    
    const systemPrompt = "You are a helpful assistant that returns JSON.";
    const userPrompt = JSON.stringify({
      task: "Generate a simple test response",
      format: {
        message: "A greeting message",
        number: "A random number between 1-100"
      }
    });
    
    const result = await callGeminiJsonWithFallback({
      systemPrompt,
      userPrompt,
      timeoutMs: 30000
    });
    
    console.log("✓ API call successful!\n");
    console.log("Response:");
    console.log(result);
    console.log("\n✅ Gemini API is working correctly!");
    
  } catch (error) {
    console.error("\n❌ Test failed:");
    console.error(error.message);
    console.error("\nPossible issues:");
    console.error("  1. Invalid API key");
    console.error("  2. Incorrect model name");
    console.error("  3. API quota exceeded");
    console.error("  4. Network connectivity issues");
    process.exit(1);
  }
}

testGemini();
