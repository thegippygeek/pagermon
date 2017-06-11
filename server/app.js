var debug = require('debug')('pagermon:server');
var http = require('http');
var compression = require('compression');
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var fs = require('fs');
var session = require('express-session');
var SQLiteStore = require('connect-sqlite3')(session);
var passport = require('passport');
var flash    = require('connect-flash');
require('./config/passport')(passport); // pass passport for configuration

// routes
var index = require('./routes/index');
var admin = require('./routes/admin');
var api = require('./routes/api');

// create config file if it does not exist, and set defaults
var conf_defaults = require('./config/default.json');
var conf_file = './config/config.json';
if( ! fs.existsSync(conf_file) ) {
    fs.writeFileSync( conf_file, JSON.stringify(conf_defaults,null, 2) );
}
// load the config file
var nconf = require('nconf');
    nconf.file({file: conf_file});
    nconf.load();

var port = normalizePort(process.env.PORT || '3000');
var app = express();
    app.set('port', port);
    // view engine setup
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'ejs');
    app.set('trust proxy', 'loopback, linklocal, uniquelocal');    

var server = http.createServer(app);
var io = require('socket.io').listen(server);
    server.listen(port);
    server.on('error', onError);
    server.on('listening', onListening);
io.sockets.on('connection', function (socket) {
    socket.removeAllListeners();
    debug('client connect');
    socket.on('echo', function (data) {
        io.sockets.emit('message', data);
        console.log('message', data);
    });
});

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

// set socket.io to be shared across all modules
app.use(function(req,res,next){
    req.io = io;
    next();
});

// session secret is controlled by config
var secret = nconf.get('global:sessionSecret');
// compress all responses
app.use(compression());
app.use(logger('combined'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 1 week
    store: new SQLiteStore,
    saveUninitialized: true,
    resave: 'true',
    secret: secret
}));
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
app.use(function(req, res, next) {
  res.locals.version = nconf.get('global:version') || 'unknown version';
  res.locals.loglevel = nconf.get('global:loglevel') || 'info';
  next();
});


app.use('/', index);
app.use('/admin', admin);
app.use('/post', api);
app.use('/api', api);


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('global/error', { title: 'PagerMon' });
});

module.exports = app;
    
/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}