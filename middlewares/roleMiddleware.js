const roleMiddleware = (roles) => {
  return (req, res, next) => {
    console.log('User role:', req.user ? req.user.role : 'No user');
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Authentication required.'
      });
    }
console.log('Required roles:', roles);
    console.log('User roles:', req.user.role);
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

module.exports = roleMiddleware;
