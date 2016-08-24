//  OpenShift sample Node application

var express = require('express');
var app = express();
var fs = require("fs");
var https = require('https');
var http = require('http');
var md5 = require('md5');
var cachingTime = 60000;
var endtime = 'null';
/**
 *  Define the sample application.
 */
var SampleApp = function()

{

    //  Scope.
    var self = this;
    var io = null;


    /*  ================================================================  */
    /*  Helper functions.                                                 */
    /*  ================================================================  */

    /**
     *  Set up server IP address and port # using env variables/defaults.
     */
    self.setupVariables = function()
    {
        //  Set the environment variables we need.
        self.ipaddress = process.env.OPENSHIFT_NODEJS_IP ||
                         process.env.OPENSHIFT_INTERNAL_IP;
        self.port      = process.env.OPENSHIFT_INTERNAL_PORT || process.env.OPENSHIFT_NODEJS_PORT || 8091;

        if (typeof self.ipaddress === "undefined") {
            //  Log errors on OpenShift but continue w/ 127.0.0.1 - this
            //  allows us to run/test the app locally.
            console.warn('No OPENSHIFT_*_IP var, using 127.0.0.1');
            self.ipaddress = "127.0.0.1";
        };
    };




    /**
     *  Populate the cache.
     */
    self.populateCache = function() {
        if (typeof self.zcache === "undefined") {
            self.zcache = { 'index.html': '' };
        }

        //  Local cache for static content.
        self.zcache['screen.html'] = fs.readFileSync('./views/screen.html');
        self.zcache['index.html'] = fs.readFileSync('./views/index.html');
    };


    /**
     *  Retrieve entry (content) from cache.
     *  @param {string} key  Key identifying content to retrieve from cache.
     */
    self.cache_get = function(key) { return self.zcache[key]; };


    /**
     *  terminator === the termination handler
     *  Terminate server on receipt of the specified signal.
     *  @param {string} sig  Signal to terminate on.
     */
    self.terminator = function(sig){
        if (typeof sig === "string") {
           console.log('%s: Received %s - terminating sample app ...',
                       Date(Date.now()), sig);
           process.exit(1);
        }
        console.log('%s: Node server stopped.', Date(Date.now()) );
    };


    /**
     *  Setup termination handlers (for exit and a list of signals).
     */
    self.setupTerminationHandlers = function(){
        //  Process on exit and signals.
        process.on('exit', function() { self.terminator(); });

        // Removed 'SIGPIPE' from the list - bugz 852598.
        ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
         'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
        ].forEach(function(element, index, array) {
            process.on(element, function() { self.terminator(element); });
        });
    };


    /*  ================================================================  */
    /*  App server functions (main app logic here).                       */
    /*  ================================================================  */

    /**
     *  Create the routing table entries + handlers for the application.
     */
    self.createRoutes = function() {
        self.LastStep = 0;

        self.routes = { };

        // Routes for /health, /asciimo, /env and /
        self.routes['/health'] = function(req, res) {
            res.send('1');
        };

        self.routes['/api/database/regions'] = function (req, res)
        {
            res.setHeader('Access-Control-Allow-Origin', "http://"+req.headers.host+':8000');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
            res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
            res.set('Content-Type', 'application/json');
            res.send(fs.readFileSync('./bd.json'));
        }

        self.routes['/api/wsescaperestoptimer'] = function (req, res)
        {
           endtime = 'none';
           self.io.sockets.emit('endtimechange', endtime.toString());
           res.send("timer stopped");
        }
         self.routes['/api/wsescaperestarttimer'] = function (req, res)
        {
           endtime = new Date();
           endtime.setMinutes(endtime.getMinutes() + 10);
           self.LastStep = 0;
           self.io.sockets.emit('endtimechange', endtime.toString());
           res.send("timer restarted");
        }

        self.routes['/api/timeelapsed'] = function(req,res)
        {
             self.io.sockets.emit('timeElapsed');
             res.send("timer is ended").end();
        }

        self.routes['/api/getPinState'] = function(req,res){
            //returning a html page that show pin state from arduino;
        }
        self.routes['/api/wsescape/:id'] = function (req, res)
        {
              
                    d = new Date();
                    var formatminute = d.getMinutes();
                    if(formatminute< 10){
                        formatminute = "0"+formatminute;
                    }
                    var formathour = d.getHours();
                    formathour = formathour+6;
                    var  formatTime = formathour+" h "+formatminute+" et "+d.getSeconds()+" secondes"


                    var pinId = parseInt(req.params.id);
                                         
                    var message={
                        id: pinId,
                        step : 0,
                        validate : false,
                        fatal : false
                    }

                    /** control for fatal step like cutting a pin in a bad step */
                    if( (pinId > 31 && self.LastStep === 0) 
                        || (pinId > 37 && self.LastStep === 1) 
                        || (pinId > 43 && self.LastStep === 2)                         
                     )
                     {
                         self.LastStep = 0;
                         message.fatal = true;
                     }

                    /** control for step 1 pin 30 31 */
                    if((pinId === 30 || pinId === 31) && self.LastStep < 1) {
                        self.LastStep = 1;
                        if(pinId === 31){ //good cuted pin                             
                            message.validate = true;
                        }
                        message.step = self.LastStep;
                    }   

                    /** control for step 2 pin 36 37 */
                    if((pinId === 36 || pinId === 37) && self.LastStep < 2) {
                        self.LastStep = 2;
                        if(pinId === 36){
                             message.validate = true;
                        }
                        message.step = self.LastStep;
                    }
                    /** control for step 3 pin  42 43*/
                    if((pinId === 42 || pinId === 43) && self.LastStep < 3) {
                        self.LastStep = 3;
                        if(pinId === 42){
                             message.validate = true;
                        }
                        message.step = self.LastStep;
                    }
                    /** control for step 4 pin 48 49 */
                     if((pinId === 48 || pinId === 49 ) && self.LastStep < 4) {
                        self.LastStep = 4;
                        if(pinId === 49){
                            message.validate = true;
                        }
                        message.step = self.LastStep;
                    }
                   

                    if(self.LastStep === 4){
                        self.LastStep = 0;
                    }

                    self.io.sockets.emit('messageescape', JSON.stringify(message));
                    res.send("messageescape id : "+req.params.id+" bien envoyé");
               
        };




        self.routes['/'] = function(req, res) {
            res.setHeader('Access-Control-Allow-Origin', "http://"+req.headers.host+':8000');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
            res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
            res.set('Content-Type', 'text/html');
            res.send(self.cache_get('index.html'));
        };

          self.routes['/screen'] = function(req,res){
             res.setHeader('Access-Control-Allow-Origin', "http://"+req.headers.host+':8000');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
            res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
            res.set('Content-Type', 'text/html');
            res.send(self.cache_get('screen.html') );
        }
    };


    /**
     *  Initialize the server (express) and create the routes and register
     *  the handlers.
     */
    self.initializeServer = function() {
        self.createRoutes();
        self.app = express();

        var path = require('path')

        self.app.use(express.static(path.join(__dirname, 'public')));

        self.app.disable('x-powered-by');

        self.app.use(function (req, res, next) {
                res.setHeader('Access-Control-Allow-Origin', "http://"+req.headers.host+':8000');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
                res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
                next();
            }
        );

        self.server = require('http').createServer(self.app);
        self.io = require("socket.io").listen(self.server,{log:true, origins:'*:*'});
        self.io.set('match origin protocol', true);
        endtime = 'null';
      //  endtime.setMinutes(endtime.getMinutes() + 15);
       

        for (var r in self.routes)
        {
            self.app.get(r, self.routes[r]);
        }



        var allClients = 0;
        var clientId = 1;


         self.io.sockets.on('connection', function (client) {
            
            var my_timer;
            var my_client = {
                "id": clientId,
                "obj": client
            };
            console.log('new client try connection { id : '+clientId+' }');
            clientId += 1;
            allClients += 1;
            console.log('nbclient connected : '+allClients);
            
           
           //self.io.sockets.emit('endtimechange', endtime.toString());            
            client.on('disconnect', function() {
                clearTimeout(my_timer);
                allClients -= 1;
                console.log('disconnect');
            });
        });
    };





    /**
     *  Initializes the sample application.
     */
    self.initialize = function()
    {
        self.setupVariables();
        self.populateCache();
        self.setupTerminationHandlers();

        // Create the express server and routes.
        self.initializeServer();
    };


    /**
     *  Start the server (starts up the sample application).
     */
    self.start = function()
    {
        //  Start the app on the specific interface (and port).
        self.server.listen(self.port, self.ipaddress, function()
        {
            console.log('%s: Node server started on %s:%d ...', Date(Date.now() ), self.ipaddress, self.port);
        });
       // console.log(self.port);
       // self.server.listen(self.port);

    };





};


/**
 *  main():  Main code.
 */
var zapp = new SampleApp();
zapp.initialize();
zapp.start();

