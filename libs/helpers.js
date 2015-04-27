module.exports = function(hbs, mongoose, db) {
	// 'breaklines' helper that breaks lines (convert \r\n into <br />)
	hbs.registerHelper('breaklines', function(text) {
		text = hbs.Utils.escapeExpression(text);
		text = text.replace(/(\r\n|\n\r)/gm, '<br />');
		return new hbs.SafeString(text);
	});
	
	// 'insert' helper for media insertion
	hbs.registerHelper('insert', function(media, type) {
		if (type == 'image') {
			return new hbs.SafeString('<img src="/media/image/' + media + '" />');
		} else if (type == 'movie') {
			return 'Moooviiiiie';
		} else {
			return 'Invalid media';
		}
	});
	
	// Timestamp related helpers
	hbs.registerHelper('year',				function(validTime, timestamp) { return (validTime > 2 ? ', ' : ' ') + (validTime > 0 ? timestamp.getUTCFullYear() : ''); });
	hbs.registerHelper('month', 			function(validTime, timestamp) {
		if (validTime > 2) {
			return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][timestamp.getUTCMonth()] + '.';
		} else if (validTime > 1) {
			return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][timestamp.getUTCMonth()];
		} else {
			return '';
		}
	});
	hbs.registerHelper('date',				function(validTime, timestamp) { return validTime > 2 ? ' ' + timestamp.getUTCDate() : ''; });
	hbs.registerHelper('hour',				function(validTime, timestamp) { return validTime > 3 ? ('0' + timestamp.getUTCHours()).slice(-2) : ''; });
	hbs.registerHelper('minute',			function(validTime, timestamp) { return validTime > 4 ? ':' + ('0' + timestamp.getUTCMinutes()).slice(-2) : ''; });
	hbs.registerHelper('second',			function(validTime, timestamp) { return validTime > 5 ? ':' + ('0' + timestamp.getUTCSeconds()).slice(-2) : ''; });
	hbs.registerHelper('millisecond',		function(validTime, timestamp) { return validTime > 6 ? '.' + ('00' + timestamp.getUTCMilliseconds()).slice(-3) : ''; });
	hbs.registerHelper('format_time',		function(timestamp) {
		return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][timestamp.getUTCMonth()] + '. ' + timestamp.getUTCDate() + ', ' + timestamp.getUTCFullYear() + ' ' + ('0' + timestamp.getUTCHours()).slice(-2) + ':' + ('0' + timestamp.getUTCMinutes()).slice(-2) + ':' + ('0' + timestamp.getUTCSeconds()).slice(-2);
	});

	// Create timestamp from ObjectId
	hbs.registerHelper('get_time', function(objId) {
		return objId.getTimestamp();
	});
	hbs.registerHelper('get_time_formatted', function(objId) {
		var timestamp = objId.getTimestamp();
		return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][timestamp.getUTCMonth()] + '. ' + timestamp.getUTCDate() + ', ' + timestamp.getUTCFullYear() + ' ' + ('0' + timestamp.getUTCHours()).slice(-2) + ':' + ('0' + timestamp.getUTCMinutes()).slice(-2) + ':' + ('0' + timestamp.getUTCSeconds()).slice(-2);
	});

	// Enhanced 'each' block for showing tidbits of entry
	hbs.registerHelper('each_tidbit', function(tidbits, block) {
		if (tidbits == undefined) return '';

		// Sort tidbits
		tidbits.sort(function(a, b) {
			if (a.timestamp == undefined || b.timestamp == undefined) return 0;
			return a.timestamp.getTime() - b.timestamp.getTime();
		});

		// Make new block
		var ret = '';
		for (var i = 0; i < tidbits.length; i++) {
			if (tidbits[i].type != 'tidbit') continue;
			ret = ret + block.fn(tidbits[i]);
		}
		return ret;
	});

	return 'nothing, really';
};