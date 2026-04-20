import dns from 'dns';
import mongoose from 'mongoose';

const configureMongoDns = () => {
  const configuredServers = process.env.MONGO_DNS_SERVERS
    ?.split(',')
    .map((server) => server.trim())
    .filter(Boolean);

  dns.setServers(configuredServers?.length ? configuredServers : ['1.1.1.1', '8.8.8.8']);
};

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in the environment');
    }

    if (process.env.MONGO_URI.startsWith('mongodb+srv://')) {
      configureMongoDns();
    }

    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    const isSrvDnsError = error?.message?.includes('querySrv') || error?.message?.includes('ECONNREFUSED');
    const isAuthError = error?.message?.toLowerCase().includes('bad auth') || error?.message?.toLowerCase().includes('authentication failed');

    console.error(`❌ MongoDB Connection Error: ${error.message}`);

    if (isSrvDnsError) {
      console.error(
        'Atlas SRV lookup failed. Use the standard MongoDB Atlas connection string from the Drivers page, then allow your IP in Network Access and restart the server.'
      );
    }

    if (isAuthError) {
      console.error(
        'Atlas authentication failed. Verify the database username and password in MONGO_URI, reset the Atlas database user password if needed, and URL-encode the password if it contains special characters.'
      );
    }

    process.exit(1);
  }
};

export default connectDB;
