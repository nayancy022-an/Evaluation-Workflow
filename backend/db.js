const mongoose = require("mongoose");

async function connectDb() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set. Add it to your .env file.");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected");
}

module.exports = { connectDb };