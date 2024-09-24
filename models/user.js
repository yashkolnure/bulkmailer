// usermodule.js
const mongoose = require('mongoose');

const smtpCredentialSchema = new mongoose.Schema({
    email: { type: String, required: true },
    password: { type: String, required: true },
    port: { type: String, required: true },
    host: { type: String, required: true },
});

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    smtpCredentials: [smtpCredentialSchema],
});

const User = mongoose.model('User', userSchema);
module.exports = User;
