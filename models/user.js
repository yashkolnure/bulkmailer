// userModel.js
const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
    fullName: String,
    email: String,
    mobileNo: String,
    password: String,
    smtpCredentials: [
        {
            mail: String,
            password: String,
            port: Number,
            server: String
        }
    ]
});

const User = mongoose.model('User', userSchema);
// Create user model

module.exports = User;


