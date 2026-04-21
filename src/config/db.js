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

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

export default connectDB;
