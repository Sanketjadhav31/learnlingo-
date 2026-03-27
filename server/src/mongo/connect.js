const mongoose = require("mongoose");
const dns = require("dns");
const { Resolver } = require("dns").promises;

function setupCustomDNS() {
  const useCustomDNS = process.env.USE_CUSTOM_DNS === "true";
  const dnsServers = process.env.DNS_SERVERS;
  const forceIPv4 = process.env.FORCE_IPV4 === "true";

  if (useCustomDNS && dnsServers) {
    const servers = dnsServers.split(",").map((s) => s.trim());
    dns.setServers(servers);
    console.log(`✓ Custom DNS servers configured: ${servers.join(", ")}`);
  }

  if (forceIPv4) {
    dns.setDefaultResultOrder("ipv4first");
    console.log("✓ IPv4 prioritized for DNS resolution");
  }
}

async function resolveSRV(hostname) {
  const resolver = new Resolver();
  const dnsServers = process.env.DNS_SERVERS;
  
  if (dnsServers) {
    const servers = dnsServers.split(",").map((s) => s.trim());
    resolver.setServers(servers);
  }

  try {
    const records = await resolver.resolveSrv(hostname);
    console.log(`✓ SRV records resolved for ${hostname}:`, records.length, "records");
    return true;
  } catch (err) {
    console.log(`✗ SRV resolution failed for ${hostname}:`, err.message);
    return false;
  }
}

async function connectMongo(uri) {
  if (!uri || !String(uri).trim()) {
    console.log("No MongoDB URI provided; using file-based storage.");
    return { enabled: false, mongoose: null };
  }

  // Setup custom DNS if configured
  setupCustomDNS();

  // Test SRV resolution for mongodb+srv URIs
  const srvMatch = uri.match(/mongodb\+srv:\/\/[^@]+@([^/?]+)/);
  if (srvMatch) {
    const hostname = `_mongodb._tcp.${srvMatch[1]}`;
    console.log(`Testing SRV resolution for: ${hostname}`);
    await resolveSRV(hostname);
  }

  mongoose.set("strictQuery", true);

  const connectionOptions = {
    serverSelectionTimeoutMS: 20000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 20000,
    family: process.env.FORCE_IPV4 === "true" ? 4 : 0,
  };

  try {
    console.log("Attempting MongoDB connection...");
    await mongoose.connect(uri, connectionOptions);
    console.log("✓ MongoDB connected successfully");
    return { enabled: true, mongoose };
  } catch (e) {
    console.warn("\n⚠ MongoDB connection failed; using file-based fallback.");
    console.warn("Error:", e?.message || e);
    
    // Try fallback standard URI if available
    const fallbackUri = process.env.MONGODB_URI_STANDARD;
    if (fallbackUri && fallbackUri !== uri) {
      console.log("\nAttempting fallback connection with standard URI...");
      try {
        await mongoose.connect(fallbackUri, connectionOptions);
        console.log("✓ MongoDB connected via fallback URI");
        return { enabled: true, mongoose };
      } catch (fallbackErr) {
        console.warn("✗ Fallback connection also failed:", fallbackErr?.message);
      }
    }
    
    console.warn("\nUsing file-based storage. To fix MongoDB connection:");
    console.warn("1. Whitelist your IP in MongoDB Atlas Network Access");
    console.warn("2. Verify cluster is running (not paused)");
    console.warn("3. Check credentials are correct\n");
    return { enabled: false, mongoose: null };
  }
}

module.exports = { connectMongo };

