const mongoose = require("mongoose");
const dns = require("dns");
const { Resolver } = require("dns").promises;
const logger = require("../logger");

function setupCustomDNS() {
  const useCustomDNS = process.env.USE_CUSTOM_DNS === "true";
  const dnsServers = process.env.DNS_SERVERS;
  const forceIPv4 = process.env.FORCE_IPV4 === "true";

  if (useCustomDNS && dnsServers) {
    const servers = dnsServers.split(",").map((s) => s.trim());
    dns.setServers(servers);
  }

  if (forceIPv4) {
    dns.setDefaultResultOrder("ipv4first");
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
    return true;
  } catch (err) {
    return false;
  }
}

async function connectMongo(uri) {
  if (!uri || !String(uri).trim()) {
    return { enabled: false, mongoose: null };
  }

  // Setup custom DNS if configured
  setupCustomDNS();

  // Test SRV resolution for mongodb+srv URIs
  const srvMatch = uri.match(/mongodb\+srv:\/\/[^@]+@([^/?]+)/);
  if (srvMatch) {
    const hostname = `_mongodb._tcp.${srvMatch[1]}`;
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
    await mongoose.connect(uri, connectionOptions);
    logger.mongoConnect(true, 'primary');
    return { enabled: true, mongoose };
  } catch (e) {
    // Try fallback standard URI if available
    const fallbackUri = process.env.MONGODB_URI_STANDARD;
    if (fallbackUri && fallbackUri !== uri) {
      try {
        await mongoose.connect(fallbackUri, connectionOptions);
        logger.mongoConnect(true, 'fallback');
        return { enabled: true, mongoose };
      } catch (fallbackErr) {
        // Fallback failed
      }
    }
    
    logger.mongoConnect(false);
    return { enabled: false, mongoose: null };
  }
}

module.exports = { connectMongo };

