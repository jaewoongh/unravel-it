module.exports = function(mongoose, db) {
	// Search entries
	var searchEntries = function(req, res) {
		var searchString = req.params.string;
		if (!Boolean(searchString)) return res.json({});

		// Tokenize string
		var tokens = searchString.split(' ');

		// Check exclude tokens
		var tokensToExclude = [];
		for (var i = 0; i < tokens.length; i++) {
			var matchResult = tokens[i].match(/^\-(\S+)/);
			if (matchResult !== null) {
				tokens.splice(i, 1);
				tokensToExclude.push(matchResult[1]);
				i--;
			}
		}
		if (tokens.length <= 0) return res.json({});

		// Make a loose RegExp for initial search
		var regexString = '';
		var regexWordMatchString = '';
		for (var i = 0; i < tokens.length; i++) {
			regexString += tokens[i] + '|';
			regexWordMatchString += '(^|\\s)' + tokens[i] + '(\\s|$)|';
		}
		var regex = new RegExp(regexString.slice(0, -1), 'ig');
		var regexWord = new RegExp(regexWordMatchString.slice(0, -1), 'ig');

		var regexStringExclude = '';
		for (var i = 0; i < tokensToExclude.length; i++) {
			regexStringExclude += tokensToExclude[i] + '|';
		}
		var regexExclude = new RegExp(regexStringExclude.slice(0, -1), 'ig');
		console.log('Entry search request: ' + regexString.slice(0, -1) + (regexStringExclude.length > 0 ? ' -(' + regexStringExclude.slice(0, -1) + ')' : ''));

		// Begin search
		db.Entry.find({title: regex}, function(err, entries) {
			if (err) return console.error(err);

			// Make final result
			var result = [];
			for (var i = 0; i < entries.length; i++) {
				// Exclude
				if (tokensToExclude.length > 0) {
					if (entries[i].title.match(regexExclude) !== null) {
						entries.splice(i, 1);
						i--;
						continue;
					}
				}

				// Add basic relevance points
				var one = {};
				one.point = entries[i].title.match(regex).length;

				// Weigh whole-word-match more
				var wordMatchResult = entries[i].title.match(regexWord);
				if (wordMatchResult !== null) {
					one.point += wordMatchResult.length * 10;
				}
				one.entry = entries[i];
				result.push(one);
			}

			// Sort final result
			result.sort(function(a, b) {
				return b.point - a.point;
			});

			// Send the result
			if (result.length > 0) res.json({result: result});
			else res.json({});
		});
	};

	// Get recently edited entries
	var recentlyEditedEntries = function(req, res) {
		var howMany = parseInt(req.params.num);
		if (!Boolean(howMany)) return res.json({});

		// Fetch list data
		db.List.findOne().exec(function(err, list) {
			if (err) return console.error(err);
			list.entries.sort(function(a, b) {
				return b.lastEdit - a.lastEdit;
			});
			res.json({result: list.entries.slice(0, howMany)});
		});
	};

	return {
		searchEntries:			searchEntries,
		recentlyEditedEntries:	recentlyEditedEntries
	}
};