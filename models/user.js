// usermodule.js
const mongoose = require('mongoose');

// Define the SMTP Credential schema
const smtpCredentialSchema = new mongoose.Schema({
    email: { type: String, required: true },
    password: { type: String, required: true },
    port: { type: String, required: true },
    host: { type: String, required: true },
});

// Define the User schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    smtpCredentials: [smtpCredentialSchema],
    emailsSentToday: {
        count: { type: Number, default: 0 }, // Track how many emails sent today
        date: { type: Date, default: Date.now } // Track the date of the last reset
    },
});

// Create and export the User model
const User = mongoose.model('User', userSchema);
module.exports = User;
