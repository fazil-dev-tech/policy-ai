const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = process.env.UPLOAD_DIR || 'uploads';
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
        const ext = path.extname(file.originalname);
        cb(null, `policy-${uniqueSuffix}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    const allowedMimes = ['application/pdf'];
    const allowedExts = ['.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only PDF files are allowed'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
        files: 1,
    },
});

module.exports = upload;
