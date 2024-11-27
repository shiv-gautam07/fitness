function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}

function verifyOTP(storedOtp, inputOtp) {
    return storedOtp === inputOtp;
}

function checkPasswordStrength(password) {
    const mediumRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/;
    return mediumRegex.test(password); // Requires uppercase, lowercase, and number, min 8 chars
}

module.exports = {
    generateOTP,
    verifyOTP,
    checkPasswordStrength,
};
