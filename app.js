// Show fancy logo
console.log('██╗   ██╗███╗   ██╗██████╗  █████╗ ██╗   ██╗███████╗██╗      ██╗████████╗');
console.log('██║   ██║████╗  ██║██╔══██╗██╔══██╗██║   ██║██╔════╝██║      ██║╚══██╔══╝');
console.log('██║   ██║██╔██╗ ██║██████╔╝███████║██║   ██║█████╗  ██║█████╗██║   ██║   ');
console.log('██║   ██║██║╚██╗██║██╔══██╗██╔══██║╚██╗ ██╔╝██╔══╝  ██║╚════╝██║   ██║   ');
console.log('╚██████╔╝██║ ╚████║██║  ██║██║  ██║ ╚████╔╝ ███████╗███████╗ ██║   ██║   ');
console.log(' ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚══════╝ ╚═╝   ╚═╝   ');
                                                                         
// Set up server via express
var express = require('express');
var app = express();
var server = require('http').Server(app);

var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.enable('trust proxy', 'loopback');
app.get('/test/ip', function(req, res) { res.send(req.ip) });
app.get('/test/ips', function(req, res) { res.send(req.ips) });

// Set up MongoDB with Mongoose
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/unravelit');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error: '));
db.once('open', function() { console.log('MongoDB successfully connected'); });

// Setup MongoDB schema
var Tidbit = require('./models/tidbit')(mongoose).model;
var Entry = require('./models/entry')(mongoose, Tidbit.schema).model;
var History = require('./models/history')(mongoose).model;
var User = require('./models/user')(mongoose).model;
var List = require('./models/list')(mongoose).model;

// Wrap those schema up
var schemaWrap = {
	Tidbit:		Tidbit,
	Entry:		Entry,
	History:	History,
	User:		User,
	List:		List
};

// Set render engine
var hbs = require('express-hbs');
app.engine('html', hbs.express4({
	partialsDir:	__dirname + '/views/partials',
	defaultLayout:	__dirname + '/views/layouts/default.html'
}));
app.set('view engine', 'html');

// Register custom helpers for Handlebars (express-hbs)
var hbsHelpers = require('./libs/helpers')(hbs, mongoose, schemaWrap);

// ROUTES
// Static pages
var pages = require('./routes/pages')(mongoose, schemaWrap);
app.get('/', pages.coverpage);
app.get('/about', pages.aboutpage);

// REST API
var api = require('./routes/api')(mongoose, schemaWrap);
app.get('/api/search/entry/', api.searchEntries);
app.get('/api/search/entry/:string', api.searchEntries);
app.get('/api/recent/edited-entries/', api.recentlyEditedEntries);
app.get('/api/recent/edited-entries/:num', api.recentlyEditedEntries);	// Maximum 100

// Admin tools
app.get('/admin/api/entrylist', api.adminEntryList);
app.get('/admin/api/removeentry/', api.adminRemoveEntry);
app.get('/admin/api/removeentry/:docId', api.adminRemoveEntry);

// Timeline related pages
var slug = require('slug');
var timeline = require('./routes/timeline')(mongoose, schemaWrap, slug, api);
app.get('/tl/*', timeline.show);
app.get('/entry/new', timeline.newEntry);
app.post('/entry/new', timeline.createEntry);
app.post('/entry/:docId/edit', timeline.editEntry);
app.get('/entry/:docId/history', timeline.entryHistory);
app.post('/entry/:docId/tidbit/new', timeline.createTidbit);
app.post('/entry/:docId/tidbit/:bitId/edit', timeline.editTidbit);
app.post('/entry/:docId/tidbit/:bitId/remove', timeline.removeTidbit);
app.get('/entry/:docId/tidbit/:bitId/history', timeline.tidbitHistory);

// User related pages
var userpage = require('./routes/timeline')(mongoose, schemaWrap);
app.get('/user/:username', function(req, res) {
	res.send(req.params.username);
});

// Set static dir
var path = require('path');
app.use(express.static(path.join(__dirname, 'public')))

// Error pages
app.use(function(req, res, next) {
	res.status(404).render('404');
});
app.use(function(err, req, res, next) {
	console.error(err.stack);
	res.status(500).render('500')
});

// Listen!
var port = process.env.PORT || 4444;
server.listen(port, function() {
	console.log('Server listening for HTTP connection on port %d', port);
});