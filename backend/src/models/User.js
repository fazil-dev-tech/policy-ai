const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            minlength: 2,
            maxlength: 100,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            trim: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
        },
        password_hash: {
            type: String,
            required: [true, 'Password is required'],
            minlength: 6,
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user',
        },
        refreshToken: {
            type: String,
            default: null,
        },
        lastLogin: {
            type: Date,
            default: null,
        },
        loginOtp: {
            type: String,
            default: null,
        },
        loginOtpExpires: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Index for fast lookups
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password_hash')) return next();
    const salt = await bcrypt.genSalt(12);
    this.password_hash = await bcrypt.hash(this.password_hash, salt);
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password_hash);
};

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function () {
    const user = this.toObject();
    delete user.password_hash;
    delete user.refreshToken;
    return user;
};

module.exports = mongoose.model('User', userSchema);
