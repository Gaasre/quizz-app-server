const jwt = require('jsonwebtoken');

//Token verification
module.exports = function(req, res, next) {
    var token = req.headers.authorization;
    if (token) {
      // verifies secret and checks if the token is expired
      jwt.verify(token, 'C9HtJO5DgS', (err, decoded) =>{      
        if (err) {
          res.status('404').send('invalid token');    
        } else {
          // if everything is good, save to request for use in other routes
          req.decoded = decoded;
          next();
        }
      });
    } else {
      // if there is no token  
      res.status('404').send('no token provided');
    }
  }